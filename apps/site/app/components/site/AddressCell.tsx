import { explorerAddressUrl, shortAddress } from "~/content/protocol";
import { externalLinkProps } from "~/content/site";
import { mono } from "./text";

/**
 * Abbreviated address in mono with an explorer link; the full address sits in the title.
 * `linked={false}` for a v4 pool id, which is a key inside the PoolManager rather than a
 * contract, so the explorer has no page to point at.
 */
export function AddressCell({ address, linked = true }: { address: `0x${string}`; linked?: boolean }) {
  const href = explorerAddressUrl(address);
  return (
    <span style={{ ...mono, fontSize: 13 }} title={address}>
      {shortAddress(address)}
      {linked ? (
        <>
          {" "}
          <a href={href} aria-label={`${address} on the explorer`} {...externalLinkProps(href)}>
            ↗
          </a>
        </>
      ) : null}
    </span>
  );
}

/** Placeholder cell for an address or figure that does not exist yet. */
export function PendingCell({ children }: { children: string }) {
  return <span style={{ ...mono, fontSize: 13, color: "var(--text-faint)" }}>{children}</span>;
}
