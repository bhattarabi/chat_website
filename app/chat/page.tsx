import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { Conversation, Message, Profile } from "@/lib/types";
import { ChatRoom } from "@/components/chat-room";

type Props = {
  searchParams: Promise<{ conversation?: string }>;
};

export default async function ChatPage({ searchParams }: Props) {
  const { conversation: selectedConversationId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || profile.disabled) redirect("/auth");

  let conversation: Conversation | null = null;

  if (profile.role === "customer") {
    const existing = await supabase
      .from("conversations")
      .select("*")
      .eq("customer_id", user.id)
      .maybeSingle<Conversation>();

    if (existing.data) {
      conversation = existing.data;
    } else {
      const created = await supabase
        .from("conversations")
        .insert({ customer_id: user.id })
        .select("*")
        .single<Conversation>();
      conversation = created.data;
    }
  } else {
    const query = supabase.from("conversations").select("*");
    const first = selectedConversationId
      ? await query.eq("id", selectedConversationId).maybeSingle<Conversation>()
      : await query.order("last_message_at", { ascending: false }).limit(1).maybeSingle<Conversation>();
    conversation = first.data;
  }

  const { data: messages } = conversation
    ? await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .returns<Message[]>()
    : { data: [] };

  return (
    <main className="app-shell chat-page">
      <header className="app-header">
        <Link href="/dashboard" className="brand">
          Support Portal
        </Link>
        <nav>
          {profile.role === "admin" ? <Link href="/admin">Admin</Link> : null}
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>
      {conversation ? (
        <ChatRoom
          conversationId={conversation.id}
          currentUserId={user.id}
          initialMessages={messages ?? []}
        />
      ) : (
        <section className="empty-state">
          <h1>No customer chats yet</h1>
          <p>New customer messages will appear here as conversations are created.</p>
        </section>
      )}
    </main>
  );
}
