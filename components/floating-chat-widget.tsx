"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Maximize2, MessageCircle, Minus } from "lucide-react";
import { ChatRoom } from "@/components/chat-room";
import { GuestChatRoom } from "@/components/guest-chat-room";
import { createClient } from "@/lib/supabase-browser";
import type { ChatAssignmentInfo, Message, Profile } from "@/lib/types";

type Props = {
  currentUserId: string | null;
  conversationId: string | null;
  initialMessages: Message[];
  opensFullPage?: boolean;
};

export function FloatingChatWidget({
  currentUserId,
  conversationId,
  initialMessages,
  opensFullPage = false
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isChatPage = pathname === "/chat";
  const search = searchParams.toString();
  const [isOpen, setIsOpen] = useState(() => searchParams.get("chat") === "open");
  const [resolvedUserId, setResolvedUserId] = useState(currentUserId);
  const [resolvedConversationId, setResolvedConversationId] = useState(conversationId);
  const [resolvedMessages, setResolvedMessages] = useState(initialMessages);
  const [resolvedOpensFullPage, setResolvedOpensFullPage] = useState(opensFullPage);
  const [assignmentInfo, setAssignmentInfo] = useState<ChatAssignmentInfo | null>(null);
  const [chatStatus, setChatStatus] = useState<"idle" | "loading" | "ready" | "error">(
    currentUserId && (conversationId || opensFullPage) ? "ready" : "idle"
  );
  const [resolveAttempt, setResolveAttempt] = useState(0);
  const hasReadyChatRef = useRef(Boolean(currentUserId && (conversationId || opensFullPage)));

  const { openedPath, closedPath } = useMemo(() => {
    const openedParams = new URLSearchParams(search);
    const closedParams = new URLSearchParams(search);
    openedParams.set("chat", "open");
    closedParams.delete("chat");
    const openedQuery = openedParams.toString();
    const closedQuery = closedParams.toString();

    return {
      openedPath: openedQuery ? `${pathname}?${openedQuery}` : pathname,
      closedPath: closedQuery ? `${pathname}?${closedQuery}` : pathname
    };
  }, [pathname, search]);

  const returnTo = openedPath;
  const fullPageHref = `/chat?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    setIsOpen(searchParams.get("chat") === "open");
  }, [searchParams]);

  useEffect(() => {
    hasReadyChatRef.current =
      chatStatus === "ready" &&
      (resolvedOpensFullPage || Boolean(resolvedUserId && resolvedConversationId));
  }, [chatStatus, resolvedConversationId, resolvedOpensFullPage, resolvedUserId]);

  useEffect(() => {
    const hasServerChat = Boolean(currentUserId && (conversationId || opensFullPage));

    if (hasServerChat || !hasReadyChatRef.current) {
      setResolvedUserId(currentUserId);
      setResolvedConversationId(conversationId);
      setResolvedMessages(initialMessages);
      setResolvedOpensFullPage(opensFullPage);
      setChatStatus(hasServerChat ? "ready" : "idle");
    }
  }, [conversationId, currentUserId, initialMessages, opensFullPage]);

  useEffect(() => {
    let active = true;

    async function resolveSignedInChat() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setResolvedUserId(null);
        setResolvedConversationId(null);
        setResolvedMessages([]);
        setResolvedOpensFullPage(false);
        setAssignmentInfo(null);
        setChatStatus("idle");
        return;
      }

      if (!hasReadyChatRef.current) {
        setChatStatus("loading");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle<Profile>();

      if (profileError) throw profileError;
      if (!active) return;

      if (!profile || profile.disabled) {
        setResolvedUserId(null);
        setResolvedConversationId(null);
        setResolvedMessages([]);
        setResolvedOpensFullPage(false);
        setAssignmentInfo(null);
        setChatStatus("idle");
        return;
      }

      if (profile.role === "admin" || profile.role === "agent") {
        setResolvedUserId(user.id);
        setResolvedConversationId(null);
        setResolvedMessages([]);
        setResolvedOpensFullPage(true);
        setAssignmentInfo(null);
        setChatStatus("ready");
        return;
      }

      const { data: customerChat, error: chatError } = await supabase.rpc("current_customer_chat");

      if (!active) return;
      if (chatError) throw chatError;

      const chatInfo = (Array.isArray(customerChat) ? customerChat[0] : customerChat) as
        | ChatAssignmentInfo
        | null
        | undefined;
      const conversationId = chatInfo?.conversation_id ?? null;

      const { data: messages, error: messagesError } = conversationId
        ? await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true })
            .returns<Message[]>()
        : { data: [] as Message[], error: null };

      if (messagesError) throw messagesError;
      if (!active) return;

      setResolvedUserId(user.id);
      setResolvedConversationId(conversationId);
      setResolvedMessages(messages ?? []);
      setResolvedOpensFullPage(false);
      setAssignmentInfo(chatInfo ?? null);
      setChatStatus("ready");
    }

    function handleResolveError() {
      if (!active || hasReadyChatRef.current) return;
      setResolvedUserId(null);
      setResolvedConversationId(null);
      setResolvedMessages([]);
      setResolvedOpensFullPage(false);
      setAssignmentInfo(null);
      setChatStatus("error");
    }

    resolveSignedInChat().catch(handleResolveError);

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        resolveSignedInChat().catch(handleResolveError);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveAttempt, supabase]);

  useEffect(() => {
    if (!resolvedUserId || !resolvedConversationId || resolvedOpensFullPage) return;

    let active = true;

    async function refreshAssignment() {
      const { data, error } = await supabase.rpc("current_customer_chat");
      if (!active || error) return;

      const nextInfo = (Array.isArray(data) ? data[0] : data) as ChatAssignmentInfo | null | undefined;
      if (!nextInfo) return;

      setAssignmentInfo(nextInfo);
    }

    const channel = supabase
      .channel(`conversation-assignment:${resolvedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${resolvedConversationId}`
        },
        () => {
          refreshAssignment().catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [resolvedConversationId, resolvedOpensFullPage, resolvedUserId, supabase]);

  function toggleChat(open: boolean) {
    setIsOpen(open);
    window.history.replaceState(null, "", open ? openedPath : closedPath);
  }

  if (isChatPage) return null;

  if (resolvedOpensFullPage) {
    return (
      <Link className="floating-chat-button" href="/chat" aria-label="Open support chat">
        <MessageCircle aria-hidden="true" size={24} strokeWidth={2.5} />
        <span>Chat</span>
      </Link>
    );
  }

  return (
    <>
      <button
        className="floating-chat-button"
        type="button"
        onClick={() => toggleChat(true)}
        aria-label="Open support chat"
        data-open={isOpen}
      >
        <MessageCircle aria-hidden="true" size={24} strokeWidth={2.5} />
        <span>Chat</span>
      </button>

      <aside className="floating-chat-panel" aria-label="Support chat" data-open={isOpen}>
        {chatStatus === "loading" ? (
          <section className="floating-chat-auth-body">
            <p>Loading your support chat...</p>
          </section>
        ) : chatStatus === "error" ? (
          <section className="floating-chat-auth-body">
            <p>Support chat could not load.</p>
            <button type="button" onClick={() => setResolveAttempt((attempt) => attempt + 1)}>
              Try again
            </button>
          </section>
        ) : resolvedUserId ? (
          <ChatRoom
            conversationId={resolvedConversationId}
            currentUserId={resolvedUserId}
            initialMessages={resolvedMessages}
            agentName={assignmentInfo?.assigned_agent_name ?? null}
            onConversationReady={(conversationId, nextAssignmentInfo) => {
              setResolvedConversationId(conversationId);
              setAssignmentInfo({
                conversation_id: conversationId,
                assigned_agent_id: null,
                assigned_agent_name: nextAssignmentInfo?.assigned_agent_name ?? null
              });
            }}
            actions={
              <>
                <Link className="chat-icon-button" href={fullPageHref} aria-label="Open full page chat">
                  <Maximize2 aria-hidden="true" size={18} />
                </Link>
                <button
                  className="chat-icon-button"
                  type="button"
                  onClick={() => toggleChat(false)}
                  aria-label="Minimize chat"
                >
                  <Minus aria-hidden="true" size={22} strokeWidth={2.75} />
                </button>
              </>
            }
          />
        ) : (
          <GuestChatRoom
            actions={
              <button
                className="chat-icon-button"
                type="button"
                onClick={() => toggleChat(false)}
                aria-label="Minimize chat"
              >
                <Minus aria-hidden="true" size={22} strokeWidth={2.75} />
              </button>
            }
          />
        )}
      </aside>
    </>
  );
}
