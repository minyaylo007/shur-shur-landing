"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { scrollToAnchor } from "@/components/motion/SmoothScroll";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { PhoneIcon } from "@/components/ui/icons";
import { site } from "@/lib/site";

interface HeaderProps {
  locale: Locale;
  nav: Dictionary["nav"];
  langSwitcher: Dictionary["langSwitcher"];
}

/* Redesign v2 IA: four destinations instead of five, in scroll order. The
   old #cases and #team sections are gone — their surviving content lives in
   #work and #about respectively. */
const anchors = [
  { id: "#work", key: "work" },
  { id: "#services", key: "services" },
  { id: "#about", key: "about" },
  { id: "#contact", key: "contact" },
] as const;

export function Header({ locale, nav, langSwitcher }: HeaderProps) {
  /* Inverted default (cycle-2 fix): SSR/no-js/pre-hydration render the SAFE
     dark background — cream nav over paper sections is unreadable otherwise.
     JS only *removes* the background once it knows we're at the very top. */
  const [atTop, setAtTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY <= 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAnchor = (event: MouseEvent<HTMLAnchorElement>, hash: string) => {
    event.preventDefault();
    scrollToAnchor(hash);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 text-cream-type transition-[background-color,box-shadow] duration-300 ${
        atTop ? "bg-transparent" : "bg-cherry-deep/90 shadow-[0_2px_24px_rgb(0_0_0/0.35)] backdrop-blur-md"
      }`}
    >
      <a
        href="#main"
        onClick={(e) => handleAnchor(e, "#main")}
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:start-2 focus-visible:z-60 focus-visible:rounded-full focus-visible:bg-juice-500 focus-visible:px-4 focus-visible:py-2 focus-visible:text-paper-50"
      >
        {nav.skipToContent}
      </a>

      {/* `gap-2` below `sm`: the switcher grew from two pills to four, and on a
          320px screen the old `gap-4` pushed it past the edge. From `sm` up the
          bar keeps the spacing it always had. */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 md:h-[72px]">
        <a
          href="#top"
          onClick={(e) => handleAnchor(e, "#top")}
          aria-label="SHUR-SHUR"
          className="cursor-pointer text-xl text-cream-type transition-colors hover:text-juice-300"
        >
          <Logo />
        </a>

        <nav aria-label={nav.menuLabel} className="hidden items-center gap-7 md:flex">
          {anchors.map(({ id, key }) => (
            <a
              key={id}
              href={id}
              onClick={(e) => handleAnchor(e, id)}
              className="cursor-pointer font-display text-[13px] font-bold tracking-wide text-cream-type uppercase transition-colors duration-200 hover:text-juice-300"
            >
              {nav[key]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-cream-type sm:gap-3">
          {/* Brief §5: the phone must be reachable from the top of the page,
              not only from the footer. Icon-only until there is room for the
              number — on a 320px screen the four language pills and the CTA
              already fill the bar. */}
          <a
            href={site.phone.tel}
            aria-label={nav.callLabel}
            className="hidden cursor-pointer items-center gap-2 rounded-full px-2 py-2 text-cream-type transition-colors duration-200 hover:text-juice-300 sm:inline-flex lg:px-3"
          >
            <PhoneIcon className="size-4" />
            {/* Bidi-neutral: pinned LTR so "+380…" keeps its shape in Hebrew. */}
            <span dir="ltr" className="hidden text-sm font-semibold lg:inline">
              {site.phone.display}
            </span>
          </a>
          <LanguageSwitcher locale={locale} dict={langSwitcher} />
          <a
            href="#contact"
            onClick={(e) => handleAnchor(e, "#contact")}
            className="hidden cursor-pointer items-center rounded-full bg-cherry-juice px-5 py-2.5 font-display text-xs font-bold tracking-wide text-cream-type uppercase shadow-[3px_3px_0_rgb(244_239_230)] transition-[translate,box-shadow,background-color] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[1px_1px_0_rgb(244_239_230)] sm:inline-flex"
          >
            {nav.cta}
          </a>
        </div>
      </div>
    </header>
  );
}
