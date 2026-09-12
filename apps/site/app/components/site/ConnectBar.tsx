import type { ReactNode } from "react";

/**
 * The bar over an app's rows: its name on the left, the wallet button on the right.
 *
 * It used to carry a note that changed with the wallet state, which meant the row was either a
 * paragraph of instructions or empty. A fixed title is steadier and reads as the app's header, which
 * is what this line is; what a wallet is for is said at the point of need instead. `note` is the one
 * exception, a short line under the title for a fact the title cannot carry: the portfolio uses it to
 * say whose wallet is on screen when that is not the connected one.
 *
 * Not a heading element: the page's h1 is already the page's name, and a near-duplicate h2 under it
 * would be a worse outline, not a better one.
 */
export function ConnectBar({ title, note, right }: { title: ReactNode; note?: ReactNode; right: ReactNode }) {
  return (
    <div className="connect-bar">
      <div style={{ minWidth: 0 }}>
        <div className="connect-bar__title">{title}</div>
        {note && <div className="connect-bar__note">{note}</div>}
      </div>
      <div className="connect-bar__action">{right}</div>
    </div>
  );
}
