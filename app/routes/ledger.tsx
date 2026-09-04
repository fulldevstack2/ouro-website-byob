import type { Route } from "./+types/ledger";
import { Badge, Callout, LedgerTable, Stat, type LedgerColumn } from "~/components/ds";
import { AddressCell, Container, CrankFeed, Grid, KVRow, MicroLabel, PageHeader, PendingCell, SectionHead, hairline, mono, PayoutCadence } from "~/components/site";
import { INFRASTRUCTURE, PROTOCOL_CONTRACTS, type AddressEntry } from "~/content/protocol";
import { site } from "~/content/site";
import { useClock } from "~/hooks/useClock";
import { pageMeta } from "~/lib/meta";

export function meta({ location }: Route.MetaArgs) {
  return pageMeta({
    title: `The Ledger · ${site.name} treasury, read from the chain`,
    description: "Every movement of the Ouro treasury, read from Robinhood Chain: NAV, taxed share of volume, fees earned, what was airdropped to holders and every cycle. None of it is reported by hand.",
    path: location.pathname,
    image: "/og/ledger.png",
  });
}

function addressRows(entries: AddressEntry[]) {
  return entries.map((e) => ({ c: e.name, a: e.address ? <AddressCell address={e.address} linked={!e.poolId} /> : <PendingCell>Publishes at launch</PendingCell> }));
}

const ADDR_COLS: LedgerColumn[] = [
  { key: "c", label: "Protocol contract" },
  { key: "a", label: "Address", align: "right" },
];
const INFRA_COLS: LedgerColumn[] = [
  { key: "c", label: "Canonical infrastructure" },
  { key: "a", label: "Address", align: "right" },
];

export default function Ledger() {
  const clock = useClock();
  return (
    <Container style={{ paddingTop: 64, minHeight: 640 }}>
      <PageHeader
        kicker="Live proof"
        title="The Ledger."
        lede="Every movement of the treasury, read from the chain. None of it is reported by hand."
        aside={
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 4 }}>
            <Badge tone="caution">Awaiting cycle #1</Badge>
            <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{clock}</span>
          </div>
        }
      />

      <div style={{ maxWidth: 460, marginTop: 28 }}>
        <PayoutCadence />
      </div>
      <Callout title="The Ledger goes live at launch" style={{ marginTop: 32 }}>
        It reads the treasury’s onchain transactions every cycle. Until the first cycle runs, every activity figure below shows a dash. The parameters shown are
        set at deploy and verifiable from block one.
      </Callout>

      <Grid cols="repeat(4, 1fr)" gap={24} className="grid--2col-md" style={{ margin: "40px 0 48px", padding: "28px 0", borderTop: hairline, borderBottom: hairline }}>
        <Stat label="Treasury NAV" value="—" footnote="Owned liquidity, marked to market" />
        <Stat label="Taxed share of volume" value="—" footnote="Target above 60%, published from day one" />
        <Stat label="LP fees earned" value="—" unit="ETH" footnote="All positions, cumulative" />
        <Stat label="Paid to holders · 24 h" value="—" footnote="Marked to market at the time of each airdrop" />
      </Grid>

      <Grid cols="0.9fr 1.1fr" gap={48} align="start" style={{ marginBottom: 64 }}>
        <div>
          <Stat size="lg" label="Supply" value="1,000,000,000" unit="OURO" footnote="Fixed at deploy, no mint function" />
          <div style={{ marginTop: 28 }}>
            <Stat size="lg" label="Paid to holders · all time" value="—" footnote="80% of every cycle's fees, sent in kind" />
          </div>
        </div>
        <div>
          <MicroLabel style={{ marginBottom: 12 }}>The airdrop</MicroLabel>
          <div style={{ borderTop: hairline }}>
            <KVRow label="Wallets paid last cycle" value="—" />
            <KVRow label="The line: balance needed to be paid" value="100,000 OURO" />
            <KVRow label="Cycles run" value="0" border="none" />
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: "var(--text-muted)" }}>
            Each airdrop is a transaction. Every amount here will link to the one that made it. Nothing is sold to fund an airdrop, so what holders receive is
            what the pools earned.
          </div>
        </div>
      </Grid>

      <CrankFeed footer="No entries yet. The first cycle writes row one." />

      <div style={{ marginTop: 64 }}>
        <SectionHead
          kicker="Addresses"
          title="Verify everything."
          titleStyle={{ fontSize: 30 }}
          sub="Protocol addresses publish at launch and are mirrored here. The canonical infrastructure Ouro builds on is already onchain."
          subStyle={{ fontSize: 15 }}
          style={{ marginBottom: 32 }}
        />
        <Grid cols="1fr 1fr" gap={24} align="start">
          <LedgerTable compact columns={ADDR_COLS} rows={addressRows(PROTOCOL_CONTRACTS)} />
          <LedgerTable compact columns={INFRA_COLS} rows={addressRows(INFRASTRUCTURE)} />
        </Grid>
      </div>
    </Container>
  );
}
