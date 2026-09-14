import { useRef, type ReactNode } from "react";

import { Badge, Button, Card, Stat } from "@ouro/ds";
import { KVRow, MicroLabel, TokenIcon } from "~/components/site";
import { revealRow, useCollapse } from "~/hooks/useCollapse";
import { useEqualCardBodies } from "~/hooks/useEqualCardBodies";
import { LIVE_VAULTS, type LiveVault } from "~/content/vaults";

/* ────────────────────────────────────────────────────────────────────────────
   The vaults section's layout, with no wallet code in it.

   Two renderings share these pieces. `VaultsStatic` (below) is what the prerender writes and what
   the first client frame shows: every figure a dash and the wallet button disabled, so a crawler and
   a shared link get the real page rather than a spinner. `VaultsLive` (its own module, loaded on the
   client only) mounts the wallet tree and reads the chain. Keeping wagmi and RainbowKit out of this
   file keeps them out of the server bundle, which is what lets the prerender stay fast.

   SHAPE. One card per vault, three across: the pair it turns (OURO into OURO, ETH or dollars), what
   is pooled and the rate with its basis, three rows of the vault's own figures, and the two or three
   buttons. Deposit and Withdraw open the panel inside the card, under the buttons, on that tab;
   Collect (payout vaults) claims straight away. The panel opens by animated height (useCollapse) and
   is visibility:hidden once closed, which takes it out of the tab order.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The row of cards. It owns the height matching (hooks/useEqualCardBodies), which is why the grid is
 * a component rather than a bare div in each of the two renderings.
 */
export function VaultList({ children }: { children: ReactNode }) {
  const grid = useEqualCardBodies<HTMLDivElement>();
  return (
    <div className="vgrid" ref={grid}>
      {children}
    </div>
  );
}

/** The bar over the cards: the app's name and the pooled total on the left, the wallet on the right. */
export function VaultBar({ pooled, share, right }: { pooled: ReactNode; share: ReactNode; right: ReactNode }) {
  return (
    <div className="vbar">
      <div className="vbar__title">
        <span className="vbar__name">Ouro Vaults</span>
        <span className="vbar__pooled">
          {pooled} OURO pooled · {share} of floating supply
        </span>
      </div>
      <div className="vbar__wallet">{right}</div>
    </div>
  );
}

export interface VaultCardProps {
  n: string;
  vault: LiveVault;
  /** What is pooled, as a token amount, and the line under it (its dollar value, or why there is none). */
  pooled: ReactNode;
  pooledNote: ReactNode;
  /** The rate, "APY" on the compounding vault and "APR" on the payout ones, with where it comes from. */
  yieldLabel: "APY" | "APR";
  yieldValue: ReactNode;
  yieldNote: ReactNode;
  /** The vault's own figures, as KVRows. */
  rows: ReactNode;
  /** Deposits closed. */
  paused?: boolean;
  /** The buttons. */
  actions: ReactNode;
  /** The deposit and withdraw panel, mounted whether or not it is open so a half-typed amount survives. */
  panel?: ReactNode;
  open?: boolean;
}

/**
 * The two tokens a card is about: what you put in, and what it pays. One mark on the compounding
 * vault, which pays the token it holds.
 */
function TokenPair({ vault }: { vault: LiveVault }) {
  const { token, payoutIcon, payoutSymbol } = vault;
  return (
    <span className="vcard__pair">
      <span className="vcard__marks">
        <TokenIcon symbol={token.symbol} src={token.icon} size={26} />
        {payoutIcon && (
          <>
            <span className="vcard__arrow" aria-hidden="true">
              →
            </span>
            <TokenIcon symbol={payoutSymbol} src={payoutIcon} size={26} />
          </>
        )}
      </span>
      <span className="vcard__title">{vault.payout.summary(token)}</span>
    </span>
  );
}

export function VaultCard({ n, vault, pooled, pooledNote, yieldLabel, yieldValue, yieldNote, rows, paused = false, actions, panel, open = false }: VaultCardProps) {
  const box = useRef<HTMLDivElement>(null);
  const collapse = useCollapse(open, { onOpened: () => revealRow(box.current) });
  const label = `${n} · ${vault.payout.short(vault.token)}`;
  return (
    <div ref={box} className="vcard-wrap">
      {/* The card's own `label` and `action` props are not used: everything except the panel has to
          sit inside `.vcard__body`, which is the box whose height is matched across the row. */}
      <Card className="vcard">
        <div className="vcard__body">
          <div className="vcard__head">
            <MicroLabel>{label}</MicroLabel>
            {paused && <Badge tone="caution">Deposits paused</Badge>}
          </div>
          <div className="vcard__top">
            <TokenPair vault={vault} />
            <div className="vcard__figures">
              <Stat label="Pooled" value={pooled} unit={vault.token.symbol} footnote={pooledNote} />
              <Stat className="cell-rule" label={yieldLabel} value={yieldValue} footnote={yieldNote} />
            </div>
            <div className="vcard__rows">{rows}</div>
          </div>
          <div className="vcard__actions">{actions}</div>
        </div>
        {panel !== undefined && (
          <div className="vpanel" data-open={open ? "true" : "false"} ref={collapse.ref} onTransitionEnd={collapse.onTransitionEnd}>
            <div className="vpanel__content">{panel}</div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** The card's figures before the chain has been read. */
export function StaticRows({ vault }: { vault: LiveVault }) {
  const compounding = vault.kind === "compounding";
  return (
    <>
      {compounding ? (
        <KVRow label={`1 ${vault.token.symbol} deposited is now worth`} value={`— ${vault.token.symbol}`} />
      ) : (
        <KVRow label={`${vault.payoutSymbol} earned so far`} value={`— ${vault.payoutSymbol}`} />
      )}
      <KVRow label={compounding ? "Arriving over the next day" : "Streaming"} value="—" />
      <KVRow label="Your deposit" value="—" border="none" />
    </>
  );
}

export const CARD_INDEX = ["01", "02", "03", "04", "05", "06"];

/** The prerendered section: same cards, figures pending, every button disabled. */
export function VaultsStatic() {
  return (
    <>
      <VaultBar pooled="—" share="—" right={<Button size="sm" disabled>Connect wallet</Button>} />
      <VaultList>
        {LIVE_VAULTS.map((v, i) => (
          <VaultCard
            key={v.entry.address}
            n={CARD_INDEX[i] ?? String(i + 1)}
            vault={v}
            pooled="—"
            pooledNote="Reading the chain"
            yieldLabel={v.kind === "compounding" ? "APY" : "APR"}
            yieldValue="—"
            yieldNote="Reading the chain and the monitor"
            rows={<StaticRows vault={v} />}
            actions={
              <>
                <Button size="sm" disabled>
                  Deposit
                </Button>
                <Button size="sm" variant="secondary" disabled>
                  Withdraw
                </Button>
                {v.kind === "payout" && (
                  <Button size="sm" variant="secondary" disabled>
                    Collect
                  </Button>
                )}
              </>
            }
          />
        ))}
      </VaultList>
    </>
  );
}
