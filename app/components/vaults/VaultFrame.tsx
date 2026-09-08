import type { CSSProperties, ReactNode } from "react";

import { Badge, Button, Card, Stat } from "~/components/ds";
import { AddressCell, Grid, KVRow, TokenIcon, body14, hairline, mono } from "~/components/site";
import { LIVE_VAULTS, TERMS, type LiveVault } from "~/content/vaults";

/* ────────────────────────────────────────────────────────────────────────────
   The vaults section's layout, with no wallet code in it.

   Two renderings share these pieces. `VaultsStatic` (below) is what the prerender writes and what
   the first client frame shows: every figure a dash and the wallet button disabled, so a crawler and
   a shared link get the real page rather than a spinner. `VaultsLive` (its own module, loaded on the
   client only) mounts the wallet tree and reads the chain. Keeping wagmi and RainbowKit out of this
   file keeps them out of the server bundle, which is what lets the prerender stay fast.

   ALIGNMENT. The three cards sit side by side and are read across as much as down, so every row has
   to line up with the same row on the neighbouring cards whatever its text wraps to. Each card is a
   CSS subgrid of the vaults grid spanning CARD_ROWS rows, and every card renders exactly that many
   direct children in the same order, so the grid sizes each row once for all three. Anything
   conditional (a paused notice, a transaction status) lives INSIDE the last row, never as a row of
   its own. Change the structure in Frame, StaticStats and LiveStats together.
   ──────────────────────────────────────────────────────────────────────────── */

/** Card header, title, description, meta, divider, seven stat rows, actions. */
export const CARD_ROWS = 13;
export const STAT_ROWS = 7;

const cardGrid: CSSProperties = {
  display: "grid",
  // One column that can never outgrow the card. Left implicit it sizes to the widest unbreakable child, and a
  // 94-digit APY once made it ~1000px: every row's value then sat under the neighbouring cards, out of sight.
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateRows: "subgrid",
  gridRow: `span ${CARD_ROWS}`,
  rowGap: 0,
  alignContent: "start",
};

export interface StatBandProps {
  /** Deposits across the vaults, in dollars, with the OURO total as the footnote. */
  tvl: ReactNode;
  tvlNote: ReactNode;
  /** The measured airdrop rate the vaults' yield rests on, annualised, with its basis. */
  airdropRate: ReactNode;
  airdropNote: ReactNode;
}

export function StatBand({ tvl, tvlNote, airdropRate, airdropNote }: StatBandProps) {
  return (
    <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ margin: "40px 0 40px", padding: "28px 0", borderTop: hairline, borderBottom: hairline }}>
      <Stat label="Vaults" value={String(LIVE_VAULTS.length)} footnote="All pooling OURO, paid in OURO, WETH or USDG. Each clears the 100,000 OURO airdrop line for everyone in it" />
      <Stat className="cell-rule" label="TVL" value={tvl} footnote={tvlNote} />
      <Stat className="cell-rule" label="Airdrop rate" value={airdropRate} footnote={airdropNote} />
      <Stat className="cell-rule" label="Performance fee" value={`${TERMS.performanceFeePct}%`} footnote={`Of harvest gains only. Hard cap ${TERMS.maxPerformanceFeePct}%, and no deposit or withdrawal fee`} />
    </Grid>
  );
}

export const STATIC_BAND: StatBandProps = {
  tvl: "—",
  tvlNote: "Deposits across the three vaults, priced in dollars from the chain and the monitor",
  airdropRate: "—",
  airdropNote: "What a wallet above the line earns from payouts actually made, annualised, before any vault fee",
};

export function ConnectBar({ right, note }: { right: ReactNode; note: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div style={{ ...body14, maxWidth: 620 }}>{note}</div>
      {right}
    </div>
  );
}

/** The grid the three cards share; each card spans CARD_ROWS of its rows. */
export function VaultGrid({ children }: { children: ReactNode }) {
  return (
    <Grid cols="repeat(3, 1fr)" gap={24} className="grid--2col-md">
      {children}
    </Grid>
  );
}

/**
 * One vault's card. `rows` must be exactly STAT_ROWS direct elements (see StaticStats and LiveStats),
 * and `children` is the actions block, the single row that may hold conditional content.
 */
export function Frame({ vault, rows, children }: { vault: LiveVault; rows: ReactNode; children: ReactNode }) {
  const { token, payout, entry } = vault;
  return (
    <Card
      label={payout.label(token)}
      action={
        <Badge tone="positive" dot>
          Live
        </Badge>
      }
      style={cardGrid}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 600 }}>
        <TokenIcon symbol={token.symbol} src={token.icon} size={22} />
        <span>
          {token.symbol} → {vault.payoutSymbol}
        </span>
      </div>
      <div style={{ ...body14, marginTop: 8 }}>{payout.text(token)}</div>
      <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", ...mono, fontSize: 12, color: "var(--text-faint)" }}>
        <span>{entry.shareSymbol}</span>
        <AddressCell address={entry.address} />
      </div>
      <div style={{ marginTop: 20, borderTop: hairline }} />
      {rows}
      <div style={{ marginTop: 20 }}>{children}</div>
    </Card>
  );
}

/** The small print under a figure row: the basis of a yield, or a note. One grid row. */
export function NoteRow({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-faint)", paddingBottom: 12, borderBottom: hairline }}>{children}</div>;
}

export function StaticStats({ vault }: { vault: LiveVault }) {
  const compounding = vault.kind === "compounding";
  return (
    <>
      <KVRow label="TVL" value="—" />
      <KVRow label={compounding ? "Share price" : "Owed to depositors"} value={`— ${compounding ? vault.token.symbol : vault.payoutSymbol}`} />
      <KVRow label={compounding ? "Vesting to depositors" : "Streaming"} value="—" />
      <KVRow label={compounding ? "APY" : "APR"} value="—" border="none" />
      <NoteRow>Reading the chain and the monitor.</NoteRow>
      <KVRow label="Your deposit" value="—" />
      <KVRow label="Yours to claim" value={compounding ? "Compounded into shares" : "—"} border="none" />
    </>
  );
}

/** The prerendered section: same layout, figures pending, wallet button disabled. */
export function VaultsStatic() {
  return (
    <>
      <StatBand {...STATIC_BAND} />
      <ConnectBar note="Connect a wallet to deposit, withdraw and claim. Reading the vaults needs no wallet." right={<Button disabled>Connect wallet</Button>} />
      <VaultGrid>
        {LIVE_VAULTS.map((v) => (
          <Frame key={v.entry.address} vault={v} rows={<StaticStats vault={v} />}>
            <div style={body14}>Connect a wallet to deposit, withdraw{v.kind === "payout" ? " and claim" : ""}.</div>
            <div style={{ marginTop: 12 }}>
              <Button size="lg" disabled>
                Connect wallet
              </Button>
            </div>
          </Frame>
        ))}
      </VaultGrid>
    </>
  );
}
