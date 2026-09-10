import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { getAddress, isAddress, type Address } from "viem";
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
  type PortfolioView,
  type VaultRowView,
} from "~/components/portfolio/PortfolioFrame";
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { AIRDROP_WALLET, BASKET_TOKENS } from "~/content/protocol";
import { site } from "~/content/site";
import { TOKEN_DECIMALS } from "~/content/vaults";
import { buildHistory, tokenMetaFrom, useAirdropReceipts, useBlockTimes, type ReceiptsPoll } from "~/hooks/useAirdropHistory";
import { useBasketPrices } from "~/hooks/useBasketPrices";
import { usePortfolioChain, type WalletChain } from "~/hooks/usePortfolioChain";
import { usePrices, type Prices } from "~/hooks/usePrices";
import { MONITOR_API, fmtNum, fmtPct, fmtTokens, fmtUsd, fmtWhen, useMonitor, type OuroCycle, type OuroHolders } from "~/lib/monitorApi";
import { fmtAmount } from "~/lib/vaultChain";
import { toNumber, usdValue } from "~/lib/vaultYield";

/* ────────────────────────────────────────────────────────────────────────────
   The live portfolio. Loaded on the client only (routes/portfolio.tsx imports it lazily once
   mounted), so this module and everything it pulls in, wagmi, RainbowKit and viem, never reach the
   server bundle or the prerender.

   WHOSE. The connected wallet's. An address in `?address=` takes over when there is one, so a link
   to another wallet's page shows that wallet to everyone who opens it; the page does not offer that
   anywhere (see the note at the top of PortfolioFrame), and an address that is not one is simply
   ignored. The query string is only read here, after hydration: the route is prerendered and there
   is no query string at build time.

   Reading needs no wallet. Balances and vault positions come through wagmi's public transport, the
   history through the chain's own logs (useAirdropHistory), the prices and the cycle data through
   ouro-monitor. Nothing about the reader, or the wallet on screen, is written anywhere.
   ──────────────────────────────────────────────────────────────────────────── */

const OURO_DECIMALS = TOKEN_DECIMALS.ouro;
const DASH = "—";
const NO_CYCLES: OuroCycle[] = [];

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

  // What the page reads.
  const prices = usePrices();
  const basket = useBasketPrices();
  const holders = useMonitor<OuroHolders>(MONITOR_API ? "/v1/ouro/holders?min=100000" : null, 120_000);
  const cyclesPoll = useMonitor<{ token: string; epochs: OuroCycle[] }>(MONITOR_API ? "/v1/ouro/epochs?limit=500" : null, 60_000);
  const chain = usePortfolioChain(viewing);
  const cycles = cyclesPoll.data?.epochs ?? NO_CYCLES;
  const tokenMeta = useMemo(() => tokenMetaFrom(cycles), [cycles]);
  const tokenAddresses = useMemo(() => [...tokenMeta.keys()] as Address[], [tokenMeta]);
  const receipts = useAirdropReceipts(viewing, basket.treasury ?? AIRDROP_WALLET, tokenAddresses);

  // Two passes: the first finds the payments the monitor has not indexed, whose time has to come from
  // their block; the second prints them once those blocks have been read.
  const firstPass = useMemo(() => buildHistory(receipts.receipts ?? [], cycles, tokenMeta, {}), [receipts.receipts, cycles, tokenMeta]);
  const missingBlocks = useMemo(() => firstPass.rows.filter((r) => r.ts === null).map((r) => r.block), [firstPass]);
  const blockTimes = useBlockTimes(missingBlocks);
  const history = useMemo(
    () => (Object.keys(blockTimes).length > 0 ? buildHistory(receipts.receipts ?? [], cycles, tokenMeta, blockTimes) : firstPass),
    [receipts.receipts, cycles, tokenMeta, blockTimes, firstPass],
  );

  const view = buildView({ viewing, mine, prices, basketPrices: basket.prices, holders: holders.data, chain, receipts, history });

  return (
    <>
      {viewing && chain.error && (
        <Callout tone="caution" title={`${site.chain.name} is not answering`} style={{ marginBottom: 24 }}>
          The balances and the vault figures stay a dash until it does. Nothing here is cached or estimated.
        </Callout>
      )}
      {viewing && receipts.error && (
        <Callout tone="caution" title="The history could not be read" style={{ marginBottom: 24 }}>
          {receipts.receipts ? "Showing the last good read. " : ""}The chain&apos;s log endpoint answered: {receipts.error}
        </Callout>
      )}
      <ConnectBar
        title={BAR_TITLE}
        note={viewing && !mine ? <ViewingNote address={viewing} /> : undefined}
        right={<ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />}
      />
      <PortfolioBody view={view} historyKey={viewing ?? "none"} />
    </>
  );
}

/* ── from data to what the page prints ────────────────────────────────────── */

interface Inputs {
  viewing: Address | null;
  mine: boolean;
  prices: Prices;
  basketPrices: Record<string, number>;
  holders: OuroHolders | null;
  chain: WalletChain;
  receipts: ReceiptsPoll;
  history: ReturnType<typeof buildHistory>;
}

/** "1,234 OURO (\$5.20)", or the amount alone while the price is unknown. */
function withUsd(value: bigint | undefined, decimals: number, symbol: string, priceUsd: number | null, maxFrac = 4): string {
  const amount = `${fmtAmount(value, decimals, maxFrac)} ${symbol}`;
  const usd = usdValue(value, decimals, priceUsd);
  return usd === null || value === undefined ? amount : `${amount} (${fmtUsd(usd)})`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function buildView(i: Inputs): PortfolioView {
  const { viewing, chain, prices, receipts, history } = i;
  const y = prices.ouroYield;
  const bal = chain.ouro;
  const balF = toNumber(bal, OURO_DECIMALS);
  const balUsd = usdValue(bal, OURO_DECIMALS, prices.ouroUsd);
  const lineTokens = y?.lineTokens ?? (i.holders ? Number(i.holders.eligibilityLine) / 10 ** i.holders.decimals : OURO.thresholdTokens);
  const line = fmtNum(lineTokens);
  const excluded = viewing ? (i.holders?.exclusionPolicy.find((e) => e.address.toLowerCase() === viewing.toLowerCase()) ?? null) : null;
  const above = balF !== null && balF >= lineTokens && excluded === null;
  // Its share of every cycle: zero below the line or excluded, unknown while the supply is.
  const share = balF === null ? null : !above ? 0 : y?.eligibleTokens ? balF / y.eligibleTokens : null;
  const perDay = share !== null && share > 0 && y?.paidUsdPerDay != null ? share * y.paidUsdPerDay : null;

  const standing: MetricView["badge"] = !viewing
    ? undefined
    : bal === undefined
      ? { tone: "neutral", label: chain.error ? "Chain unreachable" : "Reading the chain" }
      : excluded
        ? { tone: "negative", label: "Excluded by policy" }
        : above
          ? { tone: "positive", label: "Above the line · paid every cycle" }
          : { tone: "caution", label: "Below the line" };

  const S = STATIC_VIEW;
  const s = history.summary;
  const read = viewing !== null && receipts.receipts !== null;

  const metrics: PortfolioView["metrics"] = {
    balance: {
      value: viewing ? fmtAmount(bal, OURO_DECIMALS, 0) : DASH,
      unit: OURO.symbol,
      footnote: !viewing
        ? S.metrics.balance.footnote
        : bal === undefined
          ? chain.error
            ? `${site.chain.name} did not answer`
            : "Reading the chain"
          : balUsd === null
            ? "Awaiting a price from the monitor"
            : `${fmtUsd(balUsd)} at ${fmtUsd(prices.ouroUsd, { exact: true })} each`,
      note: !viewing
        ? S.metrics.balance.note
        : `${i.mine ? "Your connected wallet" : "The wallet named in the link"}, read from the OURO token contract every fifteen seconds. What it has in the vaults is counted separately below.`,
    },
    share: {
      value: share === null ? DASH : share === 0 ? "0%" : fmtPct(share, 4),
      footnote: y?.eligibleTokens != null ? `of the ${fmtNum(y.eligibleTokens)} $OURO a cycle is divided among` : S.metrics.share.footnote,
      badge: standing,
      note: excluded
        ? `Never paid, however large. The monitor's note on this address: ${excluded.reason}.`
        : above
          ? "Each cycle is split pro-rata across the eligible supply. The top three holders take 30% less, so this is a floor for most wallets."
          : viewing && balF !== null
            ? `${fmtTokens(lineTokens - balF)} more $OURO clears the line. Below it a wallet gets nothing from any cycle.`
            : S.metrics.share.note,
    },
    received: {
      value: read ? fmtUsd(s.usd) : DASH,
      footnote: !viewing
        ? S.metrics.received.footnote
        : !read
          ? receipts.error
            ? "The chain's logs did not answer"
            : "Reading the chain's logs"
          : s.payments === 0
            ? "No payments yet"
            : `${fmtNum(s.payments)} ${plural(s.payments, "payment", "payments")} across ${fmtNum(s.cycles)} ${plural(s.cycles, "cycle", "cycles")}${s.unpriced ? `, ${fmtNum(s.unpriced)} unpriced` : ""}`,
      note: "Basket tokens the airdrop has sent this wallet, valued at what each cycle paid them out at, not today's price. Sold or moved since, they still count here.",
    },
    rate: {
      value: perDay === null ? DASH : fmtUsd(perDay),
      unit: perDay === null ? undefined : "/ day",
      footnote:
        perDay !== null
          ? `${fmtUsd(perDay * 30)} a month, at the last ${y?.basisDays ? fmtNum(y.basisDays, 0) : "seven"} days' rate`
          : !viewing
            ? S.metrics.rate.footnote
            : bal === undefined
              ? "Reading the chain"
              : above
                ? "Needs the monitor's rate"
                : "Nothing is paid below the line",
      note: S.metrics.rate.note,
    },
  };

  const historyView: PortfolioView["history"] = {
    rows: history.rows.map((r) => ({
      key: r.tx,
      when: fmtWhen(r.ts),
      cycle: r.cycle === null ? DASH : `#${r.cycle}`,
      tokens: r.legs.map((l) => `${fmtTokens(l.amountF)} ${l.symbol}`).join(" + ") || DASH,
      value: fmtUsd(r.usd),
      tx: r.tx,
    })),
    empty: !viewing
      ? S.history.empty
      : !read
        ? receipts.error
          ? `The chain's logs could not be read: ${receipts.error}`
          : "Reading the chain's logs…"
        : excluded
          ? "Nothing, by policy: this address is infrastructure, not a holder."
          : above
            ? "No airdrops yet. This wallet clears the line, so the next cycle includes it."
            : `No airdrops yet. Hold ${line} $OURO at the next cycle to be included, or pool with others in the vaults.`,
    status: !viewing
      ? ""
      : !read
        ? receipts.error
          ? "unavailable"
          : "reading…"
        : `${fmtNum(s.payments)} ${plural(s.payments, "payment", "payments")}${receipts.error ? " · refresh failed" : ""}`,
  };

  // What it holds: $OURO first, then every token the airdrop pays in. The total is withheld if any
  // held token has no price, the same rule the Ledger applies to its own totals.
  const holdingRows: HoldingRowView[] = [];
  let total = 0;
  let complete = viewing !== null && bal !== undefined;
  if (balUsd !== null) total += balUsd;
  else if (bal !== undefined && bal > 0n) complete = false;
  holdingRows.push({ key: OURO.address, symbol: OURO.symbol, name: OURO.name, icon: OURO.icon, amount: viewing ? fmtAmount(bal, OURO_DECIMALS, 0) : DASH, value: fmtUsd(balUsd) });
  for (const t of BASKET_TOKENS) {
    const b = chain.basket[t.address.toLowerCase()];
    const px = i.basketPrices[t.address.toLowerCase()] ?? (t.symbol === "WETH" ? prices.ethUsd : null);
    const usd = usdValue(b, t.decimals, px);
    if (usd !== null) total += usd;
    else if (b === undefined || b > 0n) complete = false;
    holdingRows.push({
      key: t.address,
      symbol: t.symbol,
      name: t.name,
      icon: t.icon,
      amount: viewing ? fmtAmount(b, t.decimals, 4) : DASH,
      value: b === undefined ? DASH : usd !== null ? fmtUsd(usd) : b === 0n ? fmtUsd(0) : "no price yet",
    });
  }

  const vaultRows: VaultRowView[] = chain.vaults.map((p) => {
    const v = p.vault;
    const payoutUsd = v.kind === "compounding" ? prices.ouroUsd : v.payoutSymbol === "USDG" ? 1 : prices.ethUsd;
    return {
      key: v.entry.address,
      title: `Deposit ${v.token.symbol} · Earn ${v.payoutSymbol}`,
      deposit: !viewing || p.deposited === undefined ? DASH : p.deposited === 0n ? "Nothing deposited" : withUsd(p.deposited, OURO_DECIMALS, v.token.symbol, prices.ouroUsd, 0),
      collect: viewing && p.earned !== undefined && p.earned > 0n ? `${withUsd(p.earned, v.payoutDecimals, v.payoutSymbol, payoutUsd)} to collect` : undefined,
    };
  });

  return {
    metrics,
    history: historyView,
    holdings: { rows: holdingRows, total: viewing && complete ? fmtUsd(total) : DASH, note: S.holdings.note },
    vaults: { rows: vaultRows },
    line: {
      tokens: line,
      text:
        !viewing || balF === null
          ? S.line.text
          : excluded
            ? `Excluded by policy, so no cycle pays it. The monitor's note: ${excluded.reason}.`
            : above
              ? `This wallet clears the line, so every cycle includes it${share ? `, at ${fmtPct(share, 4)} of each payout` : ""}.`
              : `This wallet is ${fmtTokens(lineTokens - balF)} $OURO short of the line. Hold that and every cycle pays it, or pool with others in the vaults and clear it together.`,
    },
  };
}
