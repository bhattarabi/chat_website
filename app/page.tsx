import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

const games = [
  {
    title: "Orion Stars",
    description:
      "Play sweepstakes, reels, and fish games from home or on the go. Your credits stay tied to your account, so you can pick up on any device."
  },
  {
    title: "Fire Kirin",
    description:
      "Interactive fish games with the convenience of mobile access, account support, and a fast path back into play."
  },
  {
    title: "Galaxy World",
    description:
      "A mix of slot, fish, and reel games in one platform. Contact support if you need help opening or setting up your account."
  },
  {
    title: "Juwa",
    description:
      "A popular mobile game platform for players who want quick access, familiar games, and help when login issues come up."
  },
  {
    title: "Panda Master",
    description:
      "A bright fish-game platform with unique games, simple mobile access, and support available when you need it."
  },
  {
    title: "Ocean Titan",
    description:
      "Fish, reels, and sweepstakes-style play built for access from your phone, tablet, or desktop browser."
  }
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>()
    : { data: null };

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
              <Link className="button" href="/chat">
                Support
              </Link>
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
      <section className="games-directory" aria-labelledby="games-heading">
        <div className="games-directory-heading">
          <h2 id="games-heading">Games</h2>
          <p>Choose a platform below and tap Play to continue.</p>
        </div>
        <div className="games-list">
          {games.map((game) => (
            <article className="game-listing" key={game.title}>
              <div>
                <h3>{game.title}</h3>
                <p>{game.description}</p>
              </div>
              <Link className="button secondary" href={user ? "/dashboard" : "/auth"}>
                Play!
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
