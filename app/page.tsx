import Link from "next/link";
import { MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase-server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <main className="home">
      <nav className="topbar">
        <span className="brand">Support Portal</span>
        <div>
          {user ? (
            <Link className="button" href="/dashboard">
              Dashboard
            </Link>
          ) : (
            <Link className="button" href="/auth">
              Login / Register
            </Link>
          )}
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <h1>Support Portal</h1>
          <p>
            A clean customer hub for account access, platform links, and fast direct support chat.
          </p>
          <Link className="button large" href={user ? "/dashboard" : "/auth"}>
            {user ? "Open dashboard" : "Get started"}
          </Link>
        </div>
      </section>
      <section className="feature-band" aria-label="Highlights">
        <article>
          <Smartphone size={24} />
          <h2>Mobile first</h2>
          <p>Simple layouts built for customers using phones.</p>
        </article>
        <article>
          <MessageCircle size={24} />
          <h2>Realtime chat</h2>
          <p>Instant support messages with image attachments.</p>
        </article>
        <article>
          <ShieldCheck size={24} />
          <h2>Owned stack</h2>
          <p>Supabase database, auth, storage, and source code under client control.</p>
        </article>
      </section>
    </main>
  );
}
