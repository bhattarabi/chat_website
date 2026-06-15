import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Minimize2 } from "lucide-react";
import { StaffAppHeader } from "@/components/staff-app-header";
import { createClient } from "@/lib/supabase-server";
import type { ChatReadState, Conversation, ConversationPreview, Message, Profile } from "@/lib/types";
import { AdminChatInbox } from "@/components/admin-chat-inbox";
import { ChatRoom } from "@/components/chat-room";

type Props = {
  searchParams: Promise<{ conversation?: string; returnTo?: string }>;
};

function conversationTitle(conversation: ConversationPreview | Conversation) {
  if ("profiles" in conversation && conversation.profiles) {
    return conversation.profiles.full_name || conversation.profiles.email;
  }

  return conversation.guest_name || conversation.guest_email || "Customer chat";
}

function conversationSubtitle(conversation: ConversationPreview | Conversation) {
  return (
    "profiles" in conversation && conversation.profiles?.phone
      ? `Phone: ${conversation.profiles.phone}`
      : conversation.guest_email
        ? `Guest: ${conversation.guest_email}`
        : ""
  );
}

export default async function ChatPage({ searchParams }: Props) {
  const { conversation: selectedConversationId, returnTo } = await searchParams;
  const popupHref = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/?chat=open";
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
  let initialUnreadConversationIds: string[] = [];
  const isChatStaff = profile.role === "admin" || profile.role === "agent";

  if (profile.role === "customer") {
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
  } else if (isChatStaff) {
    const [{ data: adminConversations }, { data: latestMessages }] = await Promise.all([
      supabase
        .from("conversations")
        .select("*, profiles:customer_id(email, full_name, phone)")
        .order("last_message_at", { ascending: false })
        .returns<ConversationPreview[]>(),
      supabase
        .from("messages")
        .select("*, sender_profile:sender_id(email, full_name, role)")
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

    const conversationIds = conversations.map((item) => item.id);
    const { data: readStates } = conversationIds.length
      ? await supabase
          .from("chat_read_states")
          .select("*")
          .eq("user_id", user.id)
          .in("conversation_id", conversationIds)
          .returns<ChatReadState[]>()
      : { data: [] as ChatReadState[] };
    const lastReadByConversation = new Map(
      (readStates ?? []).map((state) => [
        state.conversation_id,
        new Date(state.last_read_at).getTime()
      ])
    );
    initialUnreadConversationIds = conversations
      .filter((item) => {
        if (!item.latest_message || item.latest_message.sender_id === user.id) return false;
        const lastReadAt = lastReadByConversation.get(item.id) ?? 0;
        return new Date(item.latest_message.created_at).getTime() > lastReadAt;
      })
      .map((item) => item.id);

    conversation =
      conversations.find((item) => item.id === selectedConversationId) ??
      conversations[0] ??
      null;
  }

  const { data: messages } = conversation
    ? await supabase
        .from("messages")
        .select("*, sender_profile:sender_id(email, full_name, role)")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .returns<Message[]>()
    : { data: [] };

  return (
    <main className="app-shell chat-page">
      <StaffAppHeader showAdmin={profile.role === "admin"} />
      {isChatStaff ? (
        <section className={`admin-chat-layout${selectedConversationId ? " show-chat-detail" : ""}`}>
          <AdminChatInbox
            conversations={conversations}
            initialUnreadConversationIds={initialUnreadConversationIds}
            selectedConversationId={selectedConversationId ? conversation?.id ?? null : null}
            currentUserId={user.id}
          />
          <div className="staff-chat-detail">
            {conversation ? (
              <ChatRoom
                conversationId={conversation.id}
                currentUserId={user.id}
                initialMessages={messages ?? []}
                showAgentNames
                leadingActions={
                  <Link className="chat-icon-button mobile-chat-list" href="/chat" aria-label="Back to chat list">
                    <ArrowLeft aria-hidden="true" size={18} />
                  </Link>
                }
                actions={
                  <Link className="chat-icon-button" href={popupHref} aria-label="Switch to popup chat">
                    <Minimize2 aria-hidden="true" size={18} />
                  </Link>
                }
                title={conversationTitle(conversation)}
                subtitle={conversationSubtitle(conversation)}
              />
            ) : (
              <section className="empty-state">
                <h1>No customer chats yet</h1>
                <p>New customer messages will appear here as conversations are created.</p>
              </section>
            )}
          </div>
        </section>
      ) : (
        <ChatRoom
          conversationId={conversation?.id ?? null}
          currentUserId={user.id}
          initialMessages={messages ?? []}
          actions={
            <Link className="chat-icon-button" href={popupHref} aria-label="Switch to popup chat">
              <Minimize2 aria-hidden="true" size={18} />
            </Link>
          }
        />
      )}
    </main>
  );
}
