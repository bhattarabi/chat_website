"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Image, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { LocalTime } from "@/components/local-time";
import type { ConversationPreview, Message } from "@/lib/types";

type Props = {
  conversations: ConversationPreview[];
  selectedConversationId: string | null;
  currentUserId: string;
  isAdmin: boolean;
};

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
  selectedConversationId,
  currentUserId,
  isAdmin
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(conversations);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const itemsRef = useRef(conversations);

  useEffect(() => {
    setItems(conversations);
    itemsRef.current = conversations;
  }, [conversations]);

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
  }, [selectedConversationId]);

  return (
    <aside className="chat-inbox" aria-label="Customer chat inbox">
      <div className="chat-inbox-header">
        <h2>{isAdmin ? "Customer chats" : "Available chats"}</h2>
        <span>{items.length}</span>
      </div>
      <div className="chat-inbox-list">
        {items.length ? (
          items.map((conversation) => {
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
                href={`/chat?conversation=${conversation.id}`}
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
          <p className="inbox-empty">New customer messages will appear here.</p>
        )}
      </div>
    </aside>
  );
}
