import Link from "next/link";
import { Menu } from "lucide-react";
import { signOut } from "@/app/auth/actions";

type Props = {
  showAdmin?: boolean;
};

export function StaffAppHeader({ showAdmin = false }: Props) {
  const navItems = (
    <>
      {showAdmin ? (
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
    </>
  );

  return (
    <header className="app-header staff-app-header">
      <details className="staff-mobile-nav">
        <summary aria-label="Open navigation" title="Navigation">
          <Menu aria-hidden="true" size={22} />
        </summary>
        <nav aria-label="Staff navigation">{navItems}</nav>
      </details>
      <Link href="/" className="brand">
        Game Links Galore
      </Link>
      <nav className="staff-desktop-nav" aria-label="Staff navigation">
        {navItems}
      </nav>
    </header>
  );
}
