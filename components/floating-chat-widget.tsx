"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Maximize2, MessageCircle, Minus } from "lucide-react";
import { ChatRoom } from "@/components/chat-room";
import { GuestChatRoom } from "@/components/guest-chat-room";
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
  const search = searchParams.toString();
  const [isOpen, setIsOpen] = useState(() => searchParams.get("chat") === "open");

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

  function toggleChat(open: boolean) {
    setIsOpen(open);
    window.history.replaceState(null, "", open ? openedPath : closedPath);
  }

  if (isChatPage) return null;

  if (opensFullPage) {
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
