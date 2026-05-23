import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, Trash2 } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase-server";
import type { Announcement, Conversation, PlatformLink, Profile } from "@/lib/types";
import {
  deletePlatformLink,
  saveAnnouncement,
  savePlatformLink,
  updateUserStatus
} from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (currentProfile?.role !== "admin" || currentProfile.disabled) redirect("/dashboard");

  const [{ data: links }, { data: users }, { data: announcements }, { data: conversations }] =
    await Promise.all([
      supabase.from("platform_links").select("*").order("sort_order").returns<PlatformLink[]>(),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).returns<Profile[]>(),
      supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8)
        .returns<Announcement[]>(),
      supabase
        .from("conversations")
        .select("*, profiles:customer_id(email, full_name, phone)")
        .order("last_message_at", { ascending: false })
        .returns<Conversation[]>()
    ]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <Link href="/" className="brand">
          Game Links Galore
        </Link>
        <nav>
          <Link className="button" href="/admin">
            Admin
          </Link>
          <Link className="button" href="/chat">
            Support
          </Link>
          <Link className="button" href="/dashboard">
            Account
          </Link>
          <form action={signOut}>
            <button type="submit">Logout</button>
          </form>
        </nav>
      </header>

      <section className="admin-grid">
        <div className="admin-main">
          <section className="admin-section">
            <h1>Platform links</h1>
            <form action={savePlatformLink} className="inline-form">
              <input name="title" placeholder="Title" required />
              <input name="url" type="url" placeholder="https://..." required />
              <input name="description" placeholder="Description" />
              <input name="button_label" placeholder="Button" />
              <input name="sort_order" type="number" placeholder="Order" />
              <label className="check-row">
                <input name="active" type="checkbox" defaultChecked />
                Active
              </label>
              <button type="submit">Add link</button>
            </form>
            <div className="table-list">
              {(links ?? []).map((item) => (
                <form action={savePlatformLink} className="table-row" key={item.id}>
                  <input type="hidden" name="id" value={item.id} />
                  <input name="title" defaultValue={item.title} aria-label="Title" />
                  <input name="url" defaultValue={item.url} aria-label="URL" />
                  <input name="button_label" defaultValue={item.button_label} aria-label="Button label" />
                  <input name="sort_order" type="number" defaultValue={item.sort_order} aria-label="Sort order" />
                  <label className="check-row">
                    <input name="active" type="checkbox" defaultChecked={item.active} />
                    Active
                  </label>
                  <button type="submit">Save</button>
                  <button
                    formAction={deletePlatformLink}
                    className="icon-only danger"
                    title="Delete link"
                    type="submit"
                  >
                    <Trash2 size={16} />
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Users</h2>
            <div className="table-list">
              {(users ?? []).map((item) => (
                <form action={updateUserStatus} className="table-row user-row" key={item.id}>
                  <input type="hidden" name="user_id" value={item.id} />
                  <span>
                    <strong>{item.full_name || item.email}</strong>
                    <small>{item.phone || "No phone saved"}</small>
                  </span>
                  <label className="check-row">
                    <input name="admin" type="checkbox" defaultChecked={item.role === "admin"} />
                    Admin
                  </label>
                  <label className="check-row">
                    <input name="disabled" type="checkbox" defaultChecked={item.disabled} />
                    Disabled
                  </label>
                  <button type="submit">Update</button>
                </form>
              ))}
            </div>
          </section>
        </div>

        <aside className="admin-side">
          <section className="admin-section">
            <h2>Announcement</h2>
            <form action={saveAnnouncement} className="panel-form">
              <input name="title" placeholder="Title" required />
              <textarea name="body" placeholder="Notice text" rows={4} required />
              <label className="check-row">
                <input name="published" type="checkbox" defaultChecked />
                Published
              </label>
              <button type="submit">Send notice</button>
            </form>
            {(announcements ?? []).map((item) => (
              <article className="notice-item" key={item.id}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <small>{item.status}</small>
              </article>
            ))}
          </section>
          <section className="admin-section">
            <h2>Customer chats</h2>
            {(conversations ?? []).map((item) => (
              <Link href={`/chat?conversation=${item.id}`} className="chat-link" key={item.id}>
                <MessageCircle size={16} />
                <span>
                  {item.profiles?.full_name || item.profiles?.email || "Customer"}
                  <small>{new Date(item.last_message_at).toLocaleString()}</small>
                </span>
              </Link>
            ))}
          </section>
        </aside>
      </section>
    </main>
  );
}
