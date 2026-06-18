import { HeroPlatformCarousel } from "@/components/hero-platform-carousel";
import { subscribeToPromos } from "@/app/actions";
import { LandingNav } from "@/components/landing-nav";
import { createClient } from "@/lib/supabase-server";
import type { MainFeature, PlatformLink, Profile } from "@/lib/types";
import Link from "next/link";

type HomeProps = {
  searchParams?: Promise<{ subscribe?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
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
  const platformImages = (games ?? []).filter((game) => game.image_url);
  const marqueeRepeatCount = platformImages.length < 3 ? 12 : platformImages.length < 6 ? 8 : 5;
  const marqueeCycle = Array.from({ length: marqueeRepeatCount }, () => platformImages).flat();
  const marqueePlatforms = [...marqueeCycle, ...marqueeCycle];
  const subscribeMessage =
    resolvedSearchParams?.subscribe === "success"
      ? "You're subscribed for weekly promos."
      : resolvedSearchParams?.subscribe === "invalid"
        ? "Enter a valid email address."
        : resolvedSearchParams?.subscribe === "error"
          ? "Subscription failed. Please try again."
          : "";

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
        <HeroPlatformCarousel
          isSignedIn={Boolean(user)}
          platforms={(games ?? []).filter((game) => game.isFeatured)}
        />
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
      <section className="game-rules-section" id="rules" aria-labelledby="game-rules-heading">
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
                  <a href="#top">Home</a>
                  <Link href="/platforms">Platforms</Link>
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
          <form action={subscribeToPromos} className="footer-subscribe" id="subscribe">
            <input aria-label="Email address" name="email" type="email" placeholder="Enter your email address" required />
            <input aria-label="Phone number" name="phone" type="tel" placeholder="Enter Your Phone Number" />
            <button type="submit">Subscribe Now</button>
            {subscribeMessage ? (
              <p className={resolvedSearchParams?.subscribe === "success" ? "footer-form-message" : "footer-form-message error"}>
                {subscribeMessage}
              </p>
            ) : null}
            <p>Join thousands of Gamers & Winners who receive our weekly Promo.</p>
          </form>
        </div>
        <div className="landing-footer-bottom">
          <span>Copyright Game Links Galore | Designed for Game Links Galore | Powered by Game Links Galore</span>
        </div>
      </footer>
    </main>
  );
}
