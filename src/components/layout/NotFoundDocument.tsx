"use client";

/* eslint-disable @next/next/no-html-link-for-pages --
   Plain <a>, not next/link, and on purpose. This document IS the root of its
   own render: it draws <html>/<body> itself, so a client-side navigation out
   of it would have to swap the page inside a document the app never laid out.
   The visitor came to a dead address; the honest way out is one full load of
   a live page. */

import { usePathname } from "next/navigation";
import { getDictionary } from "@/dictionaries";
import {
  defaultLocale,
  getDirection,
  isLocale,
  locales,
  localeNames,
  type Locale,
} from "@/lib/i18n";
import { Logo } from "@/components/ui/Logo";

/**
 * The 404 page — a WHOLE document, not a section of one.
 *
 * Next renders this for every address that matches no route, and at that
 * moment `[locale]/layout.tsx` is not in play: an unmatched address has no
 * layout above it. So this file renders its own <html>, and with it the two
 * things the stock Next 404 loses — `lang` and `dir`.
 *
 * Which language to speak is read from the address itself. Two cases:
 *   • the first segment IS one of ours (`/uk/tsiny`, `/he/xxx`) → the page
 *     speaks that language, in its own direction;
 *   • it is not (`/fr`, `/ukk`, `/qwerty`) → nobody knows what the visitor
 *     reads, so the page speaks uk and en at once, like `global-error.tsx`,
 *     and the four language links become the main way out.
 *
 * No messenger links here on purpose: a dead address is exactly where a dead
 * link hurts twice. The way out is a LIVE page of the site, which already
 * gathers every channel.
 */

/** The locale of a request path, or null when the first segment is not ours. */
export function localeFromPath(pathname: string | null | undefined): Locale | null {
  const first = (pathname ?? "").split("/")[1] ?? "";
  return isLocale(first) ? first : null;
}

export interface NotFoundViewProps {
  /** The address that was asked for; null when it cannot be read. */
  pathname: string | null;
  latinFontClass: string;
  hebrewFontClass: string;
}

/**
 * The document itself, with the address passed IN — no hooks, so a test can
 * render it for any address without a browser or a running server.
 */
export function NotFoundView({ pathname, latinFontClass, hebrewFontClass }: NotFoundViewProps) {
  const matched = localeFromPath(pathname);
  const locale: Locale = matched ?? defaultLocale;
  const dict = getDictionary(locale);
  const t = dict.notFound;
  /* Second voice — only for the address whose language we could not read.
     When the locale is known one language is the RIGHT answer, and a second
     one would only be noise. */
  const second = matched === null ? getDictionary("en").notFound : null;

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={locale === "he" ? hebrewFontClass : latinFontClass}
    >
      <body className="grain antialiased">
        {/* React hoists this into <head>; the page owns its own document, so
            the title has to come from here to follow the locale.
            `<meta name="robots" content="noindex">` is not repeated here —
            Next already emits it for this route (checked in the built HTML). */}
        <title>{t.metaTitle}</title>

        <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-10 px-6 py-16 sm:px-10">
          <a href={`/${locale}`} className="w-fit text-2xl hover:opacity-80">
            <Logo />
          </a>

          <div>
            {/* Hardcoded, not a dictionary string: the code is the same in
                every language, and it is a status code, not a claim. */}
            <p aria-hidden="true" className="font-display text-6xl font-black text-juice-300 sm:text-8xl">
              404
            </p>
            <h1 className="display-type mt-4 text-3xl font-black sm:text-5xl">{t.heading}</h1>
            {second && (
              <p className="display-type mt-2 text-lg font-bold opacity-70 sm:text-2xl">{second.heading}</p>
            )}
            <p className="mt-5 max-w-xl leading-relaxed opacity-90 sm:text-lg">{t.text}</p>
            {second && (
              <p className="mt-2 max-w-xl text-sm leading-relaxed opacity-70 sm:text-base">{second.text}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`/${locale}`}
              className="rounded-full bg-juice-500 px-7 py-3 font-display text-sm font-bold tracking-wide text-paper-50 uppercase hover:bg-cherry-juice"
            >
              {t.home}
            </a>
            {second && (
              <a
                href="/en"
                className="rounded-full border-2 border-current px-7 py-3 font-display text-sm font-bold tracking-wide uppercase hover:opacity-80"
              >
                {second.home}
              </a>
            )}
          </div>

          <nav aria-label={t.chooseLanguage} className="flex flex-wrap items-center gap-3">
            <span className="text-sm opacity-60">
              {t.chooseLanguage}
              {second ? ` · ${second.chooseLanguage}` : ""}
            </span>
            <ul className="flex flex-wrap gap-2">
              {locales.map((code) => (
                <li key={code}>
                  <a
                    href={`/${code}`}
                    lang={code}
                    dir={getDirection(code)}
                    aria-current={matched === code ? "page" : undefined}
                    className={`inline-block rounded-full border-2 px-4 py-1.5 font-display text-xs font-bold tracking-wide uppercase ${
                      matched === code
                        ? "border-juice-500 bg-juice-500 text-paper-50"
                        : "border-current opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* Autonym, from lib/i18n. Production read these four
                        names out of `dict.langSwitcher`; redesign v3 moved
                        them into the locale table itself, because a language
                        name has no business being translated — someone who
                        only reads Hebrew must find «עברית», not «Іврит». The
                        404 page is the one place where that matters most: it
                        is where a visitor who landed in the wrong language
                        gets out. */}
                    {localeNames[code]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </body>
    </html>
  );
}

/**
 * The wiring: `usePathname()` is the only place in the app that knows the
 * address of a request that matched no route — request headers do not carry
 * it, and there are no route params to read. It resolves to the real path
 * during the SERVER render of this page (checked, see the PR), so `lang`,
 * `dir` and the copy are correct in the HTML before any JavaScript runs.
 */
export function NotFoundDocument(props: Omit<NotFoundViewProps, "pathname">) {
  return <NotFoundView pathname={usePathname()} {...props} />;
}
