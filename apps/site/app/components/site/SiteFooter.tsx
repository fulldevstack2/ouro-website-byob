import { Link } from "react-router";

import { PROTOCOL_CONTRACTS, explorerAddressUrl, shortAddress } from "~/content/protocol";
import { VISIBLE_NAV, externalLinkProps, site } from "~/content/site";
import { Container } from "./Container";
import { MicroLabel } from "./MicroLabel";
import { Wordmark } from "./Wordmark";
import { mono } from "./text";

const OURO_ADDRESS = PROTOCOL_CONTRACTS[0]!.address!;

const ELSEWHERE = [
  { label: `X · ${site.xHandle} ↗`, href: site.links.x },
  { label: `Telegram · ${site.tgHandle} ↗`, href: site.links.telegram },
  { label: "Buy on letscash ↗", href: site.links.buy },
  { label: "Explorer ↗", href: site.links.explorer },
];

export function SiteFooter() {
  const ouroUrl = explorerAddressUrl(OURO_ADDRESS);
  return (
    <footer className="site-footer">
      <Container className="site-footer__inner">
        <div className="site-footer__cols">
          <div className="site-footer__brand">
            <Wordmark />
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15, color: "var(--text-secondary)", marginTop: 8 }}>{site.tagline}</div>
            <div style={{ ...mono, fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
              OURO{" "}
              <a href={ouroUrl} {...externalLinkProps(ouroUrl)} style={{ color: "var(--text-muted)" }}>
                {shortAddress(OURO_ADDRESS)} ↗
              </a>{" "}
              · {site.chain.name} {site.chain.id}
            </div>
          </div>
          <div className="site-footer__lists">
            <div className="site-footer__list">
              <MicroLabel style={{ marginBottom: 4 }}>Protocol</MicroLabel>
              {VISIBLE_NAV.map((item) => (
                <Link key={item.to} to={item.to} className="foot-link">
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="site-footer__list">
              <MicroLabel style={{ marginBottom: 4 }}>Elsewhere</MicroLabel>
              {ELSEWHERE.map((l) => (
                <a key={l.label} href={l.href} className="foot-link" {...externalLinkProps(l.href)}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className="site-footer__legal">
          Ouro is experimental software on an emerging chain and is unaudited. It is an independent protocol, not affiliated with or endorsed by Robinhood.
          The pools hold volatile tokens that can lose value, including to zero. Nothing on this page is financial advice or a promise of returns. Every
          figure is a live chain read; verify any of them independently.
        </p>
      </Container>
    </footer>
  );
}
