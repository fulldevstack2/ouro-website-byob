import type { CSSProperties } from "react";

/**
 * Round token mark. Renders the token's image when one is configured; otherwise the design
 * system's fallback, an ink tile with the ticker's first letter (TokenChip style).
 */
export function TokenIcon({ symbol, src, size = 22, style }: { symbol: string; src?: string; size?: number; style?: CSSProperties }) {
  const base: CSSProperties = { width: size, height: size, borderRadius: "50%", flex: "none", display: "inline-block", verticalAlign: "middle", ...style };
  if (src) {
    return <img src={src} alt="" width={size} height={size} style={{ ...base, border: "1px solid var(--border-hairline)", objectFit: "cover", background: "var(--surface-card)" }} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{
        ...base,
        borderRadius: 4,
        background: "var(--surface-inverse)",
        color: "var(--text-inverse)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontSize: Math.max(9, Math.round(size * 0.45)),
        fontWeight: 700,
      }}
    >
      {symbol.slice(0, 1)}
    </span>
  );
}
