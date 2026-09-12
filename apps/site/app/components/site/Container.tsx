import type { CSSProperties, ReactNode } from "react";

/** 1160px measure with the container padding token. Use padding-top/bottom in `style`. */
export function Container({ children, style, className, id }: { children?: ReactNode; style?: CSSProperties; className?: string; id?: string }) {
  return (
    <div id={id} className={className ? `container ${className}` : "container"} style={style}>
      {children}
    </div>
  );
}
