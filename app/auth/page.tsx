import Link from "next/link";
import { resetPassword, signIn, signUp } from "./actions";

type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function AuthPage({ searchParams }: Props) {
  const { message } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link href="/" className="brand small">
          Raven Jackpots
        </Link>
        <h1>Customer access</h1>
        <p>Log in or create an account to open platform links and message support.</p>
        {message ? <div className="notice">{message}</div> : null}
        <div className="auth-grid">
          <form action={signIn} className="form-card">
            <h2>Log in</h2>
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input name="password" type="password" required autoComplete="current-password" />
            </label>
            <button type="submit">Log in</button>
          </form>
          <form action={signUp} className="form-card">
            <h2>Register</h2>
            <label>
              Name
              <input name="full_name" autoComplete="name" />
            </label>
            <label>
              Email
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input name="password" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            <button type="submit">Create account</button>
          </form>
        </div>
        <form action={resetPassword} className="reset-row">
          <input name="email" type="email" required placeholder="Email for password reset" />
          <button type="submit" className="secondary">
            Send reset
          </button>
        </form>
      </section>
    </main>
  );
}
