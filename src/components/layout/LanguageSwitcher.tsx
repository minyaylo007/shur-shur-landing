"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeSegmentPattern, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";

interface LanguageSwitcherProps {
  locale: Locale;
  dict: Dictionary["langSwitcher"];
}

export function LanguageSwitcher({ locale, dict }: LanguageSwitcherProps) {
  const pathname = usePathname() ?? `/${locale}`;
  /* Replace only the locale segment, keep the rest of the path. The pattern is
     generated from `locales`, so a new language switches correctly the moment
     it is added — no hardcoded list to forget here. */
  const rest = pathname.replace(localeSegmentPattern, "");

  return (
    /* Four pills instead of two: on a 320px header they ran past the edge, so
       below `sm` the pills lose the gap, a little padding and a pixel of type.
       From `sm` up the switcher is exactly the size it always was. */
    <nav
      aria-label={dict.label}
      className="flex items-center gap-0 rounded-full border-2 border-current p-0.5 text-[11px] font-bold sm:gap-0.5 sm:text-xs"
    >
      {locales.map((code) => {
        const isActive = code === locale;
        return (
          <Link
            key={code}
            href={`/${code}${rest}`}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`cursor-pointer rounded-full px-1.5 py-1 font-display uppercase tracking-wide transition-colors duration-200 sm:px-2.5 ${
              isActive
                ? "bg-juice-500 text-paper-50"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            {dict[code]}
          </Link>
        );
      })}
    </nav>
  );
}
