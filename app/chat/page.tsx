import Link from "next/link";
import { redirect } from "next/navigation";
import { Minimize2 } from "lucide-react";
import { updateChatAssignment } from "@/app/admin/actions";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase-server";
import type { Conversation, ConversationPreview, Message, Profile } from "@/lib/types";
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
  const contact =
    "profiles" in conversation && conversation.profiles?.phone
      ? `Phone: ${conversation.profiles.phone}`
      : conversation.guest_email
        ? `Guest: ${conversation.guest_email}`
        : null;
  const assignment = conversation.assigned_profile
    ? `Assigned to ${conversation.assigned_profile.full_name || conversation.assigned_profile.email}`
    : "Unassigned";

  return contact ? `${contact} - ${assignment}` : assignment;
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
  let agents: Profile[] = [];
  const isChatStaff = profile.role === "admin" || profile.role === "agent";

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
  } else if (isChatStaff) {
    const [{ data: adminConversations }, { data: latestMessages }, { data: activeAgents }] = await Promise.all([
      supabase
        .from("conversations")
        .select("*, profiles:customer_id(email, full_name, phone), assigned_profile:assigned_admin_id(email, full_name)")
        .order("last_message_at", { ascending: false })
        .returns<ConversationPreview[]>(),
      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200)
        .returns<Message[]>(),
      profile.role === "admin"
        ? supabase
            .from("profiles")
            .select("*")
            .eq("role", "agent")
            .eq("disabled", false)
            .order("full_name")
            .returns<Profile[]>()
        : Promise.resolve({ data: [] as Profile[] })
    ]);
    agents = activeAgents ?? [];

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
        <Link href="/" className="brand">
          Game Links Galore
        </Link>
        <nav>
          {profile.role === "admin" ? (
            <Link className="button" href="/admin">
              Admin
            </Link>
          ) : null}
          <Link className="button" href="/dashboard">
            Account
          </Link>
          <form action={signOut}>
            <button type="submit">Logout</button>
          </form>
        </nav>
      </header>
      {isChatStaff ? (
        <section className="admin-chat-layout">
          <AdminChatInbox
            conversations={conversations}
            selectedConversationId={conversation?.id ?? null}
            currentUserId={user.id}
            isAdmin={profile.role === "admin"}
          />
          {conversation ? (
            <ChatRoom
              conversationId={conversation.id}
              currentUserId={user.id}
              initialMessages={messages ?? []}
              actions={
                <>
                  {profile.role === "admin" ? (
                    <form action={updateChatAssignment} className="chat-assignment-form">
                      <input type="hidden" name="conversation_id" value={conversation.id} />
                      <select
                        name="assigned_admin_id"
                        aria-label="Assigned chat agent"
                        defaultValue={conversation.assigned_admin_id ?? ""}
                      >
                        <option value="">Unassigned</option>
                        {agents.map((agent) => (
                          <option value={agent.id} key={agent.id}>
                            {agent.full_name || agent.email}
                          </option>
                        ))}
                      </select>
                      <button type="submit">Assign</button>
                    </form>
                  ) : null}
                  <Link className="chat-icon-button" href={popupHref} aria-label="Switch to popup chat">
                    <Minimize2 aria-hidden="true" size={18} />
                  </Link>
                </>
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
        </section>
      ) : conversation ? (
        <ChatRoom
          conversationId={conversation.id}
          currentUserId={user.id}
          initialMessages={messages ?? []}
          actions={
            <Link className="chat-icon-button" href={popupHref} aria-label="Switch to popup chat">
              <Minimize2 aria-hidden="true" size={18} />
            </Link>
          }
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
