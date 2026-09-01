import { explorerAddressUrl, shortAddress } from "~/content/protocol";
import { externalLinkProps } from "~/content/site";
import { mono } from "./text";

/** Abbreviated address in mono with an explorer link; the full address sits in the title. */
export function AddressCell({ address }: { address: `0x${string}` }) {
  const href = explorerAddressUrl(address);
  return (
    <span style={{ ...mono, fontSize: 13 }} title={address}>
      {shortAddress(address)}{" "}
      <a href={href} aria-label={`${address} on the explorer`} {...externalLinkProps(href)}>
        ↗
      </a>
    </span>
  );
}

/** Placeholder cell for an address or figure that does not exist yet. */
export function PendingCell({ children }: { children: string }) {
  return <span style={{ ...mono, fontSize: 13, color: "var(--text-faint)" }}>{children}</span>;
}
