import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";

import { Badge, Button, ThemeToggle } from "@ouro/ds";
import { VISIBLE_NAV, externalLinkProps, site } from "~/content/site";
import { useCollapse } from "~/hooks/useCollapse";
import { useOuroTicker } from "~/hooks/useOuroTicker";
import { fmtUsd } from "@ouro/monitor-client";
import { Container } from "./Container";
import { SocialLinks } from "./SocialLinks";
import { Wordmark } from "./Wordmark";

/* ────────────────────────────────────────────────────────────────────────────
   The site header, and on a phone the menu behind the hamburger.

   The wordmark and a Live badge; the pages; and at the right end the price and the one button
   the site has, Buy $OURO, which leaves for letscash. ONE set of links, laid out two ways: above
   960px .site-nav__menu is `display: contents`, so the link row and the right-hand block are flex
   items of the bar itself; below it the menu becomes a panel under the bar, opened by animated
   height (useCollapse) and visibility:hidden once closed, which keeps its links out of the tab
   order while the menu is shut. Styles in styles/site.css.
   ──────────────────────────────────────────────────────────────────────────── */

/** Must match the breakpoint the menu's rules live under in styles/site.css. */
const MENU_QUERY = "(max-width: 960px)";

/** "OURO $0.00140 +9.5%": the price from the monitor, the day's change from DexScreener. Nothing until a price is known. */
function PriceTicker() {
  const t = useOuroTicker();
  if (t.priceUsd === null) return null;
  const c = t.changeH24;
  return (
    <span className="ticker" aria-label="OURO price">
      OURO {fmtUsd(t.priceUsd, { exact: true })}
      {c !== null && (
        <>
          {" "}
          <span className={c < 0 ? "ticker__change--down" : "ticker__change--up"}>
            {c < 0 ? "−" : "+"}
            {Math.abs(c).toFixed(1)}%
          </span>
        </>
      )}
    </span>
  );
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menu = useCollapse(open, { query: MENU_QUERY });
  const close = () => setOpen(false);

  /* Only while the menu is open: Escape and a press anywhere outside the header close it, and so does
     the viewport growing past the breakpoint, where the menu is not a panel. */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: Event) => {
      if (!header.current?.contains(e.target as Node)) setOpen(false);
    };
    const mq = window.matchMedia(MENU_QUERY);
    const onViewport = () => {
      if (!mq.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    mq.addEventListener("change", onViewport);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      mq.removeEventListener("change", onViewport);
    };
  }, [open]);

  return (
    <header className="site-nav" ref={header}>
      <Container className="site-nav__inner">
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Wordmark to="/" />
          <Badge tone="positive" dot>
            Live
          </Badge>
        </span>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle__icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <div id="site-menu" className="site-nav__menu" data-open={open ? "true" : "false"} ref={menu.ref} onTransitionEnd={menu.onTransitionEnd}>
          {/* A press anywhere in the panel closes it, links and dead space alike: on a phone the menu
              is what is covering the page, so a tap that leaves it up would have to be undone. */}
          <nav className="site-nav__links" aria-label="Primary" onClick={close}>
            {VISIBLE_NAV.map((item) =>
              /* The analytics site is Ouro's own second site, not a third party, so it is not thrown
                 into a new tab the way the socials and the launchpad are. The arrow still says the
                 address changes. */
              item.external ? (
                <a key={item.to} href={item.to} className="nav-link">
                  {item.label} ↗
                </a>
              ) : (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link">
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
          <span className="site-nav__right">
            <PriceTicker />
            <ThemeToggle />
            <Button size="sm" href={site.links.buy} onClick={close} {...externalLinkProps(site.links.buy)}>
              Buy {site.ticker} ↗
            </Button>
            <SocialLinks className="nav-social" />
          </span>
        </div>
      </Container>
    </header>
  );
}
