import { useSearchParams } from "react-router";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { useAccount } from "wagmi";

import { Callout } from "@ouro/ds";
import {
  OURO,
  PortfolioBody,
  PortfolioHeader,
  PortfolioStatic,
  STATIC_VIEW,
  ViewingNote,
  type HoldingRowView,
  type MetricView,
  type NextView,
  type PortfolioView,
  type VaultRowView,
} from "~/components/portfolio/PortfolioFrame";
import { ShareCardTrigger } from "~/components/portfolio/ShareCard";
import { WalletButton } from "~/components/wallet/WalletButton";
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { BASKET_TOKENS, shortAddress } from "~/content/protocol";
import { canonicalPath } from "~/lib/meta";
import { site } from "~/content/site";
import { LIVE_VAULTS } from "~/content/vaults";
import { useAirdropPayments, usePortfolioSummary, type PaymentsFeed } from "~/hooks/usePortfolio";
import { ago, fmtDay, fmtNum, fmtPct, fmtTokens, fmtUsd, fmtWhen, type Poll, type PortfolioSummary } from "@ouro/monitor-client";
import type { ShareCardData, ShareCardRow } from "~/lib/shareCard";
import { fmtAmount } from "~/lib/vaultChain";

/* ────────────────────────────────────────────────────────────────────────────
   The live portfolio. Loaded on the client only (routes/portfolio.tsx imports it lazily once
   mounted), so this module and everything it pulls in, wagmi, RainbowKit and viem, never reach the
   server bundle or the prerender.

   WHOSE. The connected wallet's. An address in `?address=` takes over when there is one, so a link
   to another wallet's page shows that wallet to everyone who opens it; an address that is not one is
   simply ignored. The query string is only read here, after hydration: the route is prerendered and
   there is no query string at build time.

   Reading needs no wallet. Everything on the page comes from ouro-monitor's portfolio endpoints
   (hooks/usePortfolio.ts): one summary payload, polled, and the payments a page at a time. The
   wallet is only for knowing whose page to show.
   ──────────────────────────────────────────────────────────────────────────── */

const DASH = "—";
/** Robinhood Chain seals a block every tenth of a second, so this is five minutes of snapshot lag. */
const STALE_BLOCKS = 3_000;

export default function PortfolioLive() {
  return (
    <WalletProvider fallback={<PortfolioStatic />}>
      <LiveSection />
    </WalletProvider>
  );
}

/** The address in `?address=`, checksummed, or null when there is none or it is not one. Any case is accepted; a wrong checksum is not a wrong address. */
function addressParam(raw: string | null): Address | null {
  const s = raw?.trim() ?? "";
  return s !== "" && isAddress(s, { strict: false }) ? getAddress(s) : null;
}

function LiveSection() {
  const { address: connected } = useAccount();
  const [params] = useSearchParams();
  const linked = addressParam(params.get("address"));
  const viewing: Address | null = linked ?? connected ?? null;
  const mine = viewing !== null && connected !== undefined && viewing.toLowerCase() === connected.toLowerCase();

  const summary = usePortfolioSummary(viewing);
  const feed = useAirdropPayments(viewing);
  const view = buildView({ viewing, mine, summary, feed });
  const p = summary.data;
  const share = p ? shareCard(p) : null;

  return (
    <>
      <PortfolioHeader
        note={viewing && !mine ? <ViewingNote address={viewing} /> : undefined}
        right={
          <>
            {share && <ShareCardTrigger card={share.card} holdingRow={share.holdingRow} fileStem={share.fileStem} />}
            <WalletButton />
          </>
        }
      />
      {viewing && summary.error && (
        <Callout tone="caution" title="ouro-monitor is not answering" style={{ marginTop: 28 }}>
          {p ? "Showing its last good read. " : "Every figure stays a dash until it does; nothing here is cached or estimated. "}It said: {summary.error}
        </Callout>
      )}
      {viewing && p?.liveError && (
        <Callout tone="caution" title={`${site.chain.name} did not answer the monitor`} style={{ marginTop: 28 }}>
          What the wallet holds and its vault deposits stay a dash until it does. The monitor said: {p.liveError}
        </Callout>
      )}
      {viewing && p && p.blocksBehind !== null && p.blocksBehind > STALE_BLOCKS && (
        <Callout tone="caution" title="The monitor's holder snapshot is behind the chain" style={{ marginTop: 28 }}>
          By {fmtNum(p.blocksBehind)} blocks, about {ago(p.blocksBehind / 10)}. The balance, the standing and the share come from that snapshot; what the wallet
          holds is read live.
        </Callout>
      )}
      <PortfolioBody view={view} historyKey={viewing ?? "none"} />
    </>
  );
}

/* ── from data to what the page prints ────────────────────────────────────── */

interface Inputs {
  viewing: Address | null;
  mine: boolean;
  summary: Poll<PortfolioSummary>;
  feed: PaymentsFeed;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** What the site knows about a token the monitor names, by address: its mark, and the name the rest of the site uses for it. */
const KNOWN = new Map<string, { name: string; icon?: string }>();
KNOWN.set(OURO.address.toLowerCase(), { name: OURO.name, icon: OURO.icon });
for (const t of BASKET_TOKENS) KNOWN.set(t.address.toLowerCase(), { name: t.name, icon: t.icon });

/** A raw amount from the monitor as a bigint, or undefined when it is not one. */
function raw(s: string | null | undefined): bigint | undefined {
  return s !== null && s !== undefined && /^\d+$/.test(s) ? BigInt(s) : undefined;
}

/** A claimable amount: exact to a millionth, then "<0.000001". A dust claim reads as one either way. */
function fmtEarned(amount: string | null, decimals: number): string {
  return fmtAmount(raw(amount), decimals, 6);
}

/** "1,234 OURO ($5.20)", or the amount alone while the price is unknown. */
function amountUsd(amountF: number, symbol: string, usd: number | null): string {
  const amount = `${fmtTokens(amountF)} ${symbol}`;
  return usd === null ? amount : `${amount} (${fmtUsd(usd)})`;
}

/** A transaction hash the explorer can be pointed at, or null for anything else. */
const hex = (s: string): Hex | null => (/^0x[0-9a-fA-F]{64}$/.test(s) ? (s as Hex) : null);

/**
 * The card behind the Share button, for whichever wallet is on screen: offered paid or not, its code
 * opens this wallet's own portfolio, and the address is printed beside the code. The balance is
 * offered behind a toggle in the dialog; the projected rate stays off it.
 */
function shareCard(p: PortfolioSummary): { card: ShareCardData; holdingRow: ShareCardRow | null; fileStem: string } {
  const excluded = p.eligible && p.excluded !== null;
  const paidCount = p.airdropPayments;
  const priced = p.totalAirdropUsd !== null;
  const address = getAddress(p.address);

  const vaultPositions = Array.isArray(p.vaults) ? p.vaults : [];
  const vaultOuro = vaultPositions.reduce((sum, v) => sum + (v.depositSymbol === OURO.symbol && v.assetsF > 0 ? v.assetsF : 0), 0);
  const claimable = vaultPositions.filter((v) => v.earnedF !== null && v.earnedF > 0);
  const claimableRow = vaultClaimableRow(claimable);
  const vaultEarnedRow = vaultEarnedShareRow(p);

  const rows: ShareCardRow[] = [];
  if (vaultOuro > 0) rows.push({ label: "In the vaults", value: `${fmtTokens(vaultOuro)} OURO` });
  if (vaultEarnedRow) rows.push(vaultEarnedRow);
  else if (claimableRow) rows.push(claimableRow);
  if (p.shareOfEligible !== null) rows.push({ label: "Share of every cycle", value: fmtPct(p.shareOfEligible, 4) });
  if (priced) rows.push({ label: "Payments", value: fmtNum(paidCount) });
  if (p.lastAirdropTs) rows.push({ label: "Latest", value: fmtDay(p.lastAirdropTs) });
  if (paidCount === 0) rows.push({ label: "The line", value: `${fmtNum(p.lineTokens)} OURO` });

  const sub = excluded
    ? "Excluded by policy. No cycle pays this address."
    : paidCount === 0
      ? p.eligible
        ? "Not paid yet. The next cycle includes this wallet."
        : vaultOuro > 0
          ? "Not paid yet. Vault deposits earn through the vaults, not the line."
          : "Not paid yet. It is below the line."
      : priced
        ? vaultOuro > 0 && !p.eligible
          ? "Paid to one wallet by the Ouro airdrop. Vault deposits are separate."
          : "Paid to one wallet by the Ouro airdrop."
        : "Received by one wallet. Some legs are not priced yet.";

  const footnote =
    paidCount > 0
      ? vaultOuro > 0
        ? "Each airdrop is valued at what its cycle paid out, not today's price. Vault deposits earn through the vaults and do not count toward the line."
        : "Each payment is valued at what its cycle paid the token out at, not at today's price. Past payouts are not a promise of future ones."
      : vaultOuro > 0
        ? "Vault deposits earn through the vaults and do not count toward the line. Nothing here is a promise of future payouts."
        : "Wallets at or above the line are paid every cycle, in the tokens the airdrop holds. Nothing here is a promise of future payouts.";

  return {
    card: {
      kicker: "Airdrops received",
      hero: priced ? fmtUsd(p.totalAirdropUsd) : `${fmtNum(paidCount)} ${plural(paidCount, "payment", "payments")}`,
      sub,
      stamp: `${fmtDay(p.generatedAt)} · ${new Date(p.generatedAt * 1000).toISOString().slice(11, 16)} UTC`,
      badge: excluded ? { text: "Excluded by policy", tone: "negative" } : p.eligible ? { text: "Above the line · paid every cycle", tone: "positive" } : { text: "Below the line", tone: "caution" },
      rows: rows.slice(0, 3),
      footnote,
      cta: {
        caps: "Scan for this wallet",
        line: "Every payout, read from the chain.",
        site: site.url.replace(/^https?:\/\//, ""),
        address: shortAddress(address),
        href: `${site.url}${canonicalPath("/portfolio")}?address=${address}`,
      },
    },
    holdingRow: {
      label: vaultOuro > 0 ? "In wallet" : "Holding",
      value: `${fmtTokens(p.balanceTokens)} OURO`,
    },
    fileStem: `ouro-portfolio-${address.slice(0, 8).toLowerCase()}`,
  };
}

/** Claimable payout-vault rewards, as one row. Used when lifetime vault earned is not yet known. */
function vaultClaimableRow(claimable: NonNullable<PortfolioSummary["vaults"]>): ShareCardRow | null {
  if (claimable.length === 0) return null;
  const allPriced = claimable.every((v) => v.earnedUsd !== null);
  if (allPriced) {
    const usd = claimable.reduce((sum, v) => sum + (v.earnedUsd ?? 0), 0);
    return { label: "Vaults to collect", value: fmtUsd(usd) };
  }
  const parts = claimable.flatMap((v) => (v.earnedF !== null && v.earnedF > 0 ? [`${fmtTokens(v.earnedF)} ${v.payoutSymbol}`] : []));
  if (parts.length === 0) return null;
  return { label: "Vaults to collect", value: parts.join(" + ") };
}

/** Lifetime vault rewards (claimed + claimable), when the monitor has priced them. */
function vaultEarnedShareRow(p: PortfolioSummary): ShareCardRow | null {
  if (p.totalVaultEarnedUsd === null || p.totalVaultEarnedUsd <= 0) return null;
  return { label: "Received from the vaults", value: fmtUsd(p.totalVaultEarnedUsd) };
}

function buildView(i: Inputs): PortfolioView {
  const { viewing, summary, feed } = i;
  const p = summary.data;
  const S = STATIC_VIEW;
  const line = fmtNum(p?.lineTokens ?? OURO.thresholdTokens);
  /** The footnote while there is no payload yet: the first read is in flight, or it failed. */
  const pendingWord = summary.error ? "The monitor did not answer" : "Reading the monitor";
  // Standing. The monitor calls any balance at or above the line `eligible`, policy exclusions
  // included, so a wallet that is paid is eligible AND not excluded.
  const excluded = p && p.eligible && p.excluded !== null ? p.excluded : null;
  const paid = p !== null && p.eligible && excluded === null;

  const standing: MetricView["badge"] = !viewing
    ? undefined
    : !p
      ? { tone: "neutral", label: summary.error ? "Monitor unreachable" : "Reading the monitor" }
      : excluded
        ? { tone: "negative", label: "Excluded by policy" }
        : p.eligible
          ? { tone: "positive", label: "Above the line" }
          : { tone: "caution", label: "Below the line" };

  const vaultPositions = p && Array.isArray(p.vaults) ? p.vaults : null;
  const vaultOuro = vaultPositions?.reduce((sum, v) => sum + (v.depositSymbol === OURO.symbol && v.assetsF > 0 ? v.assetsF : 0), 0) ?? 0;

  const balanceFootnote = !viewing
    ? S.metrics.balance.footnote
    : !p
      ? pendingWord
      : (() => {
          const priced = p.balanceUsd === null || p.priceUsd === null ? "Awaiting a price from the monitor" : `${fmtUsd(p.balanceUsd)} at ${fmtUsd(p.priceUsd, { exact: true })} each`;
          return vaultOuro > 0 ? `${priced} · ${fmtTokens(vaultOuro)} OURO in the vaults` : priced;
        })();

  const balanceNote = !viewing
    ? S.metrics.balance.note
    : vaultOuro > 0 && p
      ? `${fmtTokens(p.balanceTokens)} OURO in the wallet, and ${fmtTokens(vaultOuro)} OURO in the vaults below. Vault deposits earn through the vault and do not count toward the line.`
      : `${i.mine ? "Your connected wallet" : "The wallet named in the link"}, read through ouro-monitor and refreshed every thirty seconds.`;

  const metrics: PortfolioView["metrics"] = {
    balance: {
      value: p ? fmtTokens(p.balanceTokens) : DASH,
      unit: OURO.symbol,
      footnote: balanceFootnote,
      badge: standing,
      note: balanceNote,
    },
    share: {
      value: !p ? DASH : p.shareOfEligible !== null ? fmtPct(p.shareOfEligible, 4) : paid ? DASH : "0%",
      footnote: p?.eligibleSupplyTokens != null ? `of ${fmtNum(p.eligibleSupplyTokens)} $OURO above the line` : S.metrics.share.footnote,
      note: !p
        ? S.metrics.share.note
        : excluded
          ? `Never paid, however large. The monitor's note on this address: ${excluded}.`
          : p.eligible
            ? S.metrics.share.note
            : `${fmtTokens(p.shortfallTokens)} more $OURO clears the line. Below it a wallet gets nothing from any cycle.`,
    },
    received: (() => {
      const vaultEarned = p && p.totalVaultEarnedUsd !== null && p.totalVaultEarnedUsd > 0 ? p.totalVaultEarnedUsd : null;
      const vaultOnRateCard = vaultEarned !== null && p?.projectedUsdPerDay == null;
      const showVaultHere = vaultEarned !== null && !vaultOnRateCard;
      const airdropFoot = !viewing
        ? null
        : !p
          ? pendingWord
          : p.airdropPayments === 0
            ? "No airdrop payments yet"
            : p.totalAirdropUsd === null
              ? `${fmtNum(p.airdropPayments)} ${plural(p.airdropPayments, "payment", "payments")}, at least one not priced yet`
              : `${fmtNum(p.airdropPayments)} ${plural(p.airdropPayments, "payment", "payments")}, the latest ${fmtWhen(p.lastAirdropTs)}`;
      const footnote = !viewing
        ? S.metrics.received.footnote
        : !p
          ? pendingWord
          : showVaultHere
            ? airdropFoot
              ? `${airdropFoot}. In addition, received ${fmtUsd(vaultEarned)} from the vaults`
              : `Received ${fmtUsd(vaultEarned)} from the vaults`
            : airdropFoot;
      return {
        value: p ? fmtUsd(p.totalAirdropUsd) : DASH,
        footnote,
        note:
          vaultEarned !== null
            ? vaultOnRateCard
              ? "Valued at what each cycle paid the tokens out at, not today's price. Vault rewards are in the next card."
              : "Valued at what each cycle paid out, not today's price. The vault figure is claimed, claimable and compounding gain, separate from the line."
            : S.metrics.received.note,
      };
    })(),
    rate: (() => {
      const vaultEarned = p && p.projectedUsdPerDay == null && p.totalVaultEarnedUsd !== null && p.totalVaultEarnedUsd > 0 ? p.totalVaultEarnedUsd : null;
      if (vaultEarned !== null) {
        return {
          label: "Received from the vaults",
          value: fmtUsd(vaultEarned),
          footnote:
            p!.vaultClaims > 0
              ? `${fmtNum(p!.vaultClaims)} ${plural(p!.vaultClaims, "claim", "claims")}${p!.lastVaultClaimTs ? `, the latest ${fmtWhen(p!.lastVaultClaimTs)}` : ""}`
              : "Claimed, claimable, and compounding gain",
          note: "What the vaults have returned this wallet. Deposits earn through the vault and do not count toward the line.",
        };
      }
      return {
        value: p?.projectedUsdPerDay != null ? fmtUsd(p.projectedUsdPerDay) : DASH,
        unit: p?.projectedUsdPerDay != null ? "/ day" : undefined,
        footnote:
          p?.projectedUsdPerDay != null
            ? `${fmtUsd(p.projectedUsdPerMonth ?? p.projectedUsdPerDay * 30)} a month, at the average of recent cycles`
            : !viewing
              ? S.metrics.rate.footnote
              : !p
                ? pendingWord
                : excluded
                  ? "Nothing is paid to this address"
                  : p.eligible
                    ? "Needs priced payouts to project from"
                    : "Nothing is paid below the line",
        note: S.metrics.rate.note,
      };
    })(),
  };

  const rows = feed.payments ?? [];
  const read = viewing !== null && feed.payments !== null;
  const total = feed.complete ? rows.length : Math.max(rows.length, p?.airdropPayments ?? 0);
  const history: PortfolioView["history"] = {
    rows: rows.map((r) => ({
      key: r.tx,
      when: fmtWhen(r.ts),
      cycle: `#${r.cycle}`,
      tokens: r.assets.map((a) => `${fmtTokens(a.amountF)} ${a.symbol ?? shortAddress(a.address)}`).join(" · ") || DASH,
      value: fmtUsd(r.paidUsd),
      tx: hex(r.tx),
    })),
    total,
    loadMore: read && !feed.complete ? feed.loadMore : undefined,
    loadingMore: feed.loadingMore,
    problem: feed.error,
    empty: !viewing
      ? S.history.empty
      : !read
        ? feed.error
          ? `The monitor could not be read: ${feed.error}`
          : "Reading the monitor…"
        : excluded
          ? "Nothing, by policy: this address is infrastructure, not a holder."
          : p?.eligible
            ? "No airdrops yet. This wallet clears the line, so the next cycle includes it."
            : `No airdrops yet. Hold ${line} $OURO at the next cycle to be included, or pool with others in the vaults.`,
    status: !viewing ? "" : !read ? (feed.error ? "unavailable" : "reading…") : `${fmtNum(total)} ${plural(total, "payment", "payments")}${feed.error ? " · refresh failed" : ""}`,
  };

  const n = p?.next;
  let next: NextView;
  if (!viewing || !p || !n) {
    next = { ...S.next, footnote: !viewing ? S.next.footnote : pendingWord };
  } else if (n.status === "due-next-cycle" || n.status === "accruing") {
    const due = n.status === "due-next-cycle";
    next = {
      payAt: n.estimatedPayTs,
      badge: due ? { tone: "positive", label: "Due next cycle" } : { tone: "caution", label: "Accruing" },
      footnote:
        n.estimatedPayTs === null
          ? "No estimate yet"
          : due
            ? `Expected with the next cycle, ${fmtWhen(n.estimatedPayTs)}`
            : `Expected ${fmtWhen(n.estimatedPayTs)}, about ${fmtNum(n.cyclesUntilPay)} ${plural(n.cyclesUntilPay ?? 0, "cycle", "cycles")} from now`,
      rows: due
        ? [{ label: "Credited every cycle", value: fmtUsd(n.estimatedPerCycleUsd) }]
        : [
            { label: "Next cycle", value: fmtWhen(n.nextCycleTs) },
            { label: "Credited every cycle", value: fmtUsd(n.estimatedPerCycleUsd) },
            { label: "Owed, not yet sent", value: `${fmtUsd(n.pendingUsd)} of ${fmtUsd(n.dustThresholdUsd)}` },
          ],
      text: due
        ? "An estimate from this wallet's share and recent payouts, if gas stays ordinary. The keeper wakes every two hours and pays every wallet whose credit covers the gas to send it."
        : "Credited every cycle, and paid once what it is owed covers about five times the gas to send it. Nothing owed is cancelled; a smaller holding simply waits a few cycles between payments.",
    };
  } else if (n.status === "excluded") {
    next = {
      payAt: null,
      badge: { tone: "negative", label: "Excluded by policy" },
      footnote: "No payment is due",
      rows: [{ label: "Next cycle", value: fmtWhen(n.nextCycleTs) }],
      text: `Never paid, however large. The monitor's note on this address: ${n.reason ?? p.excluded ?? "excluded by policy"}.`,
    };
  } else if (n.status === "ineligible") {
    next = {
      payAt: null,
      badge: { tone: "caution", label: "Below the line" },
      footnote: "No payment is due",
      rows: [{ label: "Next cycle", value: fmtWhen(n.nextCycleTs) }],
      text: `Wallets below the line are not credited in any cycle. ${fmtTokens(p.shortfallTokens)} more $OURO before the next one puts this wallet in it.`,
    };
  } else {
    next = {
      payAt: null,
      badge: { tone: "neutral", label: "No estimate" },
      footnote: "Not enough priced history to project from",
      rows: [{ label: "Next cycle", value: fmtWhen(n.nextCycleTs) }],
      text: "The monitor cannot project a payment for this wallet yet. It is still credited in every cycle it clears the line for.",
    };
  }

  const held = p && Array.isArray(p.holdings) ? p.holdings : null;
  const holdingRows: HoldingRowView[] = held
    ? held.map((h) => {
        const known = KNOWN.get(h.address.toLowerCase());
        return {
          key: h.address,
          symbol: h.symbol,
          name: known?.name ?? h.name,
          icon: known?.icon,
          amount: fmtTokens(h.balanceF),
          value: h.usd !== null ? fmtUsd(h.usd) : h.balanceF === 0 ? fmtUsd(0) : "no price yet",
        };
      })
    : S.holdings.rows;
  const holdingsTotal = held && p && !held.some((h) => h.usd === null && h.balanceF > 0) ? fmtUsd(p.holdingsTotalUsd) : DASH;

  const vaultRows: VaultRowView[] = LIVE_VAULTS.map((v) => {
    const pos = vaultPositions?.find((x) => x.address.toLowerCase() === v.entry.address.toLowerCase());
    return {
      key: v.entry.address,
      title: `Deposit ${v.token.symbol} · Earn ${v.payoutSymbol}`,
      deposit: !viewing || !vaultPositions ? DASH : !pos || pos.assetsF === 0 ? "Nothing deposited" : amountUsd(pos.assetsF, pos.depositSymbol, pos.assetsUsd),
      // The compounding vault has nothing to claim: its figure is the gain on the cost basis, which
      // the monitor serves as `earnedF` with no raw amount beside it.
      collect:
        pos && pos.earnedF !== null && pos.earnedF > 0
          ? v.kind === "compounding"
            ? `${fmtTokens(pos.earnedF)} ${pos.payoutSymbol} earned${pos.earnedUsd !== null ? ` (${fmtUsd(pos.earnedUsd)})` : ""}`
            : `${fmtEarned(pos.earned, v.payoutDecimals)} ${pos.payoutSymbol}${pos.earnedUsd !== null ? ` (${fmtUsd(pos.earnedUsd)})` : ""} to collect`
          : undefined,
    };
  });
  const vaultsTotal = viewing && vaultPositions && p ? fmtUsd(p.vaultsTotalUsd) : DASH;

  return {
    metrics,
    history,
    next,
    holdings: { rows: holdingRows, total: holdingsTotal, note: S.holdings.note },
    vaults: { rows: vaultRows, total: vaultsTotal },
    line: {
      tokens: line,
      text:
        !viewing || !p
          ? S.line.text
          : excluded
            ? `Excluded by policy, so no cycle pays it. The monitor's note: ${excluded}.`
            : p.eligible
              ? `This wallet clears the line, so every cycle includes it${p.shareOfEligible ? `, at ${fmtPct(p.shareOfEligible, 4)} of each payout` : ""}.`
              : `This wallet is ${fmtTokens(p.shortfallTokens)} $OURO short of the line. Hold that and every cycle pays it, or pool with others in the vaults and clear it together.`,
    },
  };
}
