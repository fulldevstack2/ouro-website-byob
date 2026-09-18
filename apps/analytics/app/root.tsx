import type { ReactNode } from "react";
import { isRouteErrorResponse, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration } from "react-router";

import { THEME_BOOT_SCRIPT, ThemeToggle } from "@ouro/ds";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  // Self-hosted faces from @ouro/ds, served out of this app's own public/fonts (see that package's
  // styles/index.css for why they are duplicated per app). The two above the fold are preloaded.
  { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/public-sans.woff2", crossOrigin: "anonymous" },
  { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/jetbrains-mono.woff2", crossOrigin: "anonymous" },
];

/**
 * The three pages, and what each one is ABOUT.
 *
 * "Ledger" and "Airdrops" alone would be ambiguous on this particular site: the comparison page is
 * itself about the airdrops of three different tokens, so an unqualified "Airdrops" tab reads as more
 * of that rather than as one project's own books. Naming Ouro in both is the whole disambiguation,
 * and it also keeps the split honest at a glance — one page reports on projects Ouro does not run,
 * two are Ouro's own, and the reader can see which is which before clicking.
 */
const TABS = [
  { to: "/", label: "Airdrop meta", end: true },
  { to: "/ledger/", label: "Ouro ledger", end: false },
  { to: "/airdrops/", label: "Ouro airdrops", end: false },
];

/**
 * The operator disclosure.
 *
 * In the chrome of every page rather than on an about page, because this site reports on projects it
 * does not run, from a domain one of those projects owns. Stating that plainly costs a line; leaving
 * a reader to discover it costs the whole premise.
 *
 * "the projects it reports on" rather than "the other projects listed": two of the three pages here
 * are Ouro's own books and list no one else, and a disclosure that reads as boilerplate on the page
 * it matters least is how the one on the comparison page stops being read.
 */
function Disclosure() {
  return (
    <span className="disclosure">
      Operated by <a href="https://ourolayer.com">Ouro</a> · unaffiliated with the projects it reports on
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FFFFFF" data-light="#FFFFFF" />
        {/* Boot + suppressHydrationWarning: React must not strip data-theme on hydrate. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="nav">
          <div className="container nav-inner">
            <a className="wordmark" href="/">
              Ouro Analytics <span className="dim">· Robinhood Chain</span>
            </a>
            {/* Scrolls sideways rather than wrapping on a phone: three tabs that reflow to two lines
                push the page's own first line under the fold. */}
            <nav className="tabs" aria-label="Pages">
              {TABS.map((t) => (
                <NavLink key={t.to} to={t.to} end={t.end} className="tab-link">
                  {t.label}
                </NavLink>
              ))}
            </nav>
            <span className="nav-tools">
              <ThemeToggle />
              <Disclosure />
            </span>
          </div>
        </header>
        <main>{children}</main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="container" style={{ paddingBlock: "80px 120px" }}>
      <p className="eyebrow">{is404 ? "404" : "Error"}</p>
      <h1>{is404 ? "Page not found" : "Something broke"}</h1>
      <p className="lede">
        {is404
          ? "That URL is not one of ours."
          : "The page failed to render. The figures come from an indexer that may simply be unreachable, so try again in a moment."}
      </p>
      <p style={{ marginTop: 24 }}>
        <a href="/">Back to the comparison</a>
      </p>
    </div>
  );
}
