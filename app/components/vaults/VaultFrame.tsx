import { useEffect, useRef, useState, type ReactNode, type TransitionEvent } from "react";

import { Badge, Button, Card, Stat } from "~/components/ds";
import { AddressCell, Grid, KVRow, TokenIcon, body14, hairline, micro, mono } from "~/components/site";
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
   height (useHeightToggle below, .vault-body in styles/site.css) and is `visibility: hidden` once
   closed, which takes it out of the tab order and the accessibility tree.

   The three headers share one column template (.vault-head in styles/site.css), so TVL and the yield
   line up down the page; below 720px the two figures drop to their own line under the name.
   ──────────────────────────────────────────────────────────────────────────── */

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

/** The rows, stacked. */
export function VaultList({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 12 }}>{children}</div>;
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
      <span style={{ ...micro, fontSize: 10, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ ...mono, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", overflowWrap: "anywhere" }}>{value}</span>
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

/**
 * Open and close by animating the panel's height between 0 and the height its content actually needs,
 * measured at the moment of the toggle. The stylesheet owns only the resting states (closed is
 * `height: 0`), so the prerendered HTML is correct before any of this runs.
 *
 * NOT the `grid-template-rows: 0fr -> 1fr` trick, which reads far better but is wrong here: in Chrome
 * an auto-height grid with a sub-1fr row sizes the CONTAINER to `fr x content` and the item inside it
 * to `fr x fr x content`, so all the way through the animation the card is taller than the content it
 * is revealing and an empty band grows under the panel (measured: at 0.5fr, a 435px panel gives a
 * 218px card holding 109px of content). A max-height transition has no such bug but buys it back as
 * dead time, since the value has to be guessed high. Measured heights have neither.
 */
function useHeightToggle(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Deliberately not useLayoutEffect: this module is in the server bundle for the prerender, and
  // nothing here can flash, since the height does not change until the effect itself changes it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The first pass is the resting state the stylesheet already renders, not a transition.
    if (!started.current) {
      started.current = true;
      if (!open) return;
      el.style.height = "auto";
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.height = open ? "auto" : "";
      return;
    }
    // Read the height before writing one: mid-transition this is what is on screen, so a toggle that
    // interrupts another carries on from where it is rather than jumping to an end state first.
    const from = el.getBoundingClientRect().height;
    const to = open ? el.scrollHeight : 0;
    el.style.height = `${from}px`;
    void el.offsetHeight; // take `from` as the start of the transition, not the value before it
    el.style.height = `${to}px`;
  }, [open]);

  const onTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.target !== el || e.propertyName !== "height") return;
    // Hand the height back: `auto` while open, so a live figure or a transaction line can change it
    // underneath us, and nothing at all once closed, which is the stylesheet's own resting state.
    el.style.height = open ? "auto" : "";
  };

  return { ref, onTransitionEnd };
}

export interface FrameProps {
  vault: LiveVault;
  /** What the header carries whether the row is open or closed. */
  summary: VaultSummary;
  /** Where the yield figure comes from: small print at the top of the open body, under its column. */
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
  const body = useHeightToggle(open);
  return (
    <Card padding={0}>
      <button type="button" className="vault-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="vault-head__name">
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <TokenIcon symbol={token.symbol} src={token.icon} size={22} />
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {token.symbol} → {vault.payoutSymbol}
            </span>
            {paused ? <Badge tone="caution">Deposits paused</Badge> : (
              <Badge tone="positive" dot>
                Live
              </Badge>
            )}
          </span>
          <span style={{ display: "block", marginTop: 5, fontSize: 13, lineHeight: 1.45, color: "var(--text-muted)" }}>{payout.summary(token)}</span>
        </span>
        <Figure label="TVL" value={summary.tvl} />
        <Figure label={summary.yieldLabel} value={summary.yieldValue} />
        <Chevron />
      </button>

      {/* The height is animated on .vault-body, which also clips; the padding and the divider sit on
          __content, because a padded, bordered box is never really zero-height. */}
      <div id={bodyId} className="vault-body" data-open={open ? "true" : "false"} ref={body.ref} onTransitionEnd={body.onTransitionEnd}>
        <div className="vault-body__content">
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", paddingBottom: 14, borderBottom: hairline, fontSize: 12, lineHeight: 1.5, color: "var(--text-faint)" }}>
            <span style={{ ...micro, fontSize: 10, color: "var(--text-muted)", flex: "none" }}>{summary.yieldLabel}</span>
            <span style={{ minWidth: 0 }}>{note}</span>
          </div>
          <Grid cols="1.1fr 0.9fr" gap={32} align="start" style={{ marginTop: 18 }}>
            <div>
              <div style={body14}>{payout.text(token)}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", ...mono, fontSize: 12, color: "var(--text-faint)" }}>
                <span>{entry.shareSymbol}</span>
                <AddressCell address={entry.address} />
              </div>
              <div style={{ marginTop: 18, borderTop: hairline }}>{rows}</div>
            </div>
            <Card tone="tint" padding={20}>
              {children}
            </Card>
          </Grid>
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
      <ConnectBar note="Connect a wallet to deposit, withdraw and claim. Reading the vaults needs no wallet." right={<Button disabled>Connect wallet</Button>} />
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
            <div style={{ marginTop: 12 }}>
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
