import { NavLink } from "react-router";
import { Badge, Button } from "~/components/ds";
import { VISIBLE_NAV, externalLinkProps, site } from "~/content/site";
import { Container } from "./Container";
import { Wordmark } from "./Wordmark";
import { mono } from "./text";

export function SiteNav() {
  return (
    <header className="site-nav">
      <Container className="site-nav__inner">
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Wordmark to="/" />
          <Badge tone="positive" dot>
            Live
          </Badge>
        </span>
        <nav className="site-nav__links" aria-label="Primary">
          {VISIBLE_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <span className="site-nav__right">
          <span className="site-nav__chain" style={{ ...mono, fontSize: 12, color: "var(--text-muted)" }}>
            {site.chain.name} · {site.chain.id}
          </span>
          <Button size="sm" href={site.links.x} {...externalLinkProps(site.links.x)}>
            Follow {site.xHandle} ↗
          </Button>
        </span>
      </Container>
    </header>
  );
}
