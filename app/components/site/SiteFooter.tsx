import { Link } from "react-router";
import { VISIBLE_NAV, externalLinkProps, site } from "~/content/site";
import { Container } from "./Container";
import { MicroLabel } from "./MicroLabel";
import { Wordmark } from "./Wordmark";
import { hairline, mono } from "./text";

const ELSEWHERE = [
  { label: `X · ${site.xHandle} ↗`, href: site.links.x },
  { label: "Explorer ↗", href: site.links.explorer },
  { label: "Robinhood Chain ↗", href: site.links.robinhoodChain },
];

export function SiteFooter() {
  return (
    <footer style={{ borderTop: hairline, marginTop: 96, background: "var(--surface-tint)" }}>
      <Container style={{ paddingTop: 48, paddingBottom: 40 }}>
        <div style={{ display: "flex", gap: 64, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <Wordmark />
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15, color: "var(--text-secondary)", marginTop: 8 }}>{site.tagline}</div>
            <div style={{ ...mono, fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
              Addresses publish at launch · {site.chain.name} {site.chain.id}
            </div>
          </div>
          <div style={{ display: "flex", gap: 56 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <MicroLabel style={{ marginBottom: 4 }}>Protocol</MicroLabel>
              {VISIBLE_NAV.map((item) => (
                <Link key={item.to} to={item.to} className="foot-link">
                  {item.label}
                </Link>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <MicroLabel style={{ marginBottom: 4 }}>Elsewhere</MicroLabel>
              {ELSEWHERE.map((l) => (
                <a key={l.label} href={l.href} className="foot-link" {...externalLinkProps(l.href)}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <p style={{ margin: "40px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--text-faint)", maxWidth: 760, borderTop: hairline, paddingTop: 20 }}>
          Ouro is experimental software on an emerging chain, unaudited until an audit link appears in the docs. It is an independent protocol, not affiliated
          with or endorsed by Robinhood. The pools will hold volatile tokens that can lose value, including to zero. Nothing on this page is financial advice or
          a promise of returns. Figures shown as a dash publish at launch as live chain reads. Verify any of them independently.
        </p>
      </Container>
    </footer>
  );
}
