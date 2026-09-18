import { useState, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: ReactNode;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "style"> {
  label?: ReactNode;
  hint?: ReactNode;
  options: SelectOption[];
  /** Applies to the outer <label>. */
  style?: CSSProperties;
  /** Applies to the <select> itself. */
  selectStyle?: CSSProperties;
}

export function Select({ label, hint, options, style, selectStyle, className, onFocus, onBlur, ...rest }: SelectProps) {
  const [focused, setFocused] = useState(false);
  return (
    <label className={className} style={{ display: "block", fontFamily: "var(--font-body)", ...style }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
          {label}
        </div>
      )}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: 40,
          background: "var(--surface-field)",
          borderRadius: "var(--radius-sm)",
          border: focused ? "1px solid var(--border-accent)" : "1px solid var(--border-soft)",
          boxShadow: focused ? "var(--focus-ring)" : "none",
          transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
          boxSizing: "border-box",
        }}
      >
        <select
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            width: "100%",
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            padding: "0 32px 0 12px",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--text-primary)",
            cursor: "pointer",
            ...selectStyle,
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true" style={{ position: "absolute", right: 12, pointerEvents: "none", fontSize: 11, color: "var(--text-muted)" }}>
          ▾
        </span>
      </div>
      {hint && <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-faint)" }}>{hint}</div>}
    </label>
  );
}
