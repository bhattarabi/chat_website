import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { Conversation, ConversationPreview, Message, Profile } from "@/lib/types";
import { AdminChatInbox } from "@/components/admin-chat-inbox";
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

  let conversation: ConversationPreview | Conversation | null = null;
  let conversations: ConversationPreview[] = [];

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
    const [{ data: adminConversations }, { data: latestMessages }] = await Promise.all([
      supabase
        .from("conversations")
        .select("*, profiles:customer_id(email, full_name, phone)")
        .order("last_message_at", { ascending: false })
        .returns<ConversationPreview[]>(),
      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<Message[]>()
    ]);

    const latestByConversation = new Map<string, Message>();
    for (const message of latestMessages ?? []) {
      if (!latestByConversation.has(message.conversation_id)) {
        latestByConversation.set(message.conversation_id, message);
      }
    }

    conversations = (adminConversations ?? []).map((item) => ({
      ...item,
      latest_message: latestByConversation.get(item.id) ?? null
    }));

    conversation =
      conversations.find((item) => item.id === selectedConversationId) ??
      conversations[0] ??
      null;
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
      {profile.role === "admin" ? (
        <section className="admin-chat-layout">
          <AdminChatInbox
            conversations={conversations}
            selectedConversationId={conversation?.id ?? null}
            currentUserId={user.id}
          />
          {conversation ? (
            <ChatRoom
              conversationId={conversation.id}
              currentUserId={user.id}
              initialMessages={messages ?? []}
              title={
                "profiles" in conversation && conversation.profiles
                  ? conversation.profiles.full_name || conversation.profiles.email
                  : "Customer chat"
              }
              subtitle={
                "profiles" in conversation && conversation.profiles?.phone
                  ? `Phone: ${conversation.profiles.phone}`
                  : "Reply to this customer while tracking other chats in the inbox."
              }
            />
          ) : (
            <section className="empty-state">
              <h1>No customer chats yet</h1>
              <p>New customer messages will appear here as conversations are created.</p>
            </section>
          )}
        </section>
      ) : conversation ? (
        <ChatRoom conversationId={conversation.id} currentUserId={user.id} initialMessages={messages ?? []} />
      ) : (
        <section className="empty-state">
          <h1>No customer chats yet</h1>
          <p>New customer messages will appear here as conversations are created.</p>
        </section>
      )}
    </main>
  );
}
