import { Badge, Card } from "~/components/ds";
import { useClock } from "~/hooks/useClock";
import { NumberedRow } from "./NumberedRow";
import { hairline, mono } from "./text";

const STEPS: { n: string; title: string; detail: string; unit?: string }[] = [
  { n: "01", title: "Collect", detail: ": fees from every position, in the tokens they were earned in" },
  { n: "02", title: "Deploy", detail: ": tax ETH split four parts basket to one part ops", unit: " ETH" },
  { n: "03", title: "Airdrop", detail: ": cycle fees split 80 / 20 between holders and the Reserve" },
];

/**
 * "Crank feed" card. Prelaunch it lists the three steps of a cycle with empty
 * amounts; at launch each row reads the treasury's onchain transactions and links each one.
 */
export function CrankFeed({ footer }: { footer: string }) {
  const clock = useClock();
  return (
    <Card label="Cycle feed">
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 14 }}>
          <Badge tone="caution">Awaiting cycle #1</Badge>
          <span style={{ ...mono, fontSize: 12, color: "var(--text-faint)" }}>{clock} · watching</span>
        </div>
        {STEPS.map((s) => (
          <NumberedRow key={s.n} n={s.n} py={14} align="baseline" trailing={<span style={{ ...mono, fontSize: 13, color: "var(--text-faint)" }}>—{s.unit}</span>}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</span>
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{s.detail}</span>
          </NumberedRow>
        ))}
        <div style={{ borderTop: hairline, paddingTop: 14, fontSize: 13, color: "var(--text-muted)" }}>{footer}</div>
      </div>
    </Card>
  );
}
