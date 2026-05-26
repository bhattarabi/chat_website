"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Maximize2, MessageCircle, Minus, X } from "lucide-react";
import { ChatRoom } from "@/components/chat-room";
import type { Message } from "@/lib/types";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isChatPage = pathname === "/chat";
  const isOpen = searchParams.get("chat") === "open";
  const openedParams = new URLSearchParams(searchParams);
  const closedParams = new URLSearchParams(searchParams);
  openedParams.set("chat", "open");
  closedParams.delete("chat");
  const openedPath = `${pathname}?${openedParams.toString()}`;
  const closedQuery = closedParams.toString();
  const closedPath = closedQuery ? `${pathname}?${closedQuery}` : pathname;
  const returnTo = openedPath;
  const fullPageHref = `/chat?returnTo=${encodeURIComponent(returnTo)}`;

  if (isChatPage) return null;

  if (opensFullPage) {
    return (
      <Link className="floating-chat-button" href="/chat" aria-label="Open support chat">
        <MessageCircle aria-hidden="true" size={24} strokeWidth={2.5} />
        <span>Chat</span>
      </Link>
    );
  }

  if (!isOpen) {
    return (
      <Link className="floating-chat-button" href={openedPath} aria-label="Open support chat">
        <MessageCircle aria-hidden="true" size={24} strokeWidth={2.5} />
        <span>Chat</span>
      </Link>
    );
  }

  return (
    <aside className="floating-chat-panel" aria-label="Support chat">
      {currentUserId && conversationId ? (
        <ChatRoom
          conversationId={conversationId}
          currentUserId={currentUserId}
          initialMessages={initialMessages}
          actions={
            <>
              <Link className="chat-icon-button" href={fullPageHref} aria-label="Open full page chat">
                <Maximize2 aria-hidden="true" size={18} />
              </Link>
              <Link className="chat-icon-button" href={closedPath} aria-label="Minimize chat">
                <Minus aria-hidden="true" size={18} />
              </Link>
            </>
          }
        />
      ) : (
        <section className="chat-shell floating-chat-auth">
          <div className="chat-header">
            <div>
              <h1>Support chat</h1>
              <p>
                {currentUserId
                  ? "Open the full chat page to manage customer conversations."
                  : "Log in or create an account to message support."}
              </p>
            </div>
            <Link className="chat-icon-button" href={closedPath} aria-label="Close chat">
              <X aria-hidden="true" size={18} />
            </Link>
          </div>
          <div className="floating-chat-auth-body">
            <Link className="button" href={currentUserId ? "/chat" : "/auth"}>
              {currentUserId ? "Open Chat" : "Login / Register"}
            </Link>
          </div>
        </section>
      )}
    </aside>
  );
}
