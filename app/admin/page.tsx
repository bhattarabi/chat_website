import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { PlatformLinksAdminTable, UsersAdminTable } from "@/components/admin-data-tables";
import { createClient } from "@/lib/supabase-server";
import type { Announcement, Conversation, MainFeature, PlatformLink, Profile } from "@/lib/types";
import { saveAnnouncement, saveMainFeature, savePlatformLink } from "./actions";

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

  const [{ data: links }, { data: users }, { data: announcements }, { data: conversations }, { data: mainFeature }] =
    await Promise.all([
      supabase
        .from("platform_links")
        .select("id, title, description, url, image_url, isFeatured:is_featured, button_label, active, sort_order")
        .order("sort_order")
        .returns<PlatformLink[]>(),
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
        .returns<Conversation[]>(),
      supabase
        .from("main_feature")
        .select("id, imageUrl:image_url, linkUrl:link_url")
        .eq("id", "main")
        .maybeSingle<MainFeature>()
    ]);
  const feature = mainFeature ?? { id: "main", imageUrl: null, linkUrl: null };

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
          <Link className="button" href="/dashboard">
            Account
          </Link>
          <form action={signOut}>
            <button type="submit">Logout</button>
          </form>
        </nav>
      </header>

      <section className="admin-tabs">
        <input id="admin-tab-links" name="admin-tabs" type="radio" defaultChecked />
        <input id="admin-tab-homepage" name="admin-tabs" type="radio" />
        <input id="admin-tab-announcements" name="admin-tabs" type="radio" />
        <input id="admin-tab-users" name="admin-tabs" type="radio" />
        <input id="admin-tab-chats" name="admin-tabs" type="radio" />

        <div className="admin-tab-list" role="tablist" aria-label="Admin sections">
          <label htmlFor="admin-tab-links" role="tab">
            Platform Links
          </label>
          <label htmlFor="admin-tab-homepage" role="tab">
            Homepage
          </label>
          <label htmlFor="admin-tab-announcements" role="tab">
            Announcements
          </label>
          <label htmlFor="admin-tab-users" role="tab">
            Users
          </label>
          <label htmlFor="admin-tab-chats" role="tab">
            User Chats
          </label>
        </div>

        <div className="admin-tab-panels">
          <section className="admin-section admin-tab-panel links-panel">
            <h1>Platform links</h1>
            <form action={savePlatformLink} className="inline-form">
              <input name="title" placeholder="Title" required />
              <input
                name="url"
                pattern="https?://.+|www\..+"
                placeholder="https://... or www..."
                required
                title="Enter a URL starting with http://, https://, or www."
              />
              <input
                name="image_url"
                pattern="https?://.+|www\..+"
                placeholder="Image URL"
                title="Enter an image URL starting with http://, https://, or www."
              />
              <input name="description" placeholder="Description" />
              <input name="button_label" placeholder="Button" />
              <input name="sort_order" type="number" placeholder="Order" />
              <label className="check-row">
                <input name="active" type="checkbox" defaultChecked />
                Active
              </label>
              <label className="check-row">
                <input name="isFeatured" type="checkbox" />
                Featured
              </label>
              <button type="submit">Add link</button>
            </form>
            <PlatformLinksAdminTable links={links ?? []} />
          </section>

          <section className="admin-section admin-tab-panel homepage-panel">
            <h1>Homepage</h1>
            <form action={saveMainFeature} className="panel-form">
              <label>
                MainFeature image URL
                <input
                  name="main_feature_image_url"
                  defaultValue={feature.imageUrl ?? ""}
                  pattern="https?://.+|www\..+"
                  placeholder="https://... or www..."
                  title="Enter an image URL starting with http://, https://, or www."
                />
              </label>
              <label>
                MainFeature link
                <input
                  name="main_feature_link_url"
                  defaultValue={feature.linkUrl ?? ""}
                  pattern="https?://.+|www\..+"
                  placeholder="https://... or www..."
                  title="Enter a link starting with http://, https://, or www."
                />
              </label>
              <button type="submit">Save homepage</button>
            </form>
          </section>

          <section className="admin-section admin-tab-panel announcements-panel">
            <h1>Announcements</h1>
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

          <section className="admin-section admin-tab-panel users-panel">
            <h1>Users</h1>
            <UsersAdminTable users={users ?? []} />
          </section>

          <section className="admin-section admin-tab-panel chats-panel">
            <h1>User Chats</h1>
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
        </div>
      </section>
    </main>
  );
}
