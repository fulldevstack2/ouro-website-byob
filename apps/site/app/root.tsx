import type { ReactNode } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { Button, THEME_BOOT_SCRIPT } from "@ouro/ds";
import { Container, MicroLabel, SiteFooter, SiteNav, mono } from "~/components/site";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  // Self-hosted fonts (packages/ds fonts.css); the two used above the fold are preloaded.
  { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/public-sans.woff2", crossOrigin: "anonymous" },
  { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/source-serif-4-600.woff2", crossOrigin: "anonymous" },
];

/** GA4 property for the public site. A measurement ID is public by design; it is not a secret. */
const GA_MEASUREMENT_ID = "G-XXCEMKYS3E";

/**
 * Google Analytics (gtag.js), rendered into the document head of every prerendered page.
 *
 * `config` fires one page_view on load. This is a client-routed app, so later navigations are History API
 * pushes rather than document loads; GA4's Enhanced measurement setting "Page changes based on browser
 * history events" (on by default) is what counts those. Deliberately not sending our own page_view on route
 * change: with that setting on it would double count every view after the first.
 */
function GoogleAnalytics({ id }: { id: string }) {
  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`,
        }}
      />
    </>
  );
}

/** Document shell + site chrome. Wraps the routed page and the error boundary alike. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FFFFFF" data-light="#FFFFFF" />
        {/* Apply saved theme before paint so a dark preference does not flash white.
            suppressHydrationWarning on <html> keeps React from stripping data-theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Meta />
        <Links />
        <GoogleAnalytics id={GA_MEASUREMENT_ID} />
      </head>
      <body>
        <SiteNav />
        <main>{children}</main>
        <SiteFooter />
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
  let code = "Error";
  let title = "Something went wrong.";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    code = String(error.status);
    title = error.status === 404 ? "Page not found." : `Error ${error.status}`;
    details = error.status === 404 ? "There is nothing at this address." : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <Container className="page" style={{ minHeight: 480 }}>
      <MicroLabel tone="accent">{code}</MicroLabel>
      <h1 className="page-title">{title}</h1>
      <p className="page-head__lede">{details}</p>
      <div style={{ marginTop: 28 }}>
        <Button variant="secondary" arrow to="/">
          Back to the overview
        </Button>
      </div>
      {stack && (
        <pre style={{ ...mono, fontSize: 12, marginTop: 32, padding: 16, overflowX: "auto", background: "var(--surface-tint)", borderRadius: "var(--radius-md)" }}>
          <code>{stack}</code>
        </pre>
      )}
    </Container>
  );
}
