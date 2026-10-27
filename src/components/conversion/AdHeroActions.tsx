"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { readAdVisit } from "@/lib/ad-visit";
import { CONTACT_ANCHOR, directAction } from "@/lib/channels";
import { ContactLink } from "@/components/conversion/ContactLink";
import { AnchorLink } from "@/components/motion/SmoothScroll";
import { buttonClass } from "@/components/ui/Button";

interface AdHeroActionsProps {
  locale: Locale;
  /** «Написати в Direct». */
  directLabel: string;
  /** «Обговорити проєкт» — here it scrolls to the form. */
  formLabel: string;
  /** The hero's usual actions: what every non-ad visitor sees. */
  children?: ReactNode;
}

interface AdHeroActionsViewProps extends AdHeroActionsProps {
  fromAd: boolean;
}

// The flag only changes on a new page load: nothing to subscribe to.
const subscribeNothing = () => () => {};

/**
 * The hero's buttons, swapped for a visitor from a Meta ad (lib/ad-visit).
 *
 * The page is prerendered, so the server and the first client render always
 * produce `children` — the hero as everyone knows it — and hydration never
 * mismatches. Only then, in the browser, an ad visitor's hero becomes:
 * Direct as the one filled button, the form as an outlined second one.
 *
 * The Direct click is the same `contact_click` (channel `instagram`,
 * placement `hero`) every other messenger link fires, so it reaches the pixel
 * as Contact under the same consent — no new event, no flag in its fields.
 */
export function AdHeroActions(props: AdHeroActionsProps) {
  const fromAd = useSyncExternalStore(subscribeNothing, readAdVisit, () => false);
  return <AdHeroActionsView {...props} fromAd={fromAd} />;
}

/** Pure render, so both states are testable without a browser. */
export function AdHeroActionsView({ locale, directLabel, formLabel, children, fromAd }: AdHeroActionsViewProps) {
  const direct = fromAd ? directAction() : null;
  if (!direct) return <>{children}</>;
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
      <ContactLink
        href={direct.href}
        channel={direct.key}
        locale={locale}
        placement="hero"
        className={buttonClass("juice", "w-full justify-center sm:w-auto")}
      >
        {directLabel}
      </ContactLink>
      <AnchorLink hash={CONTACT_ANCHOR} className={buttonClass("ghost", "w-full justify-center sm:w-auto")}>
        {formLabel}
      </AnchorLink>
    </div>
  );
}
