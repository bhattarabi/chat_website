import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { HeroPlatformCarousel } from "@/components/hero-platform-carousel";
import { createClient } from "@/lib/supabase-server";
import type { PlatformLink, Profile } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>()
    : { data: null };
  const { data: games } = await supabase
    .from("platform_links")
    .select("id, title, description, url, image_url, isFeatured:is_featured, button_label, active, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .returns<PlatformLink[]>();

  return (
    <main className="home">
      <nav className="topbar">
        <span className="brand">Game Links Galore</span>
        <div>
          {user ? (
            <div className="home-nav-actions">
              {profile?.role === "admin" ? (
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
            </div>
          ) : (
            <Link className="button" href="/auth">
              Login / Register
            </Link>
          )}
        </div>
      </nav>
      <section className="home-hero" aria-labelledby="home-hero-heading">
        <div className="hero-logo-column">
          <img src="/site-logo.svg" alt="Game Links Galore" />
        </div>
        <div className="hero-copy-column">
          <h1 id="home-hero-heading">Game Links Galore</h1>
          <p>
            Welcome bonus
            <strong> up to $100</strong>
          </p>
          <p>Live Agent 24/7</p>
          <p className="hero-highlight">Fast Cash Out!</p>
        </div>
        <HeroPlatformCarousel
          isSignedIn={Boolean(user)}
          platforms={(games ?? []).filter((game) => game.isFeatured)}
        />
      </section>
      <section className="games-directory" aria-labelledby="games-heading">
        <div className="games-directory-heading">
          <h2 id="games-heading">Games</h2>
          <p>Choose a platform below and tap Play to continue.</p>
        </div>
        <div className="games-list">
          {(games ?? []).length ? (
            games?.map((game) => (
              <article className="game-listing" key={game.id}>
                <div className="game-image">
                  {game.image_url ? (
                    <img src={game.image_url} alt="" loading="lazy" />
                  ) : (
                    <span>{game.title.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3>{game.title}</h3>
                  {game.description ? <p>{game.description}</p> : null}
                </div>
                {user ? (
                  <a href={game.url} target="_blank" rel="noreferrer" className="button secondary">
                    {game.button_label || "Play!"}
                  </a>
                ) : (
                  <Link className="button secondary" href="/auth">
                    {game.button_label || "Play!"}
                  </Link>
                )}
              </article>
            ))
          ) : (
            <p className="empty-list">No games are available right now.</p>
          )}
        </div>
      </section>
    </main>
  );
}
