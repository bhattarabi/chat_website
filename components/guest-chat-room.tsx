"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MessageCircle, Send } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { LocalTime } from "@/components/local-time";
import type { ChatAssignmentInfo, Message } from "@/lib/types";

type Props = {
  agentName?: string | null;
  actions?: ReactNode;
};

type GuestSession = {
  conversationId: string;
  email: string;
  name: string;
  token: string;
};

const storageKey = "guest-support-chat";
const messageRefreshMs = 900;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function GuestChatRoom({ agentName, actions }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<GuestSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [resolvedAgentName, setResolvedAgentName] = useState<string | null>(agentName ?? null);
  const [status, setStatus] = useState<"idle" | "loading" | "sending">("idle");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const visibleMessages = messages.filter((message) => message.sender_type !== "system");

  async function loadMessages(nextSession: GuestSession) {
    const { data, error: fetchError } = await supabase.rpc("guest_chat_messages", {
      chat_conversation_id: nextSession.conversationId,
      guest_token: nextSession.token
    });

    if (fetchError) throw fetchError;
    setMessages((data ?? []) as Message[]);
  }

  async function loadAssignment(nextSession: GuestSession) {
    const { data, error: detailsError } = await supabase.rpc("guest_chat_details", {
      chat_conversation_id: nextSession.conversationId,
      guest_token: nextSession.token
    });

    if (detailsError) throw detailsError;

    const details = (Array.isArray(data) ? data[0] : data) as ChatAssignmentInfo | null | undefined;
    const nextName = details?.assigned_agent_name ?? null;

    setResolvedAgentName(nextName);
  }

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as GuestSession;
      if (!parsed.conversationId || !parsed.token) return;
      setSession(parsed);
      setName(parsed.name);
      setEmail(parsed.email);
      Promise.all([loadMessages(parsed), loadAssignment(parsed)]).catch(() => {
        window.localStorage.removeItem(storageKey);
        setSession(null);
        setResolvedAgentName(null);
      });
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    const interval = window.setInterval(() => {
      loadMessages(session).catch(() => undefined);
      loadAssignment(session).catch(() => undefined);
    }, messageRefreshMs);

    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const activeSession = session;

    function refreshWhenActive() {
      if (document.visibilityState === "visible") {
        loadMessages(activeSession).catch(() => undefined);
        loadAssignment(activeSession).catch(() => undefined);
      }
    }

    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [session]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName || !isValidEmail(normalizedEmail)) {
      setError("Enter your name and a valid email.");
      return;
    }

    const token = crypto.randomUUID();
    setStatus("loading");
    setError("");

    try {
      const { data, error: startError } = await supabase.rpc("start_guest_chat", {
        guest_email: normalizedEmail,
        guest_name: trimmedName,
        guest_token: token
      });

      if (startError) throw startError;

      const conversationId = Array.isArray(data)
        ? data[0]?.conversation_id
        : data?.conversation_id;

      if (!conversationId) throw new Error("Could not start guest chat.");

      const nextSession = {
        conversationId,
        email: normalizedEmail,
        name: trimmedName,
        token
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
      setSession(nextSession);
      await Promise.all([loadMessages(nextSession), loadAssignment(nextSession)]);
    } catch {
      setError("Chat is unavailable right now. Please try again.");
    } finally {
      setStatus("idle");
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !body.trim()) return;

    setStatus("sending");
    setError("");

    try {
      const { error: sendError } = await supabase.rpc("send_guest_message", {
        chat_conversation_id: session.conversationId,
        guest_token: session.token,
        message_body: body.trim()
      });

      if (sendError) throw sendError;

      setBody("");
      await loadMessages(session);
    } catch {
      setError("Message could not be sent. Please try again.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="chat-shell guest-chat">
      <div className="chat-header">
        <div className="chat-header-copy">
          <span className="chat-header-icon" aria-hidden="true">
            <MessageCircle size={20} />
          </span>
          <div>
            <h1>Support chat</h1>
          </div>
        </div>
        {actions ? <div className="chat-header-actions">{actions}</div> : null}
      </div>

      {session ? (
        <>
          <div className="messages" aria-live="polite">
            {visibleMessages.map((message) =>
              <article
                className={message.sender_type === "guest" ? "message mine" : "message"}
                key={message.id}
              >
                {message.body ? <p>{message.body}</p> : null}
                <LocalTime value={message.created_at} />
              </article>
            )}
            <div ref={endRef} />
          </div>
          <form className="composer guest-composer" onSubmit={handleSend}>
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Type a message"
            />
            <button type="submit" disabled={status === "sending"} title="Send message">
              <Send size={18} />
            </button>
          </form>
          {error ? <p className="guest-chat-error">{error}</p> : null}
        </>
      ) : (
        <form className="guest-chat-form" onSubmit={handleStart}>
          <label>
            Name
            <input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {error ? <p className="guest-chat-error">{error}</p> : null}
          <button type="submit" disabled={status === "loading"}>
            Start chat
          </button>
        </form>
      )}
    </section>
  );
}
