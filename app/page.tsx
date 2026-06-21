import { HeroPlatformCarousel } from "@/components/hero-platform-carousel";
import { LandingNav } from "@/components/landing-nav";
import { rulesByCategory } from "@/lib/game-room-rules";
import { createClient } from "@/lib/supabase-server";
import type { GameRoomRule, PlatformLink, Profile } from "@/lib/types";
import Link from "next/link";

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
    .select("id, title, url, image_url, active")
    .eq("active", true)
    .order("title", { ascending: true })
    .returns<PlatformLink[]>();
  const { data: gameRules } = await supabase
    .from("game_room_rules")
    .select("id, category, body, sort_order, created_at")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .returns<GameRoomRule[]>();
  const platformImages = (games ?? []).filter((game) => game.image_url);
  const featuredGames = [
    {
      id: "hypo-slot-image",
      title: "Hypo slot game",
      image_url: "/hero-image1.png"
    },
    {
      id: "hypo-slot-image",
      title: "Hypo slot game",
      image_url: "/hero-image-2.png"
    }
  ];
  const marqueeRepeatCount = platformImages.length < 3 ? 12 : platformImages.length < 6 ? 8 : 5;
  const marqueeCycle = Array.from({ length: marqueeRepeatCount }, () => platformImages).flat();
  const marqueePlatforms = [...marqueeCycle, ...marqueeCycle];
  const gameRuleColumns = rulesByCategory(gameRules);

  return (
    <main className="home" id="top">
      <LandingNav active="home" isAdmin={profile?.role === "admin"} isSignedIn={Boolean(user)} />
      <section className="home-hero" aria-labelledby="home-hero-heading">
        <div className="hero-copy-column">
          <h1 id="home-hero-heading">WELCOME TO RAVEN JACKPOTS</h1>
          <p>
            Welcome Bonus
          </p>
          <p>Live Agent 24/7</p>
          <p className="hero-highlight">Fast Cash Out!</p>
        </div>
        <HeroPlatformCarousel isSignedIn={Boolean(user)} platforms={featuredGames} />
      </section>
      <section
        id="host-chat-options"
        className="host-chat-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-chat-modal-title"
      >
        <a className="host-chat-modal-close-layer" href="#top" aria-label="Close host chat options" />
        <div className="host-chat-modal">
          <h2 id="host-chat-modal-title">Talk To Host</h2>
          <div className="host-chat-modal-actions">
            <Link className="button hero-button-primary" href="/auth">
              Login
            </Link>
            <a className="button hero-button-secondary" href="/?chat=open">
              Chat as Guest
            </a>
          </div>
        </div>
      </section>
      {platformImages.length > 0 ? (
        <section className="platform-image-strip" aria-label="Platform games">
          <div className="platform-image-track">
            {marqueePlatforms.map((game, index) => (
              <div className="platform-image-tile" key={`${game.id}-${index}`}>
                <img src={game.image_url ?? ""} alt={game.title} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="game-rules-section" id="rules" aria-labelledby="game-rules-heading">
        <h2 id="game-rules-heading">Gameroom Rules</h2>
        <div className="game-rules-grid">
          {gameRuleColumns.map((column) => (
            <article className="game-rules-column" key={column.key}>
              <header>
                <h3>{column.title}</h3>
              </header>
              <ul>
                {column.rules.map((rule) => (
                  <li key={rule.id}>{rule.body}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-info">
            <div className="footer-link-groups">
              <div>
                <h2>Sign up To Play!</h2>
                <nav aria-label="Footer navigation">
                  <a href="#top">Home</a>
                  <Link href="/platforms">Platforms</Link>
                </nav>
              </div>
              <div className="footer-legal-group">
                <h2>Legal Pages</h2>
                <nav aria-label="Legal pages">
                  <Link href="#">Privacy Policy</Link>
                  <Link href="#">Terms & Conditions</Link>
                </nav>
              </div>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>Copyright Raven Jackpots | Designed for Raven Jackpots | Powered by Raven Jackpots</span>
        </div>
      </footer>
    </main>
  );
}
