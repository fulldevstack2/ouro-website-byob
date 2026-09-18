import { useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "style"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Mono, tabular digits, for amounts and addresses. */
  mono?: boolean;
  /** Applies to the outer <label>. */
  style?: CSSProperties;
  /** Applies to the <input> itself. */
  inputStyle?: CSSProperties;
}

export function Input({ label, hint, error, prefix, suffix, mono = false, style, inputStyle, className, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const affix: CSSProperties = { fontSize: 13, fontWeight: 500, color: "var(--text-muted)", fontFamily: mono ? "var(--font-mono)" : "inherit", flex: "none" };

  return (
    <label className={className} style={{ display: "block", fontFamily: "var(--font-body)", ...style }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "var(--tracking-caps)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
          {label}
        </div>
      )}
      {/* The field carries a stable class so a stylesheet can size it per breakpoint (a phone wants a
          taller box than 40px); everything else about it stays inline, like the rest of the DS. */}
      <div
        className="ds-field"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "0 12px",
          background: "var(--surface-field)",
          borderRadius: "var(--radius-sm)",
          border: error ? "1px solid var(--negative)" : focused ? "1px solid var(--border-accent)" : "1px solid var(--border-soft)",
          boxShadow: focused ? "var(--focus-ring)" : "none",
          transition: "border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
          boxSizing: "border-box",
        }}
      >
        {prefix && <span style={affix}>{prefix}</span>}
        <input
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
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
            fontSize: 14,
            color: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
            padding: 0,
            ...inputStyle,
          }}
        />
        {suffix && <span style={affix}>{suffix}</span>}
      </div>
      {(error || hint) && <div style={{ fontSize: 12, marginTop: 6, color: error ? "var(--text-negative)" : "var(--text-faint)" }}>{error || hint}</div>}
    </label>
  );
}
