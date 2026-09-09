import { useRef, useState, type ReactNode } from "react";

import { Badge, Button, Card, Stat } from "~/components/ds";
import { AddressCell, Grid, KVRow, TokenIcon, body14, hairline, micro, mono } from "~/components/site";
import { revealRow, useCollapse } from "~/hooks/useCollapse";
import { LIVE_VAULTS, TERMS, type LiveVault } from "~/content/vaults";

/* ────────────────────────────────────────────────────────────────────────────
   The vaults section's layout, with no wallet code in it.

   Two renderings share these pieces. `VaultsStatic` (below) is what the prerender writes and what
   the first client frame shows: every figure a dash and the wallet button disabled, so a crawler and
   a shared link get the real page rather than a spinner. `VaultsLive` (its own module, loaded on the
   client only) mounts the wallet tree and reads the chain. Keeping wagmi and RainbowKit out of this
   file keeps them out of the server bundle, which is what lets the prerender stay fast.

   SHAPE. Each vault is one accordion row: a header that is always visible, carrying the name, TVL and
   the yield, over a body holding everything else, the deposit and withdraw panel included. Side by
   side the three cards ran past 800px tall, which is more than a screen and far more than a phone, so
   the figures could not be read across and the form sat below the fold. Closed, a row is one line.

   One row is open at a time (useOpenVault). A closed body stays mounted rather than being unmounted, so
   a half-typed amount and a chosen tab survive closing the row; it opens and closes by animating its
   height (useCollapse) and is `visibility: hidden` once closed, which takes it out of the tab order
   and the accessibility tree. Opening also brings the row up under the sticky nav when the card does
   not already fit on screen, which on a phone is always: without it the panel unfolds below the fold
   and the tap looks like it did nothing.

   The three headers share one column template (.vault-head in styles/site.css), so TVL and the yield
   line up down the page. On a phone the header drops to two lines, name over figures, and the
   payout's `short` line stands in for its `summary`; the body reorders so the deposit and withdraw
   panel comes FIRST, since that is what the tap was for, with the figures and then the prose under it
   (.vault-body__content's grid areas).
   ──────────────────────────────────────────────────────────────────────────── */

export interface StatBandProps {
  /** Deposits across the vaults, in dollars, with the OURO total as the footnote. */
  tvl: ReactNode;
  tvlNote: ReactNode;
  /** The measured airdrop rate the vaults' yield rests on, annualised, with its basis. */
  airdropRate: ReactNode;
  airdropNote: ReactNode;
}

/**
 * The band above the rows. TVL leads: it is the figure that moves and the one a reader is looking for,
 * and the vault count is context for it rather than the headline.
 *
 * Two of the four are live figures with caveats worth reading and two are fixed terms repeated
 * further down the page, so a phone keeps the live pair and drops the other (.stat--wide in
 * site.css) rather than stacking 450px of statistics over the app.
 */
export function StatBand({ tvl, tvlNote, airdropRate, airdropNote }: StatBandProps) {
  return (
    <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md stat-band">
      <Stat label="TVL" value={tvl} footnote={tvlNote} />
      <Stat
        className="cell-rule stat--wide"
        label="Vaults"
        value={String(LIVE_VAULTS.length)}
        footnote="All pooling OURO, paid in OURO, WETH or USDG. Each clears the 100,000 OURO airdrop line for everyone in it"
      />
      <Stat className="cell-rule" label="Airdrop rate" value={airdropRate} footnote={airdropNote} />
      <Stat
        className="cell-rule stat--wide"
        label="Performance fee"
        value={`${TERMS.performanceFeePct}%`}
        footnote={`Of harvest gains only, and no deposit or withdrawal fee. ${TERMS.feeSplit.airdrops}% of the gain funds more airdrops, ${TERMS.feeSplit.ops}% covers ops`}
      />
    </Grid>
  );
}

export const STATIC_BAND: StatBandProps = {
  tvl: "—",
  tvlNote: "Deposits across the three vaults, priced in dollars from the chain and the monitor",
  airdropRate: "—",
  airdropNote: "What a wallet above the line earns from payouts actually made, annualised, before any vault fee",
};

/**
 * The bar over the rows: the app's name on the left, the wallet button on the right.
 *
 * It used to carry a note that changed with the wallet state, which meant the row above the rows was
 * either a paragraph of instructions or empty. A fixed title is steadier and reads as the app's
 * header, which is what this line is. What a wallet is for is said at the point of need instead, on
 * the deposit panel's own hint.
 *
 * Not a heading element: the page's h1 is already "The vaults.", and a near-duplicate h2 under it
 * would be a worse outline, not a better one.
 */
export function ConnectBar({ right }: { right: ReactNode }) {
  return (
    <div className="connect-bar">
      <div className="connect-bar__title">Ouro Vaults</div>
      <div className="connect-bar__action">{right}</div>
    </div>
  );
}

/** The rows, stacked. */
export function VaultList({ children }: { children: ReactNode }) {
  return <div className="vault-list">{children}</div>;
}

/** One row open at a time, keyed by vault address; clicking the open row closes it. */
export function useOpenVault() {
  const [open, setOpen] = useState<string | null>(null);
  return {
    isOpen: (id: string) => open === id,
    toggle: (id: string) => setOpen((current) => (current === id ? null : id)),
  };
}

/** The two figures a closed row shows. */
export interface VaultSummary {
  /** Deposits in dollars, or the token amount while there is no price. */
  tvl: ReactNode;
  /** "APY" on the compounding vault, "APR" on the payout ones. */
  yieldLabel: string;
  yieldValue: ReactNode;
}

function Figure({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <span className="vault-head__fig">
      <span className="vault-head__fig-label" style={{ ...micro, fontSize: 10, color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ ...mono, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflowWrap: "anywhere" }}>{value}</span>
    </span>
  );
}

/**
 * The two tokens a row is about: what you put in, and what it pays.
 *
 * Side by side rather than overlapped, which is the usual way to draw a pair but wrong for these
 * marks: all three are a single glyph centred on a disc (see public/tokens), so a front disc laid
 * over a third of the one behind ate the glyph that identifies it and OURO's "O" came out as a "C".
 *
 * One mark, not two, on the compounding vault: it pays the token it holds, so the same disc twice
 * would look like a rendering bug rather than a fact.
 */
function TokenPair({ vault }: { vault: LiveVault }) {
  const { token, payoutIcon, payoutSymbol } = vault;
  return (
    <span className="vault-head__marks">
      <TokenIcon symbol={token.symbol} src={token.icon} size={22} />
      {payoutIcon && <TokenIcon symbol={payoutSymbol} src={payoutIcon} size={22} />}
    </span>
  );
}

function Chevron() {
  return (
    <svg className="vault-head__chev" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4.5 7L9 11.5L13.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface FrameProps {
  vault: LiveVault;
  /** What the header carries whether the row is open or closed. */
  summary: VaultSummary;
  /** Where the yield figure comes from: small print under the figures. */
  note: ReactNode;
  /** The vault's own figures, as KVRows. */
  rows: ReactNode;
  /** Deposits closed. Said in the header because the panel that also says it is hidden when closed. */
  paused?: boolean;
  open: boolean;
  onToggle: () => void;
  /** The deposit and withdraw panel. */
  children: ReactNode;
}

/** One vault as an accordion row. */
export function Frame({ vault, summary, note, rows, paused = false, open, onToggle, children }: FrameProps) {
  const { token, payout, entry } = vault;
  const bodyId = `vault-${entry.address}`;
  const head = useRef<HTMLButtonElement>(null);
  const body = useCollapse(open, { onOpened: () => revealRow(head.current?.closest("section") ?? null) });
  return (
    <Card padding={0} className="vault-card">
      <button type="button" ref={head} className="vault-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="vault-head__name">
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <TokenPair vault={vault} />
            {/* Explicit on purpose: "OURO → USDG" reads like a swap, which is the single most common
                misreading of this page. Deposit / Earn says what actually happens. */}
            <span className="vault-head__title">
              Deposit {token.symbol} · Earn {vault.payoutSymbol}
            </span>
            {paused ? <Badge tone="caution">Deposits paused</Badge> : (
              <Badge tone="positive" dot>
                Live
              </Badge>
            )}
          </span>
          {/* The same fact at two lengths: the stylesheet shows whichever one fits the viewport. */}
          <span className="vault-head__sub vault-head__sub--long">{payout.summary(token)}</span>
          <span className="vault-head__sub vault-head__sub--short">{payout.short(token)}</span>
        </span>
        <span className="vault-head__figs">
          <Figure label="TVL" value={summary.tvl} />
          <Figure label={summary.yieldLabel} value={summary.yieldValue} />
        </span>
        <Chevron />
      </button>

      {/* The height is animated on .vault-body, which also clips; the padding and the divider sit on
          __content, because a padded, bordered box is never really zero-height. */}
      <div id={bodyId} className="vault-body" data-open={open ? "true" : "false"} ref={body.ref} onTransitionEnd={body.onTransitionEnd}>
        <div className="vault-body__content">
          <Card tone="tint" padding={20} className="vault-part vault-part--panel">
            {children}
          </Card>

          <div className="vault-part vault-part--figs">{rows}</div>

          <div className="vault-part vault-part--note">
            <span style={{ ...micro, fontSize: 10, color: "var(--text-muted)", flex: "none" }}>{summary.yieldLabel}</span>
            <span style={{ minWidth: 0 }}>{note}</span>
          </div>

          <div className="vault-part vault-part--about">
            <div style={body14}>{payout.text(token)}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", ...mono, fontSize: 12, color: "var(--text-faint)" }}>
              <span>{entry.shareSymbol}</span>
              <AddressCell address={entry.address} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** The body's figures before the chain has been read. */
export function StaticStats({ vault }: { vault: LiveVault }) {
  const compounding = vault.kind === "compounding";
  return (
    <>
      <KVRow label="Pooled" value={`— ${vault.token.symbol}`} />
      <KVRow label={compounding ? "Share price" : "Owed to depositors"} value={`— ${compounding ? vault.token.symbol : vault.payoutSymbol}`} />
      <KVRow label={compounding ? "Vesting to depositors" : "Streaming"} value="—" />
      <KVRow label="Your deposit" value="—" />
      <KVRow label="Yours to claim" value={compounding ? "Compounded into shares" : "—"} border="none" />
    </>
  );
}

/** The prerendered section: same rows, figures pending, wallet button disabled. */
export function VaultsStatic() {
  const { isOpen, toggle } = useOpenVault();
  return (
    <>
      <StatBand {...STATIC_BAND} />
      <ConnectBar right={<Button disabled>Connect wallet</Button>} />
      <VaultList>
        {LIVE_VAULTS.map((v) => (
          <Frame
            key={v.entry.address}
            vault={v}
            open={isOpen(v.entry.address)}
            onToggle={() => toggle(v.entry.address)}
            summary={{ tvl: "—", yieldLabel: v.kind === "compounding" ? "APY" : "APR", yieldValue: "—" }}
            note="Reading the chain and the monitor."
            rows={<StaticStats vault={v} />}
          >
            <div style={body14}>Connect a wallet to deposit, withdraw{v.kind === "payout" ? " and claim" : ""}.</div>
            <div className="vault-cta" style={{ marginTop: 12 }}>
              <Button size="lg" disabled>
                Connect wallet
              </Button>
            </div>
          </Frame>
        ))}
      </VaultList>
    </>
  );
}
