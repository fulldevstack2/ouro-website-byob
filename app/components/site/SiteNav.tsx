import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { Badge, Button } from "~/components/ds";
import { VISIBLE_NAV, externalLinkProps, site } from "~/content/site";
import { useCollapse } from "~/hooks/useCollapse";
import { Container } from "./Container";
import { Wordmark } from "./Wordmark";
import { mono } from "./text";

/* ────────────────────────────────────────────────────────────────────────────
   The site header, and on a phone the menu behind the hamburger.

   ONE set of links, laid out two ways. Above 860px .site-nav__menu is `display: contents`, so the
   link row and the right-hand block are flex items of the bar itself and the header is the one this
   site has always had. Below it the menu becomes a panel under the bar and takes the Follow button
   and the chain line down with it, because six links, the wordmark and that button need about 810px
   of bar. The links used to wrap into a scrolling strip instead, which fitted but hid whatever ran
   past the right edge (Airdrops and Docs on a 390px phone) behind a gesture nothing announced.

   The panel is styled in styles/site.css: it hangs off the bar rather than being a second row of it,
   opens by animated height (useCollapse, above the breakpoint a no-op) and is visibility:hidden once
   closed, which keeps its links out of the tab order while the menu is shut.
   ──────────────────────────────────────────────────────────────────────────── */

/** Must match the breakpoint the menu's rules live under in styles/site.css. */
const MENU_QUERY = "(max-width: 860px)";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const menu = useCollapse(open, { query: MENU_QUERY });
  const close = () => setOpen(false);

  /* Only while the menu is open: Escape and a press anywhere outside the header close it, and so does
     the viewport growing past the breakpoint, where the menu is not a panel and an `open` left set
     would spring it back the moment the viewport narrowed again. */
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
        <div
          id="site-menu"
          className="site-nav__menu"
          data-open={open ? "true" : "false"}
          ref={menu.ref}
          onTransitionEnd={menu.onTransitionEnd}
        >
          {/* A press anywhere in the panel closes it, links and dead space alike: on a phone the menu
              is what is covering the page, so a tap that leaves it up would have to be undone. */}
          <nav className="site-nav__links" aria-label="Primary" onClick={close}>
            {VISIBLE_NAV.map((item) =>
              item.href ? (
                <a key={item.to} href={item.href} className="nav-link" {...externalLinkProps(item.href)}>
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
            <span className="site-nav__chain" style={{ ...mono, fontSize: 12, color: "var(--text-muted)" }}>
              {site.chain.name} · {site.chain.id}
            </span>
            <Button size="sm" href={site.links.x} onClick={close} {...externalLinkProps(site.links.x)}>
              Follow {site.xHandle} ↗
            </Button>
          </span>
        </div>
      </Container>
    </header>
  );
}
