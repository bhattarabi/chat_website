import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { FloatingChatWidget } from "@/components/floating-chat-widget";
import type { Conversation, Message, Profile } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raven Jackpots",
  description: "Mobile-friendly customer portal with Supabase auth and realtime chat."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>()
    : { data: null };

  let conversation: Conversation | null = null;
  let messages: Message[] = [];

  if (user && profile?.role === "customer" && !profile.disabled) {
    const { data: chat } = await supabase.rpc("current_customer_chat");
    const conversationId = Array.isArray(chat) ? chat[0]?.conversation_id : chat?.conversation_id;
    const { data: currentConversation } = conversationId
      ? await supabase
          .from("conversations")
          .select("*")
          .eq("id", conversationId)
          .maybeSingle<Conversation>()
      : { data: null };
    conversation = currentConversation;

    const { data } = conversation
      ? await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true })
          .returns<Message[]>()
      : { data: [] };

    messages = data ?? [];
  }

  return (
    <html lang="en">
      <body>
        {children}
        <Suspense fallback={null}>
          <FloatingChatWidget
            currentUserId={user && profile && !profile.disabled ? user.id : null}
            conversationId={conversation?.id ?? null}
            initialMessages={messages}
            opensFullPage={profile?.role === "admin" || profile?.role === "agent"}
          />
        </Suspense>
      </body>
    </html>
  );
}
