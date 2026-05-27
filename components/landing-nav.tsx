import Link from "next/link";
import { signOut } from "@/app/auth/actions";

type Props = {
  active: "home" | "platforms";
  isAdmin?: boolean;
  isSignedIn: boolean;
};

export function LandingNav({ active, isAdmin = false, isSignedIn }: Props) {
  return (
    <nav className="topbar">
      <Link className="brand home-brand" href="/">
        Game Links Galore
      </Link>
      <div className="home-main-nav" aria-label="Primary navigation">
        <Link className={active === "home" ? "active" : undefined} href="/">
          Home
        </Link>
        <a href="/#rules">Rules</a>
        <Link className={active === "platforms" ? "active" : undefined} href="/platforms">
          Platforms
        </Link>
      </div>
      <div className="home-auth-nav">
        {isSignedIn ? (
          <div className="home-nav-actions">
            {isAdmin ? (
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
            Log In
          </Link>
        )}
      </div>
    </nav>
  );
}
