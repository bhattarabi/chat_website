import Link from "next/link";
import { resetPassword, signIn, signUp } from "./actions";

type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function AuthPage({ searchParams }: Props) {
  const { message } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-popup" aria-labelledby="auth-title">
        <div className="auth-popup-header">
          <h1 id="auth-title">Raven Jackpots</h1>
          <Link href="/" className="auth-close" aria-label="Close login popup">
            Close
          </Link>
        </div>
        {message ? <div className="notice">{message}</div> : null}
        <div className="auth-tabs">
          <input id="auth-tab-signin" name="auth-tabs" type="radio" defaultChecked />
          <input id="auth-tab-signup" name="auth-tabs" type="radio" />
          <div className="auth-tab-list" role="tablist" aria-label="Customer access">
            <label htmlFor="auth-tab-signin" role="tab">
              Login
            </label>
            <label htmlFor="auth-tab-signup" role="tab">
              Sign-up
            </label>
          </div>
          <div className="auth-tab-panels">
            <form action={signIn} className="auth-tab-panel auth-signin-panel">
              <label>
                Email
                <input name="email" type="email" required autoComplete="email" placeholder="Email" />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                />
              </label>
              <details className="forgot-password-panel">
                <summary>Forgot your password?</summary>
                <div className="forgot-password-copy">
                  <input name="email" type="email" form="password-reset-form" required placeholder="Email for password reset" />
                  <button type="submit" form="password-reset-form" className="secondary">
                    Send reset
                  </button>
                </div>
              </details>
              <button type="submit" className="auth-submit">
                Login
              </button>
            </form>
            <form action={signUp} className="auth-tab-panel auth-signup-panel">
              <label>
                Name
                <input name="full_name" autoComplete="name" placeholder="Name" />
              </label>
              <label>
                Email
                <input name="email" type="email" required autoComplete="email" placeholder="Email" />
              </label>
              <label>
                Password
                <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Password" />
              </label>
              <button type="submit" className="auth-submit">
                Sign-up
              </button>
            </form>
          </div>
        </div>
      </section>
      <form action={resetPassword} id="password-reset-form" />
    </main>
  );
}
