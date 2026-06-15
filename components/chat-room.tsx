"use client";

import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ImagePlus, MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { LocalTime } from "@/components/local-time";
import type { Message } from "@/lib/types";

type Props = {
  conversationId: string | null;
  currentUserId: string;
  initialMessages: Message[];
  showAgentNames?: boolean;
  title?: string;
  subtitle?: string;
  leadingActions?: ReactNode;
  actions?: ReactNode;
  onConversationReady?: (conversationId: string) => void;
};

function getDateParts(value: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(new Date(value));

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "",
    month: parts.find((part) => part.type === "month")?.value ?? "",
    year: parts.find((part) => part.type === "year")?.value ?? ""
  };
}

function getDateKey(value: string, timeZone?: string) {
  const { day, month, year } = getDateParts(value, timeZone);
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone,
    year: "numeric"
  }).format(new Date(value));
}

export function ChatRoom({
  conversationId,
  currentUserId,
  initialMessages,
  showAgentNames = false,
  title = "Support chat",
  subtitle = "",
  leadingActions,
  actions,
  onConversationReady
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [freshMessageIds, setFreshMessageIds] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement | null>(null);
  const visibleMessages = messages.filter((message) => message.sender_type !== "system");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveConversationId(conversationId);
    setMessages(initialMessages);
  }, [conversationId, initialMessages]);

  useEffect(() => {
    if (!activeConversationId) return;

    const channel = supabase
      .channel(`conversation:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`
        },
        async (payload) => {
          const next = payload.new as Message;
          if (showAgentNames && next.sender_id) {
            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("email, full_name, role")
              .eq("id", next.sender_id)
              .maybeSingle<NonNullable<Message["sender_profile"]>>();
            next.sender_profile = senderProfile ?? null;
          }

          setMessages((current) => {
            return current.some((message) => message.id === next.id) ? current : [...current, next];
          });

          if (next.sender_id !== currentUserId) {
            setFreshMessageIds((current) => new Set(current).add(next.id));
            window.setTimeout(() => {
              setFreshMessageIds((current) => {
                const updated = new Set(current);
                updated.delete(next.id);
                return updated;
              });
            }, 1800);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, currentUserId, showAgentNames, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() && !file) return;
    const form = event.currentTarget;
    setSending(true);

    try {
      let messageConversationId = activeConversationId;

      if (!messageConversationId) {
        const { data: chat, error: chatError } = await supabase.rpc("ensure_customer_chat");
        if (chatError) throw chatError;

        const chatInfo = Array.isArray(chat) ? chat[0] : chat;
        messageConversationId = chatInfo?.conversation_id ?? null;

        if (!messageConversationId) {
          throw new Error("Could not start support chat.");
        }

        setActiveConversationId(messageConversationId);
        onConversationReady?.(messageConversationId);
      }

      let imagePath: string | null = null;
      let imageUrl: string | null = null;

      if (file) {
        const extension = file.name.split(".").pop() || "jpg";
        imagePath = `${messageConversationId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(imagePath, file, { upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from("chat-attachments").getPublicUrl(imagePath);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: messageConversationId,
        sender_id: currentUserId,
        body: body.trim() || null,
        image_path: imagePath,
        image_url: imageUrl
      });

      if (error) {
        throw error;
      }

      setBody("");
      setFile(null);
      form.reset();
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="chat-shell">
      <div className="chat-header">
        {leadingActions ? <div className="chat-header-leading-actions">{leadingActions}</div> : null}
        <div className="chat-header-copy">
          <span className="chat-header-icon" aria-hidden="true">
            <MessageCircle size={20} />
          </span>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        {actions ? <div className="chat-header-actions">{actions}</div> : null}
      </div>
      <div className="messages" aria-live="polite">
        {visibleMessages.map((message, index) => {
          const mine = message.sender_id === currentUserId;
          const sentByStaff =
            mine ||
            (showAgentNames &&
              (message.sender_profile?.role === "agent" || message.sender_profile?.role === "admin"));
          const agentSender =
            showAgentNames &&
            message.sender_type === "user" &&
            (message.sender_profile?.role === "agent" || message.sender_profile?.role === "admin")
              ? message.sender_profile.full_name || message.sender_profile.email
              : null;
          const timeZone = mounted ? undefined : "UTC";
          const messageDateKey = getDateKey(message.created_at, timeZone);
          const previousMessage = visibleMessages[index - 1];
          const previousDateKey = previousMessage ? getDateKey(previousMessage.created_at, timeZone) : null;
          const showDateSeparator = messageDateKey !== previousDateKey;

          return (
            <Fragment key={message.id}>
              {showDateSeparator ? (
                <time className="chat-date-separator" dateTime={message.created_at}>
                  {formatDateLabel(message.created_at, timeZone)}
                </time>
              ) : null}
              <article className={`message${sentByStaff ? " mine" : ""}${freshMessageIds.has(message.id) ? " incoming-new" : ""}`}>
                {agentSender ? <strong className="message-agent-name">{agentSender}</strong> : null}
                {message.body ? <p>{message.body}</p> : null}
                {message.image_url ? <img src={message.image_url} alt="Chat attachment" /> : null}
                <LocalTime value={message.created_at} />
              </article>
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={handleSubmit}>
        <label className="file-picker" title="Attach image">
          <ImagePlus size={20} />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={file ? `Attached: ${file.name}` : "Type a message"}
        />
        <button type="submit" disabled={sending} title="Send message">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
