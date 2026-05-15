"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Send } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { LocalTime } from "@/components/local-time";
import type { Message } from "@/lib/types";

type Props = {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  title?: string;
  subtitle?: string;
};

export function ChatRoom({
  conversationId,
  currentUserId,
  initialMessages,
  title = "Support chat",
  subtitle = "Messages appear instantly. Attach screenshots or photos when helpful."
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

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
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="messages" aria-live="polite">
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          return (
            <article className={mine ? "message mine" : "message"} key={message.id}>
              {message.body ? <p>{message.body}</p> : null}
              {message.image_url ? <img src={message.image_url} alt="Chat attachment" /> : null}
              <LocalTime value={message.created_at} />
            </article>
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
