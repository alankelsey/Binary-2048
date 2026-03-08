import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Game" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/store", label: "Store" },
  { href: "/auth", label: "Auth" },
  { href: "/ghost-race", label: "Ghost Race" },
  { href: "/docs", label: "Docs" },
  { href: "/api-docs", label: "API Docs" }
] as const;

export function DevNav() {
  return (
    <nav className="dev-nav" aria-label="Developer navigation">
      <div className="dev-nav-inner">
        <strong className="dev-nav-title">Dev Nav</strong>
        <div className="dev-nav-links">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="dev-nav-link">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
