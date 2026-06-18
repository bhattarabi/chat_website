import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase-server";

type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?message=Open the reset link from your email to continue.");

  return (
    <main className="auth-shell">
      <section className="auth-panel narrow">
        <Link href="/" className="brand small">
          Raven Jackpots
        </Link>
        <h1>Reset password</h1>
        <p>Enter a new password for your account.</p>
        {message ? <div className="notice">{message}</div> : null}
        <form action={updatePassword} className="form-card">
          <label>
            New password
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <label>
            Confirm password
            <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <button type="submit">Save password</button>
        </form>
      </section>
    </main>
  );
}
