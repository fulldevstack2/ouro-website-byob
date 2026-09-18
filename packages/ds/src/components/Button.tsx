import { useState, type CSSProperties, type MouseEventHandler, type ReactNode } from "react";
import { Link } from "react-router";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Trailing "→" that nudges right on hover. */
  arrow?: boolean;
  disabled?: boolean;
  /** External URL → renders an <a>. */
  href?: string;
  /** In-app route → renders a React Router <Link>. */
  to?: string;
  target?: string;
  rel?: string;
  type?: "button" | "submit";
  onClick?: MouseEventHandler<HTMLElement>;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  "aria-label"?: string;
}

const SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { height: 32, padding: "0 14px", fontSize: 13 },
  md: { height: 40, padding: "0 18px", fontSize: 14 },
  lg: { height: 48, padding: "0 26px", fontSize: 15 },
};

function variantStyle(variant: ButtonVariant, hover: boolean): CSSProperties {
  switch (variant) {
    case "primary":
      /* Ink on paper in light; light slab on the dark page — both read from semantic text/surface. */
      return {
        background: hover ? "var(--text-secondary)" : "var(--text-primary)",
        color: "var(--surface-page)",
        border: "1px solid transparent",
      };
    case "secondary":
      return {
        background: hover ? "var(--surface-hover)" : "transparent",
        color: "var(--text-primary)",
        border: hover ? "1px solid var(--border-strong)" : "1px solid var(--border-soft)",
      };
    case "ghost":
      return {
        background: hover ? "var(--surface-hover)" : "transparent",
        color: "var(--text-primary)",
        border: "1px solid transparent",
      };
    case "inverse":
      return {
        background: hover ? "var(--accent-soft)" : "var(--surface-card)",
        color: "var(--text-primary)",
        border: "1px solid transparent",
      };
  }
}

export function Button({
  variant = "primary",
  size = "md",
  arrow = false,
  disabled = false,
  href,
  to,
  target,
  rel,
  type = "button",
  onClick,
  children,
  style,
  className,
  "aria-label": ariaLabel,
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const st: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    letterSpacing: "0.01em",
    borderRadius: "var(--radius-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: "all var(--dur-fast) var(--ease-out)",
    opacity: disabled ? 0.45 : 1,
    transform: pressed && !disabled ? "translateY(1px)" : "none",
    boxSizing: "border-box",
    ...SIZES[size],
    ...variantStyle(variant, hover),
    ...style,
  };

  const interaction = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
  };

  const content = (
    <>
      {children}
      {arrow && (
        <span
          aria-hidden="true"
          style={{ transition: "transform var(--dur-fast) var(--ease-out)", transform: hover ? "translateX(2px)" : "none" }}
        >
          →
        </span>
      )}
    </>
  );

  const cls = className ? `btn ${className}` : "btn";
  if (to && !disabled) {
    return (
      <Link to={to} className={cls} style={st} onClick={onClick} aria-label={ariaLabel} {...interaction}>
        {content}
      </Link>
    );
  }
  if (href && !disabled) {
    return (
      <a href={href} target={target} rel={rel} className={cls} style={st} onClick={onClick} aria-label={ariaLabel} {...interaction}>
        {content}
      </a>
    );
  }
  return (
    <button
      type={type}
      disabled={disabled}
      className={cls}
      style={st}
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      {...interaction}
    >
      {content}
    </button>
  );
}
