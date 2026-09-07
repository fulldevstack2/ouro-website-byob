import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useSignTypedData, useSwitchChain } from "wagmi";

import type { Route } from "./+types/referral";
import { Badge, Button, Callout, Card, LedgerTable, Stat, type LedgerColumn } from "~/components/ds";
import { Container, Grid, KVRow, MicroLabel, PageHeader, SectionHead, body14, hairline, mono } from "~/components/site";
import {
  OPS_FLOOR_PCT,
  OPS_PCT,
  PROGRAM_LIVE,
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
    description: `Share your link and both sides earn ${REFERRAL_RATE_PCT}% of the ETH on every $OURO buy the wallet you referred makes. Funded from the ops leg, so the airdrop is untouched.`,
    path: location.pathname,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   The shape ouro-monitor will serve. Kept here rather than in monitorApi.ts
   until the endpoints exist, so nothing suggests the client already reads them.
   ──────────────────────────────────────────────────────────────────────────── */

interface RefereeRow {
  address: string;
  boundAt: number;
  buys: number;
  volumeEth: number;
  earnedEth: number;
}
interface ReferralAccount {
  address: string;
  boundTo: string | null;
  asReferrer: { referees: number; attributedBuys: number; attributedVolumeEth: number; earnedEth: number; earnedUsd: number | null };
  asReferee: { attributedBuys: number; attributedVolumeEth: number; earnedEth: number; earnedUsd: number | null };
  claimable: { epoch: number | null; amountEth: number; proof: string[] } | null;
  claimed: { cumulativeEth: number };
  referees: RefereeRow[];
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
          of the ETH on every $OURO buy the wallet you referred makes, for as long as they keep buying.
        </p>
      </Card>
      <Card label="You earn">
        <div style={{ ...mono, fontSize: 28, fontWeight: 600, color: "var(--text-primary)" }}>{REFERRAL_RATE_PCT}%</div>
        <p style={{ ...body14, margin: "8px 0 0" }}>
          on your own buys, the moment you bind. Being referred is not a favour you do for someone else.
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

function YourLink({ address }: { address: string }) {
  const link = referralLink(address);
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
}: {
  address: string;
  code: string;
  account: ReferralAccount | null;
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
      const payload = bindPayload(address, code, 0, deadline);
      const signature = await signTypedDataAsync({
        domain: payload.domain,
        types: { Bind: payload.types.Bind },
        primaryType: "Bind",
        message: payload.message,
      });
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
          Every $OURO buy this wallet makes from here on earns {REFERRAL_RATE_PCT}% back for you and {REFERRAL_RATE_PCT}%
          for whoever sent you. Buys made before now do not count.
        </p>
      </Callout>
    );
  }

  return (
    <Card label="You arrived through a referral link" tone="tint">
      <p style={{ ...body14, margin: 0 }}>
        Sign once to bind this wallet. It costs nothing, it is a signature and not a transaction, and from that moment
        both you and the person who sent you earn {REFERRAL_RATE_PCT}% of the ETH on every buy you make.
      </p>
      <p style={{ ...body14, margin: "12px 0 0" }}>
        Binding starts from the block you sign in. It is never applied backwards, so bind before you buy.
      </p>
      <div style={{ marginTop: 20 }}>
        {PROGRAM_LIVE ? (
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
  const a = account;
  const dash = "—";
  return (
    <Grid
      cols="repeat(4, 1fr)"
      gap={24}
      className="grid--2col-md"
      style={{ margin: "40px 0 48px", padding: "28px 0", borderTop: hairline, borderBottom: hairline }}
    >
      <Stat label="Earned referring" value={a ? fmtEth(a.asReferrer.earnedEth) : dash} unit="ETH" footnote={a ? `${fmtNum(a.asReferrer.referees)} referees` : "Nothing yet"} />
      <Stat label="Earned on your own buys" value={a ? fmtEth(a.asReferee.earnedEth) : dash} unit="ETH" footnote={a ? `${fmtNum(a.asReferee.attributedBuys)} buys` : "Bind to start"} />
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

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function ReferralRoute() {
  const w = useWallet();
  const [code, setCode] = useState<string | null>(null);

  // Read ?ref= on the client only: this route is prerendered, so there is no query string at build.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("ref");
    if (q) setCode(q.trim().toLowerCase().slice(0, 16));
  }, []);

  const account = useMonitor<ReferralAccount>(
    PROGRAM_LIVE && MONITOR_API && w.address ? `/v1/referrals/${w.address}` : null,
    30_000,
  );

  const connected = Boolean(w.address);

  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="Referral"
        title={<>Both sides earn.<br />Not just the one sharing the link.</>}
        lede={`Share your link and you earn ${REFERRAL_RATE_PCT}% of the ETH on every $OURO buy the wallet you referred makes. They earn the same ${REFERRAL_RATE_PCT}% on those buys themselves. Both legs come out of the ops share of the tax, so the airdrop is untouched.`}
        aside={
          <Badge tone={PROGRAM_LIVE ? "positive" : "neutral"} dot>
            {PROGRAM_LIVE ? "Live" : "Opens at launch"}
          </Badge>
        }
      />

      <div style={{ marginTop: 48 }}>
        <TheDeal />
      </div>

      {!PROGRAM_LIVE && (
        <Callout tone="note" title="Not live yet" style={{ marginTop: 24 }}>
          <p style={{ ...body14, margin: 0 }}>
            You can connect and see the page exactly as it will work. Binding and claiming open when the accrual engine
            and the distributor are deployed. Until then every figure on this page shows a dash, the same way the rest of
            this site handles a number it cannot yet read from the chain.
          </p>
        </Callout>
      )}

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 20 }}>
        {!connected && <ConnectPanel w={w} />}
        {connected && !w.onRightChain && <WrongChain w={w} />}
        {connected && code && <BindPanel w={w} code={code} account={account.data} />}
        {connected && <YourLink address={w.address as string} />}
      </div>

      {connected && (
        <>
          <SectionHead
            kicker="Your earnings"
            title="What your link has made"
            sub="Earned updates as your referees trade. Claimable appears once the epoch closes and its root is posted, and one claim collects everything owed, so a missed epoch is never lost."
            style={{ marginTop: 64 }}
          />
          <Earnings account={account.data} />

          {account.data?.claimable && account.data.claimable.amountEth > 0 && (
            <Card tone="tint" style={{ marginBottom: 48 }}>
              <Grid cols="1fr auto" gap={24} align="center" className="grid--2col-md">
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                    {fmtEth(account.data.claimable.amountEth)} ETH ready to claim
                  </div>
                  <p style={{ ...body14, margin: "6px 0 0" }}>
                    One transaction, a few cents of gas. It pays out everything owed across every epoch, not just this one.
                  </p>
                </div>
                <Button size="lg" disabled={!PROGRAM_LIVE}>Claim</Button>
              </Grid>
            </Card>
          )}

          <SectionHead kicker="Your referees" title="Who you brought, and what they earned you" style={{ marginTop: 8 }} />
          <div style={{ marginBottom: 64 }}>
            <Referees account={account.data} />
          </div>
        </>
      )}

      <SectionHead
        kicker="How it works"
        title="Read this before you share it"
        sub="Four things that are easy to get wrong, stated plainly so nobody is surprised by them later."
      />
      <Grid cols="1fr 1fr" gap={48} align="start" style={{ marginBottom: 64 }}>
        <div>
          <KVRow label="Paid on buys" value={`${REFERRAL_RATE_PCT}% of the ETH leg`} />
          <KVRow label="As a share of the tax" value={`${REFERRAL_RATE_OF_TAX_PCT}% of the ${TAX_PCT}%, each side`} />
          <KVRow label="Funded by" value={`Ops, ${OPS_PCT}% down to ${OPS_FLOOR_PCT}%`} />
          <KVRow label="Airdrop, LP, Reserve" value="Unchanged" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <MicroLabel>Never backdated</MicroLabel>
            <p style={{ ...body14, margin: "8px 0 0" }}>
              A binding counts from the block it is signed in. Buys made before then earn nothing, for either side.
            </p>
          </div>
          <div>
            <MicroLabel>Buy to the wallet you bound</MicroLabel>
            <p style={{ ...body14, margin: "8px 0 0" }}>
              Attribution follows the $OURO to where it lands. Route a buy to a different address and there is nothing to
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
            <MicroLabel>Sells do not count</MicroLabel>
            <p style={{ ...body14, margin: "8px 0 0" }}>
              A sell pays the tax like any trade, but the rebate is meant to reward bringing buyers, so it is paid on
              buys only.
            </p>
          </div>
        </div>
      </Grid>

      <Callout tone="note" title="Where the numbers come from">
        <p style={{ ...body14, margin: 0 }}>
          Every buy is read from the $OURO pool on {site.chain.name} and matched to the wallet the tokens came to rest
          in. Each epoch publishes its full input set alongside the root the payouts commit to, so anyone can rebuild the
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
