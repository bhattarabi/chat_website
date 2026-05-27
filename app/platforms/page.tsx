import { LandingNav } from "@/components/landing-nav";
import { createClient } from "@/lib/supabase-server";
import type { PlatformLink, Profile } from "@/lib/types";

export default async function PlatformsPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>()
    : { data: null };
  const { data: platforms } = await supabase
    .from("platform_links")
    .select("id, title, description, url, image_url, isFeatured:is_featured, button_label, active, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .returns<PlatformLink[]>();

  return (
    <main className="home platforms-page">
      <LandingNav active="platforms" isAdmin={profile?.role === "admin"} isSignedIn={Boolean(user)} />
      <section className="platforms-section" aria-labelledby="platforms-heading">
        <h1 id="platforms-heading">Platforms Available</h1>
        <div className="platforms-grid">
          {(platforms ?? []).length ? (
            platforms?.map((platform) => (
              <article className="platform-card" key={platform.id}>
                <div className="platform-card-image">
                  {platform.image_url ? (
                    <img src={platform.image_url} alt={platform.title} />
                  ) : (
                    <span>{platform.title.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <a href={platform.url} target="_blank" rel="noreferrer" className="button platform-play-button">
                  Play
                </a>
              </article>
            ))
          ) : (
            <p className="platforms-empty">No platforms are available right now.</p>
          )}
        </div>
      </section>
    </main>
  );
}
