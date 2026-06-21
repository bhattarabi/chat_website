import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";

type Props = {
  active: "home" | "platforms";
  facebookUrl?: string | null;
  isAdmin?: boolean;
  isSignedIn: boolean;
  telegramUrl?: string | null;
};

export function LandingNav({
  active,
  facebookUrl,
  isAdmin = false,
  isSignedIn,
  telegramUrl
}: Props) {
  return (
    <nav className="topbar">
      <Link className="brand home-brand" href="/" aria-label="Raven home">
        <Image
          src="/Raven_Flying_Logo.png"
          alt="Raven"
          width={150}
          height={76}
          priority
        />
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
        <div className="home-nav-actions">
          {isSignedIn ? (
            <>
              {isAdmin ? (
                <Link className="button" href="/admin">
                  Admin
                </Link>
              ) : (
                <Link className="button" href="/dashboard">
                  Account
                </Link>
              )}
              <form action={signOut}>
                <button type="submit">Logout</button>
              </form>
            </>
          ) : (
            <>
              <Link className="button" href="/auth">
                Login
              </Link>
              <a
                className="social-icon-link"
                href={telegramUrl || "#"}
                target={telegramUrl ? "_blank" : undefined}
                rel={telegramUrl ? "noreferrer" : undefined}
                aria-label="Telegram"
                title="Telegram"
              >
                <TelegramIcon />
              </a>
              <a
                className="social-icon-link"
                href={facebookUrl || "#"}
                target={facebookUrl ? "_blank" : undefined}
                rel={facebookUrl ? "noreferrer" : undefined}
                aria-label="Facebook"
                title="Facebook"
              >
                <FacebookIcon />
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function TelegramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" focusable="false">
      <path
        d="M21.9 4.1 18.7 19c-.2 1-.8 1.2-1.6.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-.9.5l.3-4.8 8.8-8c.4-.3-.1-.5-.6-.2L6.8 12.8 2.1 11.3c-1-.3-1-1 .2-1.5l18.2-7c.8-.3 1.6.2 1.4 1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" focusable="false">
      <path
        d="M14 8.3V6.7c0-.8.6-1 1-1h2.6V2h-3.5c-3.4 0-4.8 2.1-4.8 4.6v1.7H6v3.9h3.3V22H14v-9.8h3.2l.5-3.9H14Z"
        fill="currentColor"
      />
    </svg>
  );
}
