import type { CSSProperties } from "react";
import { Link } from "react-router";
import { site } from "~/content/site";

/** There is no logo: the mark is the name, type-set in the display serif. */
export function Wordmark({ size = 21, to }: { size?: number; to?: string }) {
  const style: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: size,
    letterSpacing: "-0.02em",
    color: "var(--text-primary)",
    lineHeight: 1,
  };
  return to ? (
    <Link to={to} className="wordmark" style={style} aria-label={`${site.name} home`}>
      {site.name}
    </Link>
  ) : (
    <span style={style}>{site.name}</span>
  );
}
