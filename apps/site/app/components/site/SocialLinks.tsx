import { externalLinkProps, site } from "~/content/site";

/**
 * The two places Ouro talks, as marks rather than words: the bar has room for an icon and not for a
 * handle, and the footer already spells both out in full. Drawn inline at 16px in `currentColor`, so
 * they take the row's ink and its hover, and labelled for anyone who cannot see them.
 */
const SOCIALS: { label: string; href: string; path: string }[] = [
  {
    label: `Ouro on X, ${site.xHandle}`,
    href: site.links.x,
    path: "M18.9 2.5h3.3l-7.2 8.2 8.5 11.3h-6.7l-5.2-6.9-6 6.9H1.3l7.7-8.8L0.9 2.5h6.9l4.7 6.3 5.4-6.3Zm-1.2 17.6h1.8L6.4 4.3H4.5l13.2 15.8Z",
  },
  {
    label: `Ouro on Telegram, ${site.tgHandle}`,
    href: site.links.telegram,
    path: "M23.1 3.3 20 20.4c-.2 1-.9 1.3-1.7.8l-4.8-3.6-2.3 2.3c-.3.3-.5.5-1 .5l.3-4.9L19.4 7c.4-.4-.1-.6-.6-.2L7.7 13.7 3 12.2c-1-.3-1-1 .2-1.5L21.8 2.3c.8-.3 1.5.2 1.3 1Z",
  },
];

export function SocialLinks({ className = "social-links", size = 16 }: { className?: string; size?: number }) {
  return (
    <span className={className}>
      {SOCIALS.map((s) => (
        <a key={s.label} href={s.href} aria-label={s.label} title={s.label} {...externalLinkProps(s.href)}>
          <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
            <path d={s.path} />
          </svg>
        </a>
      ))}
    </span>
  );
}
