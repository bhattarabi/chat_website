import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { HeroPlatformCarousel } from "@/components/hero-platform-carousel";
import { createClient } from "@/lib/supabase-server";
import type { MainFeature, PlatformLink, Profile } from "@/lib/types";

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
  const { data: mainFeature } = await supabase
    .from("main_feature")
    .select("id, imageUrl:image_url, linkUrl:link_url")
    .eq("id", "main")
    .maybeSingle<MainFeature>();

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
      {(games ?? []).some((game) => game.image_url) ? (
        <section className="platform-image-strip" aria-label="Platform games">
          <div className="platform-image-track">
            {[...(games ?? []), ...(games ?? [])]
              .filter((game) => game.image_url)
              .map((game, index) => (
                <div className="platform-image-tile" key={`${game.id}-${index}`}>
                  <img src={game.image_url ?? ""} alt={game.title} />
                </div>
              ))}
          </div>
        </section>
      ) : null}
      <section className="how-to-play-section" aria-labelledby="how-to-play-heading">
        <div className="how-to-play-copy">
          <h2 id="how-to-play-heading">How To Play</h2>
          <ol className="how-to-play-steps">
            <li>
              <span>01</span>
              <div>
                <h3>Sign Up</h3>
                <p>It only takes 2 mins sign up. If you have any questions don't hesitate to message us.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Message Us</h3>
                <p>
                  Meet and greet is the best way to know us. Message us, ask us about our game room rule
                  and cash out process.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Play, Win & Redeem</h3>
                <p>Our hosts will create your platform ID and password.</p>
              </div>
            </li>
          </ol>
          <div className="how-to-play-actions">
            <Link className="button hero-button-secondary" href={user ? "/chat" : "/auth"}>
              Talk To Host
            </Link>
            <Link className="button hero-button-primary" href="/auth">
              Sign Up Now
            </Link>
          </div>
        </div>
        <div className="how-to-play-card">
          {mainFeature?.imageUrl ? (
            mainFeature.linkUrl ? (
              <a href={mainFeature.linkUrl} target="_blank" rel="noreferrer">
                <img src={mainFeature.imageUrl} alt="Main feature" />
              </a>
            ) : (
              <img src={mainFeature.imageUrl} alt="Main feature" />
            )
          ) : (
            <span>No MainFeature selected</span>
          )}
        </div>
      </section>
      <section className="game-rules-section" aria-labelledby="game-rules-heading">
        <h2 id="game-rules-heading">Gameroom Rules</h2>
        <div className="game-rules-grid">
          <article className="game-rules-column">
            <header>
              <h3>Redemption Policy</h3>
            </header>
            <ul>
              <li>Live Agent 24/7</li>
              <li>Redeem Hours 12pm- 11pm Eastern Time Zone</li>
              <li>$500 max per day / until your balance is fully redeemed, (personal or business)</li>
              <li>2 Redeems allowed per day</li>
              <li>$Minimum redeem is $50</li>
            </ul>
          </article>
          <article className="game-rules-column">
            <header>
              <h3>Payment Methods</h3>
            </header>
            <ul>
              <li>Cashapp,</li>
              <li>Venmo,</li>
              <li>Paypal,</li>
              <li>Chime</li>
              <li>Apple Pay</li>
              <li>BinPay (Accept major, Debit & Credit Cards)</li>
              <li>Pandora (Accept Gpay, Min $20)</li>
            </ul>
          </article>
        </div>
      </section>
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-info">
            <div className="footer-link-groups">
              <div>
                <h2>Sign up To Play!</h2>
                <nav aria-label="Footer navigation">
                  <Link href="/">Home</Link>
                  <a href="#games-heading">Platforms</a>
                </nav>
              </div>
              <div className="footer-legal-group">
                <h2>Legal Pages</h2>
                <nav aria-label="Legal pages">
                  <Link href="/privacy">Privacy Policy</Link>
                  <Link href="/terms">Terms & Conditions</Link>
                </nav>
              </div>
            </div>
            <div className="landing-footer-brand">
              <img src="/site-logo.svg" alt="Game Links Galore" />
              <strong>Game Links Galore</strong>
            </div>
          </div>
          <form className="footer-subscribe">
            <input aria-label="Email address" type="email" placeholder="Enter your email address" />
            <input aria-label="Phone number" type="tel" placeholder="Enter Your Phone Number" />
            <button type="submit">Subscribe Now</button>
            <p>Join thousands of Gamers & Winners who receive our weekly Promo.</p>
          </form>
        </div>
        <div className="landing-footer-bottom">
          <span>Copyright Game Links Galore | Designed for Game Links Galore | Powered by Game Links Galore</span>
        </div>
      </footer>
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
