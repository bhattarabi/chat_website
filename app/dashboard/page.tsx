import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { signOut, updateProfile } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase-server";
import type { Announcement, PlatformLink, Profile } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [{ data: profile }, { data: links }, { data: announcements }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase
      .from("platform_links")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .returns<PlatformLink[]>(),
    supabase
      .from("announcements")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3)
      .returns<Announcement[]>()
  ]);

  if (profile?.disabled) {
    await supabase.auth.signOut();
    redirect("/auth?message=Your account is disabled. Contact support.");
  }

  const visibleLinks = (links ?? []).filter((item) => item.title.toLowerCase() !== "downloads");

  return (
    <main className="app-shell">
      <header className="app-header">
        <Link href="/" className="brand">
          Game Links Galore
        </Link>
        <nav>
          {profile?.role === "admin" ? (
            <Link className="button" href="/admin">
              Admin
            </Link>
          ) : null}
          <Link className="button" href="/chat">
            Support
          </Link>
          <form action={signOut}>
            <button type="submit">Logout</button>
          </form>
        </nav>
      </header>

      <section className="dashboard-grid">
        <div className="main-column">
          <div className="link-grid">
            {visibleLinks.map((item) => (
              <article className="link-card" key={item.id}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <a href={item.url} target="_blank" rel="noreferrer" className="button secondary">
                  {item.button_label}
                  <ExternalLink size={16} />
                </a>
              </article>
            ))}
          </div>
        </div>

        <aside className="side-column">
          <form action={updateProfile} className="panel-form">
            <h2>Profile</h2>
            <label>
              Name
              <input name="full_name" defaultValue={profile?.full_name ?? ""} />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" defaultValue={profile?.phone ?? ""} />
            </label>
            <button type="submit">Save profile</button>
          </form>
          <section className="announcements">
            <h2>Notices</h2>
            {(announcements ?? []).length ? (
              announcements?.map((item) => (
                <article key={item.id}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))
            ) : (
              <p>No notices right now.</p>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
