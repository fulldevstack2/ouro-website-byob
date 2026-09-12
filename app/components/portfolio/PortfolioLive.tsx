import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "react-router";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { useAccount } from "wagmi";

import { Callout } from "~/components/ds";
import { ConnectBar } from "~/components/site";
import {
  BAR_TITLE,
  OURO,
  PortfolioBody,
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
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { BASKET_TOKENS, shortAddress } from "~/content/protocol";
import { canonicalPath } from "~/lib/meta";
import { site } from "~/content/site";
import { LIVE_VAULTS } from "~/content/vaults";
import { useAirdropPayments, usePortfolioSummary, type PaymentsFeed } from "~/hooks/usePortfolio";
import { ago, fmtDay, fmtNum, fmtPct, fmtTokens, fmtUsd, fmtWhen, type Poll, type PortfolioSummary } from "~/lib/monitorApi";
import type { ShareCardData, ShareCardRow } from "~/lib/shareCard";
import { fmtAmount } from "~/lib/vaultChain";

/* ────────────────────────────────────────────────────────────────────────────
   The live portfolio. Loaded on the client only (routes/portfolio.tsx imports it lazily once
   mounted), so this module and everything it pulls in, wagmi, RainbowKit and viem, never reach the
   server bundle or the prerender.

   WHOSE. The connected wallet's. An address in `?address=` takes over when there is one, so a link
   to another wallet's page shows that wallet to everyone who opens it; the page does not offer that
   anywhere (see the note at the top of PortfolioFrame), and an address that is not one is simply
   ignored. The query string is only read here, after hydration: the route is prerendered and there
   is no query string at build time.

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
      {viewing && summary.error && (
        <Callout tone="caution" title="ouro-monitor is not answering" style={{ marginBottom: 24 }}>
          {p ? "Showing its last good read. " : "Every figure stays a dash until it does; nothing here is cached or estimated. "}It said: {summary.error}
        </Callout>
      )}
      {viewing && p?.liveError && (
        <Callout tone="caution" title={`${site.chain.name} did not answer the monitor`} style={{ marginBottom: 24 }}>
          What the wallet holds and its vault deposits stay a dash until it does. The monitor said: {p.liveError}
        </Callout>
      )}
      {viewing && p && p.blocksBehind !== null && p.blocksBehind > STALE_BLOCKS && (
        <Callout tone="caution" title="The monitor's holder snapshot is behind the chain" style={{ marginBottom: 24 }}>
          By {fmtNum(p.blocksBehind)} blocks, about {ago(p.blocksBehind / 10)}. The balance, the standing and the share come from that snapshot; what the wallet
          holds is read live.
        </Callout>
      )}
      <ConnectBar
        title={BAR_TITLE}
        note={viewing && !mine ? <ViewingNote address={viewing} /> : undefined}
        right={
          <>
            {share && <ShareCardTrigger card={share.card} holdingRow={share.holdingRow} fileStem={share.fileStem} />}
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </>
        }
      />
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
 * The card behind the Share button, for whichever wallet is on screen.
 *
 * It is offered whenever there is a wallet to describe, paid or not (owner's call, 2026-09-11): a
 * holder who has just crossed the line has something worth posting too, and the card says plainly
 * that nothing has been paid yet. The only figure it will not print is one it does not have, so an
 * unvalued total falls back to the count of payments rather than to a dash where the hero goes.
 *
 * THE CODE OPENS THIS WALLET'S PORTFOLIO. Same decision: the card exists to be scanned into
 * /portfolio/?address=…, which is how one holder shows another what the airdrop has actually paid.
 * So the address is on the card in plain type as well as inside the code, because a card carrying an
 * address it does not name is the worse of the two.
 *
 * STILL LEFT OFF. The wallet balance, which is offered behind a toggle in the dialog rather than
 * assumed. Vault deposits print when present. Lifetime vault rewards ("From the vaults") print when
 * the monitor has priced claimed + claimable; otherwise claimable-only shows as "Vaults to collect".
 * And "at the current rate", a projection the monitor currently puts at about twice what this
 * wallet's own payments come to, which has no business on an image that carries none of the page's
 * caveats.
 */
function shareCard(p: PortfolioSummary): { card: ShareCardData; holdingRow: ShareCardRow | null; fileStem: string } {
  const excluded = p.eligible && p.excluded !== null;
  const paidCount = p.airdropPayments;
  const priced = p.totalAirdropUsd !== null;
  const address = getAddress(p.address);

  const vaultPositions = Array.isArray(p.vaults) ? p.vaults : [];
  const vaultOuro = vaultPositions.reduce(
    (sum, v) => sum + (v.depositSymbol === OURO.symbol && v.assetsF > 0 ? v.assetsF : 0),
    0,
  );
  const claimable = vaultPositions.filter((v) => v.earnedF !== null && v.earnedF > 0);
  const claimableRow = vaultClaimableRow(claimable);
  const vaultEarnedRow = vaultEarnedShareRow(p);

  // At most three, so the optional wallet-balance row never makes a fourth into a fifth: the
  // figures block is anchored to its foot and a fifth row would run up into the badge. Vault rows
  // sit first when present so a emptied-into-vaults wallet does not look empty on the card; rewards
  // beat shortfall when both fight for the third slot (that is the social confusion: "below the line"
  // with big airdrops — show what the vaults paid).
  const rows: ShareCardRow[] = [];
  if (vaultOuro > 0) rows.push({ label: "In the vaults", value: `${fmtTokens(vaultOuro)} OURO` });
  if (vaultEarnedRow) rows.push(vaultEarnedRow);
  else if (claimableRow) rows.push(claimableRow);
  if (vaultOuro > 0 && p.shortfallTokens > 0) {
    rows.push({ label: "Short of the line", value: `${fmtTokens(p.shortfallTokens)} OURO` });
  }
  if (p.shareOfEligible !== null) rows.push({ label: "Share of every cycle", value: fmtPct(p.shareOfEligible, 4) });
  if (priced) rows.push({ label: "Payments", value: fmtNum(paidCount) });
  if (p.lastAirdropTs) rows.push({ label: "Latest", value: fmtDay(p.lastAirdropTs) });
  if (paidCount === 0) rows.push({ label: "The line", value: `${fmtNum(p.lineTokens)} OURO` });
  if (p.shortfallTokens > 0 && vaultOuro === 0) {
    rows.push({ label: "Short of the line", value: `${fmtTokens(p.shortfallTokens)} OURO` });
  }

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
      badge: excluded
        ? { text: "Excluded by policy", tone: "negative" }
        : p.eligible
          ? { text: "Above the line · paid every cycle", tone: "positive" }
          : { text: "Below the line", tone: "caution" },
      rows: rows.slice(0, 3),
      footnote,
      cta: {
        caps: "Scan for this wallet",
        line: "Every payout, read from the chain.",
        site: site.url.replace(/^https?:\/\//, ""),
        address: shortAddress(address),
        // Built here rather than taken from the API's `portfolioUrl`, which omits the trailing slash
        // this site serves its directories at. site.url is pinned to the public origin at build time
        // (netlify.toml), so a card saved from a preview deploy still points somewhere real.
        href: `${site.url}${canonicalPath("/portfolio")}?address=${address}`,
      },
    },
    // "In wallet" when vaults are on the card, so the optional row and "In the vaults" read as a pair.
    holdingRow: {
      label: vaultOuro > 0 ? "In wallet" : "Holding",
      value: `${fmtTokens(p.balanceTokens)} OURO`,
    },
    fileStem: `ouro-portfolio-${address.slice(0, 8).toLowerCase()}`,
  };
}

/** Claimable payout-vault rewards, as one row. Used when lifetime vault earned is not yet known. */
function vaultClaimableRow(
  claimable: NonNullable<PortfolioSummary["vaults"]>,
): ShareCardRow | null {
  if (claimable.length === 0) return null;
  const allPriced = claimable.every((v) => v.earnedUsd !== null);
  if (allPriced) {
    const usd = claimable.reduce((sum, v) => sum + (v.earnedUsd ?? 0), 0);
    return { label: "Vaults to collect", value: fmtUsd(usd) };
  }
  const parts = claimable.flatMap((v) =>
    v.earnedF !== null && v.earnedF > 0 ? [`${fmtTokens(v.earnedF)} ${v.payoutSymbol}`] : [],
  );
  if (parts.length === 0) return null;
  return { label: "Vaults to collect", value: parts.join(" + ") };
}

/** Lifetime vault rewards (claimed + claimable), when the monitor has priced them. */
function vaultEarnedShareRow(p: PortfolioSummary): ShareCardRow | null {
  if (p.totalVaultEarnedUsd === null || p.totalVaultEarnedUsd <= 0) return null;
  return { label: "From the vaults", value: fmtUsd(p.totalVaultEarnedUsd) };
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
          // Short on purpose: the metric cards sit two-up from 641–960px, and the longer
          // "Above the line · paid every cycle" overflowed the card (Badge is nowrap). The note
          // under the figure still says every cycle pays.
          ? { tone: "positive", label: "Above the line" }
          : { tone: "caution", label: "Below the line" };

  // Vault OURO is live on the same payload; surface it on Balance so a emptied-into-vaults wallet
  // does not look like the monitor missed the tokens. Eligibility still uses wallet balance only.
  const vaultPositions = p && Array.isArray(p.vaults) ? p.vaults : null;
  const vaultOuro =
    vaultPositions?.reduce((sum, v) => sum + (v.depositSymbol === OURO.symbol && v.assetsF > 0 ? v.assetsF : 0), 0) ?? 0;

  const balanceFootnote = !viewing
    ? S.metrics.balance.footnote
    : !p
      ? pendingWord
      : (() => {
          const priced =
            p.balanceUsd === null || p.priceUsd === null
              ? "Awaiting a price from the monitor"
              : `${fmtUsd(p.balanceUsd)} at ${fmtUsd(p.priceUsd, { exact: true })} each`;
          return vaultOuro > 0 ? `${priced} · ${fmtTokens(vaultOuro)} OURO in the vaults` : priced;
        })();

  const balanceNote = !viewing
    ? S.metrics.balance.note
    : vaultOuro > 0 && p
      ? `${i.mine ? "Your connected wallet" : "The wallet named in the link"} holds ${fmtTokens(p.balanceTokens)} OURO here. Another ${fmtTokens(vaultOuro)} OURO sits in the vaults below — that earns through the vault, and does not count toward the line.`
      : `${i.mine ? "Your connected wallet" : "The wallet named in the link"}, read through ouro-monitor and refreshed every thirty seconds. What it has in the vaults is counted separately below.`;

  const metrics: PortfolioView["metrics"] = {
    balance: {
      value: p ? fmtTokens(p.balanceTokens) : DASH,
      unit: OURO.symbol,
      footnote: balanceFootnote,
      note: balanceNote,
    },
    share: {
      value: !p ? DASH : p.shareOfEligible !== null ? fmtPct(p.shareOfEligible, 4) : paid ? DASH : "0%",
      // Complete on its own (not a lead-in to the badge). Reads under the % as
      // "3.5% of N $OURO above the line".
      footnote: p?.eligibleSupplyTokens != null ? `of ${fmtNum(p.eligibleSupplyTokens)} $OURO above the line` : S.metrics.share.footnote,
      badge: standing,
      note: !p
        ? S.metrics.share.note
        : excluded
          ? `Never paid, however large. The monitor's note on this address: ${excluded}.`
          : p.eligible
            ? "Each cycle is split pro-rata across the eligible supply. Every wallet above the line gets the same rate."
            : `${fmtTokens(p.shortfallTokens)} more $OURO clears the line. Below it a wallet gets nothing from any cycle.`,
    },
    received: {
      value: p ? fmtUsd(p.totalAirdropUsd) : DASH,
      footnote: !viewing
        ? S.metrics.received.footnote
        : !p
          ? pendingWord
          : p.airdropPayments === 0
            ? "No payments yet"
            : p.totalAirdropUsd === null
              ? `${fmtNum(p.airdropPayments)} ${plural(p.airdropPayments, "payment", "payments")}, at least one not priced yet`
              : `${fmtNum(p.airdropPayments)} ${plural(p.airdropPayments, "payment", "payments")}, the latest ${fmtWhen(p.lastAirdropTs)}`,
      note: "Basket tokens the airdrop has sent this wallet, valued at what each cycle paid them out at, not today's price. Sold or moved since, they still count here.",
    },
    rate: {
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
    },
  };

  // The history. `total` counts payments not fetched yet, from the summary, until the feed has reached
  // the oldest one; from then on the rows themselves are the count.
  const rows = feed.payments ?? [];
  const read = viewing !== null && feed.payments !== null;
  const total = feed.complete ? rows.length : Math.max(rows.length, p?.airdropPayments ?? 0);
  const history: PortfolioView["history"] = {
    rows: rows.map((r) => ({
      key: r.tx,
      when: fmtWhen(r.ts),
      cycle: `#${r.cycle}`,
      tokens: r.assets.map((a) => `${fmtTokens(a.amountF)} ${a.symbol ?? shortAddress(a.address)}`).join(" + ") || DASH,
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

  // The next payment, from the monitor's per-wallet estimate. Its status decides the whole card.
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
        ? [{ label: "Per cycle, about", value: fmtUsd(n.estimatedPerCycleUsd) }]
        : [
            { label: "Next cycle", value: fmtWhen(n.nextCycleTs) },
            { label: "Per cycle, about", value: fmtUsd(n.estimatedPerCycleUsd) },
            { label: "Owed so far", value: `${fmtUsd(n.pendingUsd)} of ${fmtUsd(n.dustThresholdUsd)}` },
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

  // What it holds, as the monitor read it from the chain for this request: $OURO first, then every
  // token the airdrop pays in. The total is withheld if any held token has no price, the rule the
  // Ledger applies to its own totals.
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

  // The vaults: every live vault, filled in from the positions the monitor lists (it lists only the
  // vaults the wallet has something in).
  const vaultRows: VaultRowView[] = LIVE_VAULTS.map((v) => {
    const pos = vaultPositions?.find((x) => x.address.toLowerCase() === v.entry.address.toLowerCase());
    return {
      key: v.entry.address,
      title: `Deposit ${v.token.symbol} · Earn ${v.payoutSymbol}`,
      deposit: !viewing || !vaultPositions ? DASH : !pos || pos.assetsF === 0 ? "Nothing deposited" : amountUsd(pos.assetsF, pos.depositSymbol, pos.assetsUsd),
      collect:
        pos && pos.earnedF !== null && pos.earnedF > 0
          ? `${fmtEarned(pos.earned, v.payoutDecimals)} ${pos.payoutSymbol}${pos.earnedUsd !== null ? ` (${fmtUsd(pos.earnedUsd)})` : ""} to collect`
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
