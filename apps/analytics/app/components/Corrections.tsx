import { externalLinkProps, site } from "~/content/site";

/**
 * The correction route, in the foot of every page.
 *
 * Every figure on this site is read off the chain by an adapter we wrote, and an adapter can be
 * wrong in ways only the project it reads would notice: a wrong contract, a payout venue we do not
 * watch, a holder line drawn at the wrong place. The page already says where each figure rests and
 * marks what it could not count, which is half of being correctable. This is the other half, and it
 * costs one line: somewhere for the person who can see the error to say so.
 *
 * In the foot rather than the header because it is what you want AFTER reading a figure you dispute,
 * and putting it up top would have the chrome ask for feedback before the page has shown anything.
 */
export function Corrections() {
  return (
    <span className="foot-contact">
      Incorrect information, or a suggestion?{" "}
      <a href={site.links.telegram} {...externalLinkProps(site.links.telegram)}>
        Contact us on Telegram ↗
      </a>
    </span>
  );
}
