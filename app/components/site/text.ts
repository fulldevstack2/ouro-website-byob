import type { CSSProperties } from "react";

/** Shared inline-style fragments for the site (values from the design file). */
export const hairline = "1px solid var(--border-hairline)";

/** Every on-chain figure, amount, address and timestamp: mono, tabular. */
export const mono: CSSProperties = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" };

/** 11px tracked caps, the only ALL-CAPS the brand allows. */
export const micro: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" };

export const display: CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "var(--tracking-display)" };

/** The bronze "01 / R1" index at the start of a rule row. */
export const rowIndex: CSSProperties = { ...mono, fontSize: 13, fontWeight: 600, color: "var(--bronze-600)", width: 26, flex: "none" };

export const body14: CSSProperties = { fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" };
