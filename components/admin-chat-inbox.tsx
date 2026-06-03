"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Image, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { LocalTime } from "@/components/local-time";
import type { ConversationPreview, Message } from "@/lib/types";

type Props = {
  conversations: ConversationPreview[];
  initialUnreadConversationIds: string[];
  selectedConversationId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  initialAssignmentFilter: AssignmentFilter;
};

export type AssignmentFilter = "all" | "assigned" | "unassigned";

const assignmentFilters: { value: AssignmentFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "assigned", label: "Assigned" },
  { value: "unassigned", label: "Unassigned" }
];

function customerName(conversation: ConversationPreview) {
  return (
    conversation.guest_name ||
    conversation.guest_email ||
    conversation.profiles?.full_name ||
    conversation.profiles?.email ||
    "Customer"
  );
}

function previewText(conversation: ConversationPreview) {
  if (!conversation.latest_message) return "No messages yet";
  if (conversation.latest_message.body) return conversation.latest_message.body;
  if (conversation.latest_message.image_url) return "Image attachment";
  return "New message";
}

function assignedAgentName(conversation: ConversationPreview) {
  return conversation.assigned_profile?.full_name || conversation.assigned_profile?.email || "Unassigned";
}

export function AdminChatInbox({
  conversations,
  initialUnreadConversationIds,
  selectedConversationId,
  currentUserId,
  isAdmin,
  initialAssignmentFilter
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(conversations);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(
    () => new Set(initialUnreadConversationIds)
  );
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(initialAssignmentFilter);
  const itemsRef = useRef(conversations);

  function matchesAssignmentFilter(conversation: ConversationPreview, filter: AssignmentFilter) {
    if (filter === "assigned") {
      return isAdmin
        ? Boolean(conversation.assigned_admin_id)
        : conversation.assigned_admin_id === currentUserId;
    }

    if (filter === "unassigned") {
      return !conversation.assigned_admin_id;
    }

    return true;
  }

  const filteredItems = useMemo(
    () => items.filter((conversation) => matchesAssignmentFilter(conversation, assignmentFilter)),
    [assignmentFilter, currentUserId, isAdmin, items]
  );

  const unreadCounts = useMemo(() => {
    return assignmentFilters.reduce<Record<AssignmentFilter, number>>(
      (counts, filter) => {
        counts[filter.value] = items.filter(
          (conversation) =>
            unreadIds.has(conversation.id) &&
            matchesAssignmentFilter(conversation, filter.value)
        ).length;
        return counts;
      },
      {
        all: 0,
        assigned: 0,
        unassigned: 0
      }
    );
  }, [currentUserId, isAdmin, items, unreadIds]);

  const emptyMessage =
    assignmentFilter === "assigned"
      ? "No assigned customer chats match this filter."
      : assignmentFilter === "unassigned"
        ? "No unassigned customer chats match this filter."
        : "New customer messages will appear here.";

  function filterHref(filter: AssignmentFilter) {
    return filter === "all" ? "/chat" : `/chat?assignment=${filter}`;
  }

  function conversationHref(conversationId: string) {
    const params = new URLSearchParams();
    params.set("conversation", conversationId);

    if (assignmentFilter === "all") {
      params.delete("assignment");
    } else {
      params.set("assignment", assignmentFilter);
    }

    return `/chat?${params.toString()}`;
  }

  async function markConversationRead(conversationId: string, readAt = new Date().toISOString()) {
    await supabase.from("chat_read_states").upsert(
      {
        conversation_id: conversationId,
        last_read_at: readAt,
        user_id: currentUserId
      },
      { onConflict: "user_id,conversation_id" }
    );
  }

  useEffect(() => {
    setItems(conversations);
    itemsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    setUnreadIds(new Set(initialUnreadConversationIds));
  }, [initialUnreadConversationIds]);

  useEffect(() => {
    setAssignmentFilter(initialAssignmentFilter);
  }, [initialAssignmentFilter]);

  useEffect(() => {
    const channel = supabase
      .channel("admin:chat-inbox")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        async (payload) => {
          const message = payload.new as Message;

          const preview = {
            body: message.body,
            image_url: message.image_url,
            sender_id: message.sender_id,
            created_at: message.created_at
          };

          const knownConversation = itemsRef.current.some(
            (conversation) => conversation.id === message.conversation_id
          );

          if (knownConversation) {
            setItems((current) => {
              const updated = current.map((conversation) =>
                conversation.id === message.conversation_id
                  ? {
                      ...conversation,
                      last_message_at: message.created_at,
                      latest_message: preview
                    }
                  : conversation
              );

              const sorted = updated.sort(
                (a, b) =>
                  new Date(b.last_message_at).getTime() -
                  new Date(a.last_message_at).getTime()
              );
              itemsRef.current = sorted;
              return sorted;
            });
          } else {
            const { data } = await supabase
              .from("conversations")
              .select("*, profiles:customer_id(email, full_name, phone), assigned_profile:assigned_admin_id(email, full_name)")
              .eq("id", message.conversation_id)
              .single<ConversationPreview>();

            if (data) {
              setItems((current) => {
                const sorted = [{ ...data, latest_message: preview }, ...current].sort(
                  (a, b) =>
                    new Date(b.last_message_at).getTime() -
                    new Date(a.last_message_at).getTime()
                );
                itemsRef.current = sorted;
                return sorted;
              });
            }
          }

          if (
            message.sender_id !== currentUserId &&
            message.conversation_id !== selectedConversationId
          ) {
            setUnreadIds((current) => new Set(current).add(message.conversation_id));
          } else if (message.conversation_id === selectedConversationId) {
            await markConversationRead(message.conversation_id, message.created_at);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations"
        },
        async (payload) => {
          const conversationId = (payload.new as ConversationPreview).id;
          const { data } = await supabase
            .from("conversations")
            .select("*, profiles:customer_id(email, full_name, phone), assigned_profile:assigned_admin_id(email, full_name)")
            .eq("id", conversationId)
            .maybeSingle<ConversationPreview>();

          if (!data) return;

          setItems((current) => {
            const updated = current.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, ...data }
                : conversation
            );
            itemsRef.current = updated;
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedConversationId, supabase]);

  useEffect(() => {
    if (!selectedConversationId) return;
    setUnreadIds((current) => {
      const next = new Set(current);
      next.delete(selectedConversationId);
      return next;
    });
    void markConversationRead(selectedConversationId);
  }, [selectedConversationId]);

  return (
    <aside className="chat-inbox" aria-label="Customer chat inbox">
      <div className="chat-inbox-header">
        <div className="chat-inbox-title-row">
          <h2>{isAdmin ? "Customer chats" : "Available chats"}</h2>
        </div>
        <div className="chat-inbox-filter" aria-label="Filter chats by assignment">
          {assignmentFilters.map((filter) => (
            <Link
              aria-current={assignmentFilter === filter.value ? "page" : undefined}
              className={assignmentFilter === filter.value ? "active" : ""}
              href={filterHref(filter.value)}
              key={filter.value}
            >
              {filter.label}
              {unreadCounts[filter.value] > 0 ? (
                <span className="chat-inbox-filter-count" aria-label={`${unreadCounts[filter.value]} new messages`}>
                  {unreadCounts[filter.value]}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
      <div className="chat-inbox-list">
        {filteredItems.length ? (
          filteredItems.map((conversation) => {
            const selected = conversation.id === selectedConversationId;
            const unread = unreadIds.has(conversation.id);
            const latestFromAdmin =
              conversation.latest_message?.sender_id === currentUserId;

            return (
              <Link
                className={[
                  "inbox-item",
                  selected ? "selected" : "",
                  unread ? "unread" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={conversationHref(conversation.id)}
                key={conversation.id}
              >
                <span className="inbox-icon">
                  {conversation.latest_message?.image_url ? (
                    <Image size={18} />
                  ) : (
                    <MessageCircle size={18} />
                  )}
                </span>
                <span className="inbox-copy">
                  <strong>{customerName(conversation)}</strong>
                  <small>
                    {latestFromAdmin ? "You: " : ""}
                    {previewText(conversation)}
                  </small>
                  <small className={conversation.assigned_admin_id ? "inbox-assignment" : "inbox-assignment unassigned"}>
                    {assignedAgentName(conversation)}
                  </small>
                </span>
                <span className="inbox-trailing">
                  <LocalTime value={conversation.last_message_at} />
                  {unread ? <span className="inbox-unread-dot" aria-label="Unread message" /> : null}
                  <ChevronRight aria-hidden="true" size={16} />
                </span>
              </Link>
            );
          })
        ) : (
          <p className="inbox-empty">{emptyMessage}</p>
        )}
      </div>
    </aside>
  );
}
