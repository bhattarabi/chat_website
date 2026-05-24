import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { PlatformLinksAdminTable, UsersAdminTable } from "@/components/admin-data-tables";
import { createClient } from "@/lib/supabase-server";
import type { Announcement, PlatformLink, Profile } from "@/lib/types";
import { saveAnnouncement, savePlatformLink } from "./actions";

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

  const [{ data: links }, { data: users }, { data: announcements }] = await Promise.all([
    supabase.from("platform_links").select("*").order("sort_order").returns<PlatformLink[]>(),
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).returns<Profile[]>(),
    supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<Announcement[]>()
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
        <input id="admin-tab-announcements" name="admin-tabs" type="radio" />
        <input id="admin-tab-users" name="admin-tabs" type="radio" />

        <div className="admin-tab-list" role="tablist" aria-label="Admin sections">
          <label htmlFor="admin-tab-links" role="tab">
            Platform Links
          </label>
          <label htmlFor="admin-tab-announcements" role="tab">
            Announcements
          </label>
          <label htmlFor="admin-tab-users" role="tab">
            Users
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
              <button type="submit">Add link</button>
            </form>
            <PlatformLinksAdminTable links={links ?? []} />
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
        </div>
      </section>
    </main>
  );
}
