import type { CSSProperties } from "react";

/** Shared inline-style fragments for the site (values from the design file). */
export const hairline = "1px solid var(--border-hairline)";

/** Every on-chain figure, amount, address and timestamp: mono, tabular. */
export const mono: CSSProperties = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };

/** 11px tracked caps, the only ALL-CAPS the brand allows. */
export const micro: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" };

export const display: CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "var(--tracking-display)" };

/** The bronze "01" index at the start of a numbered row. */
export const rowIndex: CSSProperties = { ...mono, fontSize: 13, fontWeight: 600, color: "var(--accent)", width: 26, flex: "none" };

export const body14: CSSProperties = { fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" };

/**
 * For a reference table (a parameter and its value, a contract and its address): fill the column and
 * wrap, rather than sizing to the longest line and scrolling inside it.
 *
 * `LedgerTable` defaults to `width: max-content; min-width: 100%`, which is right for the dense feeds
 * it was built for, where compressing a timestamp column is worse than a sideways scroll. It is wrong
 * for a two-column table in a half-width column: "2026-09-08 · blocks 57,376,688 to 57,376,793" made
 * the whole table 533px wide inside a 514px column and clipped every value in it. Those are the
 * component's own INLINE styles, so no stylesheet can override them; this goes through its `style`
 * prop, which it spreads last.
 */
export const fitTable: CSSProperties = { width: "100%", minWidth: 0 };
