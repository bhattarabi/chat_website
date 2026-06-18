import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut, updateProfile } from "@/app/auth/actions";
import { ResetPasswordButton } from "@/components/reset-password-button";
import { createClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";

type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();

  if (profile?.disabled) {
    await supabase.auth.signOut();
    redirect("/auth?message=Your account is disabled. Contact support.");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <Link href="/" className="brand">
          Raven Jackpots
        </Link>
        <nav>
          {profile?.role === "admin" ? (
            <Link className="button" href="/admin">
              Admin
            </Link>
          ) : null}
          <form action={signOut}>
            <button type="submit">Logout</button>
          </form>
        </nav>
      </header>

      <section className="dashboard-grid">
        <div className="main-column">
          {message ? <div className="notice">{message}</div> : null}
          <form action={updateProfile} className="panel-form">
            <h2>Account</h2>
            <div className="account-email">
              <strong>{user.email ?? profile?.email ?? ""}</strong>
            </div>
            <label>
              Name
              <input name="full_name" defaultValue={profile?.full_name ?? ""} />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" defaultValue={profile?.phone ?? ""} />
            </label>
            <button type="submit">Save changes</button>
          </form>
          <section className="instructions account-actions">
            <h2>Password</h2>
            <p>Send a password reset link to your account email address.</p>
            <ResetPasswordButton />
          </section>
        </div>
      </section>
    </main>
  );
}
