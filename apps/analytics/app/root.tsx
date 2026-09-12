import type { ReactNode } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

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
 * The operator disclosure.
 *
 * In the chrome of every page rather than on an about page, because this site reports on projects it
 * does not run, from a domain one of those projects owns. Stating that plainly costs a line; leaving
 * a reader to discover it costs the whole premise.
 */
function Disclosure() {
  return (
    <span className="disclosure">
      Operated by <a href="https://ourolayer.com">Ouro</a> · unaffiliated with the other projects listed
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#EEEBE5" />
        <Meta />
        <Links />
      </head>
      <body>
        <header className="nav">
          <div className="container nav-inner">
            <a className="wordmark" href="/">
              Airdrop Meta <span className="dim">· Robinhood Chain</span>
            </a>
            <Disclosure />
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
          : "The page failed to render. The figures come from an indexer that may simply be unreachable — try again in a moment."}
      </p>
      <p style={{ marginTop: 24 }}>
        <a href="/">Back to the comparison</a>
      </p>
    </div>
  );
}
