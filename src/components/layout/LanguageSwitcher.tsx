"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";

interface LanguageSwitcherProps {
  locale: Locale;
  dict: Dictionary["langSwitcher"];
}

export function LanguageSwitcher({ locale, dict }: LanguageSwitcherProps) {
  const pathname = usePathname() ?? `/${locale}`;
  // Replace only the locale segment, keep the rest of the path.
  const rest = pathname.replace(/^\/(uk|en)(?=\/|$)/, "");

  return (
    <nav aria-label={dict.label} className="flex items-center gap-0.5 rounded-full border-2 border-current p-0.5 text-xs font-bold">
      {locales.map((code) => {
        const isActive = code === locale;
        return (
          <Link
            key={code}
            href={`/${code}${rest}`}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`cursor-pointer rounded-full px-2.5 py-1 font-display uppercase tracking-wide transition-colors duration-200 ${
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
