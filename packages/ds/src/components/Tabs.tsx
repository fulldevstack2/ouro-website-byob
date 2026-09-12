import { useState, type CSSProperties, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number | string;
}

export interface TabsProps {
  items: TabItem[];
  active?: string;
  onChange?: (id: string) => void;
  style?: CSSProperties;
  className?: string;
}

function TabButton({ item, on, onChange }: { item: TabItem; on: boolean; onChange?: (id: string) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={() => onChange?.(item.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        appearance: "none",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "10px 2px",
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: "0.01em",
        color: on || hover ? "var(--text-primary)" : "var(--text-muted)",
        boxShadow: on ? "inset 0 -2px 0 var(--bronze-600)" : "none",
        transition: "color var(--dur-fast) var(--ease-out)",
      }}
    >
      {item.label}
      {item.count != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, color: "var(--text-faint)", marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>
          {item.count}
        </span>
      )}
    </button>
  );
}

/** Bronze-underline tabs. */
export function Tabs({ items, active, onChange, style, className }: TabsProps) {
  return (
    <div role="tablist" className={className} style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--border-hairline)", ...style }}>
      {items.map((it) => (
        <TabButton key={it.id} item={it} on={it.id === active} onChange={onChange} />
      ))}
    </div>
  );
}
