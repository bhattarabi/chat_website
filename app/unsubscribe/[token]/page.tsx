import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

type UnsubscribePageProps = {
  params: Promise<{ token: string }>;
};

export default async function UnsubscribePage({ params }: UnsubscribePageProps) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("unsubscribe_promo", { token });
  const unsubscribed = Boolean(data);

  return (
    <main className="auth-shell">
      <section className="auth-panel narrow form-card">
        <Link href="/" className="brand small">
          Raven Jackpots
        </Link>
        <h1>{unsubscribed ? "Unsubscribed" : "Link not found"}</h1>
        <p>
          {unsubscribed
            ? "You will no longer receive promotional emails from Raven Jackpots."
            : "This unsubscribe link is invalid or has already been removed."}
        </p>
        <Link className="button" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
