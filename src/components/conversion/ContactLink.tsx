"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { track, type EventChannel, type EventPlacement } from "@/lib/analytics";

interface ContactLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /**
   * `null` for a destination that is not a channel at all — the primary
   * action degraded to the page's own `#contact` section. Nothing left the
   * site, so nothing is reported as a contact click.
   */
  channel: EventChannel | null;
  locale: Locale;
  placement: EventPlacement;
  children: ReactNode;
}

/**
 * Every contact link on the page goes through here.
 *
 * The only reason this is a client component is the `onClick`: the sections
 * around it are server-rendered, and a server component cannot carry an event
 * handler. It stays deliberately thin — one `<a>`, one `track()` call — so the
 * client bundle grows by an anchor tag rather than by a conversion framework.
 *
 * `target="_blank"` + `rel="noopener noreferrer"` are the default because
 * every channel here leaves the site; pass `target={undefined}` for one that
 * shouldn't.
 */
export function ContactLink({
  href,
  channel,
  locale,
  placement,
  children,
  onClick,
  ...rest
}: ContactLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (channel !== null) track({ name: "contact_click", channel, locale, placement });
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
