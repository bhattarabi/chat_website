"use client";

import { Fragment, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ImagePlus, Send } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { LocalTime } from "@/components/local-time";
import type { Message } from "@/lib/types";

type Props = {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  agentName?: string | null;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
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
  agentName,
  title = "Support chat",
  subtitle = "",
  actions
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [conversationId, initialMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages((current) => {
            const next = payload.new as Message;
            return current.some((message) => message.id === next.id) ? current : [...current, next];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() && !file) return;
    const form = event.currentTarget;
    setSending(true);

    try {
      let imagePath: string | null = null;
      let imageUrl: string | null = null;

      if (file) {
        const extension = file.name.split(".").pop() || "jpg";
        imagePath = `${conversationId}/${crypto.randomUUID()}.${extension}`;
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
        conversation_id: conversationId,
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
        <div className="chat-header-copy">
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {agentName !== undefined ? (
            <p className="chat-agent-label">
              <strong>Agent: {agentName || "Waiting for assignment"}</strong>
            </p>
          ) : null}
        </div>
        {actions ? <div className="chat-header-actions">{actions}</div> : null}
      </div>
      <div className="messages" aria-live="polite">
        {messages.map((message, index) => {
          const mine = message.sender_id === currentUserId;
          const system = message.sender_type === "system";
          const timeZone = mounted ? undefined : "UTC";
          const messageDateKey = getDateKey(message.created_at, timeZone);
          const previousMessage = messages[index - 1];
          const previousDateKey = previousMessage ? getDateKey(previousMessage.created_at, timeZone) : null;
          const showDateSeparator = messageDateKey !== previousDateKey;

          return (
            <Fragment key={message.id}>
              {showDateSeparator ? (
                <time className="chat-date-separator" dateTime={message.created_at}>
                  {formatDateLabel(message.created_at, timeZone)}
                </time>
              ) : null}
              {system ? (
                <p className="chat-assignment-notice">
                  <LocalTime value={message.created_at} />
                  <span>{message.body}</span>
                </p>
              ) : (
                <article className={mine ? "message mine" : "message"}>
                  {message.body ? <p>{message.body}</p> : null}
                  {message.image_url ? <img src={message.image_url} alt="Chat attachment" /> : null}
                  <LocalTime value={message.created_at} />
                </article>
              )}
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
