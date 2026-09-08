import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSignTypedData, useSwitchChain } from "wagmi";

import type { Route } from "./+types/referral";
import { Button, Callout, Card, LedgerTable, Stat, type LedgerColumn } from "~/components/ds";
import { Container, Grid, KVRow, MicroLabel, PageHeader, SectionHead, body14, hairline, mono } from "~/components/site";
import {
  OPS_FLOOR_PCT,
  OPS_PCT,
  REFERRAL_RATE_OF_TAX_PCT,
  REFERRAL_RATE_PCT,
  TAX_PCT,
  bindPayload,
  codeForAddress,
  referralLink,
} from "~/content/referral";
import { externalLinkProps, site } from "~/content/site";
import { WalletProvider } from "~/components/wallet/WalletProvider";
import { pageMeta } from "~/lib/meta";
import { hasWalletConnect, robinhoodChain } from "~/lib/wagmi";
import { MONITOR_API, fmtEth, fmtNum, useMonitor } from "~/lib/monitorApi";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: "Referral · earn on every trade you bring, and on your own",
    description: `Share your link and both sides earn ${REFERRAL_RATE_PCT}% of the ETH on every $OURO trade the wallet you referred makes, buying or selling. Funded from the ops leg, so the airdrop is untouched.`,
    path: location.pathname,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   The shape ouro-monitor will serve. Kept here rather than in monitorApi.ts
   until the endpoints exist, so nothing suggests the client already reads them.
   ──────────────────────────────────────────────────────────────────────────── */

interface RefereeRow {
  address: string;
  boundAtBlock: number;
  buys: number | null;
  volumeEth: number | null;
  earnedEth: number | null;
}
interface ReferralAccount {
  address: string;
  code: string;
  link: string | null;
  boundTo: string | null;
  boundAtBlock: number | null;
  asReferrer: { referees: number; attributedBuys: number; attributedVolumeEth: number; earnedEth: number; earnedUsd: number | null };
  asReferee: { attributedBuys: number; attributedVolumeEth: number; earnedEth: number; earnedUsd: number | null };
  claimable: { epoch: number | null; amountEth: number; proof: string[] } | null;
  claimed: { cumulativeEth: number };
  referees: RefereeRow[];
  /**
   * False until the accrual engine is counting buys. A page that ignores this and renders zeroes is
   * telling a wallet it earned nothing, when the truth is that nothing has been counted yet.
   */
  accrualLive: boolean;
}

type Phase = "idle" | "signing" | "posting" | "done" | "error";

const REFEREE_COLUMNS: LedgerColumn[] = [
  { key: "address", label: "Wallet" },
  { key: "buys", label: "Buys", align: "right", numeric: true },
  { key: "volume", label: "Volume", align: "right", numeric: true },
  { key: "earned", label: "You earned", align: "right", numeric: true },
];

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* ── the deal, stated once and reused ─────────────────────────────────────── */

function TheDeal() {
  return (
    <Grid cols="repeat(3, 1fr)" gap={20} className="grid--2col-md">
      <Card label="They earn">
        <div style={{ ...mono, fontSize: 28, fontWeight: 600, color: "var(--text-primary)" }}>{REFERRAL_RATE_PCT}%</div>
        <p style={{ ...body14, margin: "8px 0 0" }}>
          of the ETH on every $OURO trade the wallet you referred makes, buying or selling, for as long as they keep trading.
        </p>
      </Card>
      <Card label="You earn">
        <div style={{ ...mono, fontSize: 28, fontWeight: 600, color: "var(--text-primary)" }}>{REFERRAL_RATE_PCT}%</div>
        <p style={{ ...body14, margin: "8px 0 0" }}>
          on your own trades, the moment you bind. Being referred is not a favour you do for someone else.
        </p>
      </Card>
      <Card label="Holders pay nothing">
        <div style={{ ...mono, fontSize: 28, fontWeight: 600, color: "var(--text-primary)" }}>{OPS_PCT}% → {OPS_FLOOR_PCT}%</div>
        <p style={{ ...body14, margin: "8px 0 0" }}>
          Both legs come out of ops. The {TAX_PCT}% tax, the airdrop and the Reserve are all unchanged.
        </p>
      </Card>
    </Grid>
  );
}

/* ── connect / wrong chain / no wallet ────────────────────────────────────── */

function ConnectPanel() {
  return (
    <Card>
      <Grid cols="1fr auto" gap={24} align="center" className="grid--2col-md">
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Connect to see your link and what it has earned</div>
          <p style={{ ...body14, margin: "8px 0 0" }}>
            A signature, never a transaction. Ouro cannot move anything in your wallet and does not ask to.
          </p>
          {!hasWalletConnect && (
            <p style={{ ...body14, margin: "8px 0 0", color: "var(--text-caution)" }}>
              Mobile wallets are unavailable on this build because no WalletConnect project is configured. Browser
              extension wallets work as normal.
            </p>
          )}
        </div>
        <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
      </Grid>
    </Card>
  );
}

function WrongChain({ chainId }: { chainId: number | undefined }) {
  const { switchChain, isPending, error } = useSwitchChain();
  return (
    <Callout tone="caution" title={`Switch to ${site.chain.name}`}>
      <Grid cols="1fr auto" gap={20} align="center" className="grid--2col-md">
        <div>
          <p style={{ ...body14, margin: 0 }}>
            Your wallet is on chain {chainId ?? "unknown"}. $OURO trades on {site.chain.name}, chain {site.chain.id}.
          </p>
          {error && <p style={{ ...body14, margin: "8px 0 0", color: "var(--text-negative)" }}>{error.message}</p>}
        </div>
        <Button variant="secondary" onClick={() => switchChain({ chainId: robinhoodChain.id })} disabled={isPending}>
          {isPending ? "Check your wallet…" : "Switch network"}
        </Button>
      </Grid>
    </Callout>
  );
}

/* ── the referrer's own link ──────────────────────────────────────────────── */

function YourLink({ address, apiLink }: { address: string; apiLink: string | null }) {
  // Prefer the link the service built: it proves the service resolved this code to this wallet.
  const link = apiLink ?? referralLink(address);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [link]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Card label="Your link">
      <div
        style={{
          ...mono,
          fontSize: 13,
          padding: "12px 14px",
          background: "var(--surface-tint)",
          border: hairline,
          borderRadius: 3,
          wordBreak: "break-all",
          color: "var(--text-primary)",
        }}
      >
        {link}
      </div>
      <Grid cols="auto 1fr" gap={16} align="center" style={{ marginTop: 16 }}>
        <Button variant="secondary" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</Button>
        <p style={{ ...body14, margin: 0 }}>
          The code is derived from your address, so nobody learns which wallet is yours from the link alone.
        </p>
      </Grid>
    </Card>
  );
}

/* ── binding, when the visitor arrived through someone's link ─────────────── */

function BindPanel({
  address,
  code,
  account,
  open,
}: {
  address: `0x${string}`;
  code: string;
  account: ReferralAccount | null;
  /** The binding store answered, so binding is actually possible. */
  open: boolean;
}) {
  const { signTypedDataAsync } = useSignTypedData();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const selfReferral = codeForAddress(address) === code;

  const bind = useCallback(async () => {
    setPhase("signing");
    setMessage(null);
    try {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const signature = await signTypedDataAsync(bindPayload(address, code, 0, deadline));
      setPhase("posting");
      const r = await fetch(`${MONITOR_API}/v1/referrals/bind`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referee: address, referrerCode: code, nonce: 0, deadline, signature }),
      });
      if (!r.ok) throw new Error(`The server refused the binding (HTTP ${r.status}).`);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      // wagmi surfaces a long multi-line error; the first line is the part a person can act on.
      setMessage((e as Error).message.split("\n")[0]);
    }
  }, [address, code, signTypedDataAsync]);

  if (account?.boundTo) {
    return (
      <Callout tone="note" title="You are already bound">
        <p style={{ ...body14, margin: 0 }}>
          This wallet is bound to <span style={mono}>{short(account.boundTo)}</span>. A binding is permanent and one
          time, so a second link cannot overwrite it and nobody can take your referees from you.
        </p>
      </Callout>
    );
  }

  if (selfReferral) {
    return (
      <Callout tone="caution" title="That is your own link">
        <p style={{ ...body14, margin: 0 }}>A wallet cannot refer itself. Share the link with someone else instead.</p>
      </Callout>
    );
  }

  if (phase === "done") {
    return (
      <Callout tone="note" title="Bound">
        <p style={{ ...body14, margin: 0 }}>
          Every $OURO trade this wallet makes from here on, buying or selling, earns {REFERRAL_RATE_PCT}% back for you and
          {REFERRAL_RATE_PCT}% for whoever sent you. Trades made before now do not count.
        </p>
      </Callout>
    );
  }

  return (
    <Card label="You arrived through a referral link" tone="tint">
      <p style={{ ...body14, margin: 0 }}>
        Sign once to bind this wallet. It costs nothing, it is a signature and not a transaction, and from that moment
        both you and the person who sent you earn {REFERRAL_RATE_PCT}% of the ETH on every trade you make, in either direction.
      </p>
      <p style={{ ...body14, margin: "12px 0 0" }}>
        Binding starts from the block you sign in. It is never applied backwards, so bind before you trade.
      </p>
      <div style={{ marginTop: 20 }}>
        {open ? (
          <Button onClick={() => void bind()} disabled={phase === "signing" || phase === "posting"}>
            {phase === "signing" ? "Check your wallet…" : phase === "posting" ? "Recording…" : "Sign and bind"}
          </Button>
        ) : (
          <Button disabled>Binding opens at launch</Button>
        )}
      </div>
      {message && <p style={{ ...body14, margin: "14px 0 0", color: "var(--text-negative)" }}>{message}</p>}
    </Card>
  );
}

/* ── the profile ──────────────────────────────────────────────────────────── */

function Earnings({ account }: { account: ReferralAccount | null }) {
  // Only show a figure once the service says it is counting. Otherwise a dash: "not counted yet"
  // and "earned nothing" are different claims and must not render the same.
  const a = account?.accrualLive ? account : null;
  const dash = "—";
  return (
    <Grid
      cols="repeat(4, 1fr)"
      gap={24}
      className="grid--2col-md"
      style={{ margin: "40px 0 48px", padding: "28px 0", borderTop: hairline, borderBottom: hairline }}
    >
      <Stat
        label="Earned referring"
        value={a ? fmtEth(a.asReferrer.earnedEth) : dash}
        unit="ETH"
        footnote={account ? `${fmtNum(account.asReferrer.referees)} bound` : "Nothing yet"}
      />
      <Stat
        label="Earned on your own trades"
        value={a ? fmtEth(a.asReferee.earnedEth) : dash}
        unit="ETH"
        footnote={account?.boundTo ? "Bound" : "Not bound"}
      />
      <Stat label="Claimable now" value={a?.claimable ? fmtEth(a.claimable.amountEth) : dash} unit="ETH" footnote={a?.claimable ? `Epoch ${a.claimable.epoch}` : "After the next epoch closes"} />
      <Stat label="Claimed to date" value={a ? fmtEth(a.claimed.cumulativeEth) : dash} unit="ETH" footnote="Paid out on chain" />
    </Grid>
  );
}

function Referees({ account }: { account: ReferralAccount | null }) {
  const rows = useMemo(
    () =>
      (account?.referees ?? []).map((r) => ({
        address: <span style={mono}>{short(r.address)}</span>,
        buys: <span style={mono}>{fmtNum(r.buys)}</span>,
        volume: <span style={mono}>{fmtEth(r.volumeEth)} ETH</span>,
        earned: <span style={mono}>{fmtEth(r.earnedEth)} ETH</span>,
      })),
    [account],
  );

  if (!rows.length) {
    return (
      <Card>
        <p style={{ ...body14, margin: 0 }}>
          No referees yet. Anyone who opens your link, connects and signs will appear here, along with what each of them
          has earned you.
        </p>
      </Card>
    );
  }
  return <LedgerTable columns={REFEREE_COLUMNS} rows={rows} />;
}

/* ── the wallet half ──────────────────────────────────────────────────────── */

/**
 * What the prerender writes, and what the first client frame shows before the wallet tree mounts.
 * It has to be the real logged-out card rather than a spinner, because this is the frame a crawler
 * and a shared link both get.
 */
function ConnectPlaceholder() {
  return (
    <Card>
      <Grid cols="1fr auto" gap={24} align="center" className="grid--2col-md">
        <div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>Connect to see your link and what it has earned</div>
          <p style={{ ...body14, margin: "8px 0 0" }}>
            A signature, never a transaction. Ouro cannot move anything in your wallet and does not ask to.
          </p>
        </div>
        <Button size="lg" disabled>Connect wallet</Button>
      </Grid>
    </Card>
  );
}

function WalletSection({ code }: { code: string | null }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  // Every address we compare against, and every path we build, is lowercased.
  const me = address ? (address.toLowerCase() as `0x${string}`) : null;

  const account = useMonitor<ReferralAccount>(MONITOR_API && me ? `/v1/referrals/${me}` : null, 30_000);

  const onRightChain = chainId === robinhoodChain.id;
  const claimable = account.data?.claimable;

  /**
   * The code is a one-way hash of the address, so the service cannot invert it: it has to be told
   * the mapping before anyone can follow the link. Registering on connect is the moment that always
   * precedes sharing, and the call is idempotent and needs no signature, because the code is a pure
   * function of the address that anyone could recompute.
   */
  useEffect(() => {
    if (!me || !MONITOR_API) return;
    const ctrl = new AbortController();
    void fetch(`${MONITOR_API}/v1/referrals/code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: me }),
      signal: ctrl.signal,
    }).catch(() => {
      /* the page still works: it falls back to the locally derived link */
    });
    return () => ctrl.abort();
  }, [me]);

  // The service is the only thing that knows whether the programme has opened. A 503 (or no
  // configured store) means it has not; anything else means binding works.
  const storeOpen = account.data !== null;

  return (
    <>
      {!storeOpen && !account.loading && (
        <Callout tone="note" title="Not open yet" style={{ marginTop: 24 }}>
          <p style={{ ...body14, margin: 0 }}>
            Connect and read the page exactly as it will work. Binding opens once the service is holding
            bindings, and figures appear once buys are being counted. Until then every number here shows a dash,
            the same way the rest of this site handles a figure it cannot read from the chain.
          </p>
        </Callout>
      )}
      {storeOpen && account.data && !account.data.accrualLive && (
        <Callout tone="note" title="Binding is open, counting is not" style={{ marginTop: 24 }}>
          <p style={{ ...body14, margin: 0 }}>
            You can bind and share a link now, and a binding is permanent from the block you sign in. Buys are not
            being attributed yet, so every figure below stays a dash rather than a zero.
          </p>
        </Callout>
      )}

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 20 }}>
        {!isConnected && <ConnectPanel />}
        {isConnected && !onRightChain && <WrongChain chainId={chainId} />}
        {isConnected && me && code && <BindPanel address={me} code={code} account={account.data} open={storeOpen} />}
        {isConnected && me && <YourLink address={me} apiLink={account.data?.link ?? null} />}
      </div>

      {isConnected && (
        <>
          <SectionHead
            kicker="Your earnings"
            title="What your link has made"
            sub="Earned updates as your referees trade. Claimable appears once the epoch closes and its root is posted, and one claim collects everything owed, so a missed epoch is never lost."
            style={{ marginTop: 64 }}
          />
          <Earnings account={account.data} />

          {claimable && claimable.amountEth > 0 && (
            <Card tone="tint" style={{ marginBottom: 48 }}>
              <Grid cols="1fr auto" gap={24} align="center" className="grid--2col-md">
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                    {fmtEth(claimable.amountEth)} ETH ready to claim
                  </div>
                  <p style={{ ...body14, margin: "6px 0 0" }}>
                    One transaction, a few cents of gas. It pays out everything owed across every epoch, not just this one.
                  </p>
                </div>
                <Button size="lg">Claim</Button>
              </Grid>
            </Card>
          )}

          <SectionHead kicker="Your referees" title="Who you brought, and what they earned you" style={{ marginTop: 8 }} />
          <div style={{ marginBottom: 64 }}>
            <Referees account={account.data} />
          </div>
        </>
      )}
    </>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function ReferralRoute() {
  const [code, setCode] = useState<string | null>(null);

  // Read ?ref= on the client only: this route is prerendered, so there is no query string at build.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("ref");
    if (q) setCode(q.trim().toLowerCase().slice(0, 16));
  }, []);

  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="Referral"
        title={<>Both sides earn.<br />Not just the one sharing the link.</>}
        lede={`Share your link and you earn ${REFERRAL_RATE_PCT}% of the ETH on every $OURO trade the wallet you referred makes, buying or selling. They earn the same ${REFERRAL_RATE_PCT}% on those trades themselves. Both legs come out of the ops share of the tax, so the airdrop is untouched.`}

      />

      <div style={{ marginTop: 48 }}>
        <TheDeal />
      </div>

      <WalletProvider fallback={<div style={{ marginTop: 32 }}><ConnectPlaceholder /></div>}>
        <WalletSection code={code} />
      </WalletProvider>

      <SectionHead
        kicker="How it works"
        title="Read this before you share it"
        sub="Four things that are easy to get wrong, stated plainly so nobody is surprised by them later."
        style={{ marginTop: 64 }}
      />
      <Grid cols="1fr 1fr" gap={48} align="start" style={{ marginBottom: 64 }}>
        <div>
          <KVRow label="Paid on every trade" value={`${REFERRAL_RATE_PCT}% of the ETH leg`} />
          <KVRow label="As a share of the tax" value={`${REFERRAL_RATE_OF_TAX_PCT}% of the ${TAX_PCT}%, each side`} />
          <KVRow label="Funded by" value={`Ops, ${OPS_PCT}% down to ${OPS_FLOOR_PCT}%`} />
          <KVRow label="Airdrop, LP, Reserve" value="Unchanged" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <MicroLabel>Never backdated</MicroLabel>
            <p style={{ ...body14, margin: "8px 0 0" }}>
              A binding counts from the block it is signed in. Trades made before then earn nothing, for either side.
            </p>
          </div>
          <div>
            <MicroLabel>Trade from the wallet you bound</MicroLabel>
            <p style={{ ...body14, margin: "8px 0 0" }}>
              Attribution follows the $OURO itself. On a buy it follows the tokens to where they land, on a sell it
              follows them back to whoever sent them. Route a trade through a different address and there is nothing to
              match it against.
            </p>
          </div>
          <div>
            <MicroLabel>Nothing is pushed</MicroLabel>
            <p style={{ ...body14, margin: "8px 0 0" }}>
              Rebates are claimed, unlike the airdrop, which is pushed to holders and never needs claiming. Two different
              mechanisms, deliberately.
            </p>
          </div>
          <div>
            <MicroLabel>Both directions count</MicroLabel>
            <p style={{ ...body14, margin: "8px 0 0" }}>
              A sell pays the same tax a buy does, so it earns the same rebate. What is being rewarded is volume routed
              through the taxed pool, not a guess about which way it went.
            </p>
          </div>
        </div>
      </Grid>

      <Callout tone="note" title="Where the numbers come from">
        <p style={{ ...body14, margin: 0 }}>
          Every trade is read from the $OURO pool on {site.chain.name} and matched to the wallet the tokens came from or
          came to rest in. Each epoch publishes its full input set alongside the root the payouts commit to, so anyone can rebuild the
          figures and check their own row rather than take ours.{" "}
          <a href={site.links.buy} {...externalLinkProps(site.links.buy)}>
            Buy $OURO
          </a>
          .
        </p>
      </Callout>

      <div style={{ height: 64 }} />
    </Container>
  );
}
