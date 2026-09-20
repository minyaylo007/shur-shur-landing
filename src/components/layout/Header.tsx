"use client";

import { Suspense, useEffect, useState, type MouseEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { scrollToAnchor } from "@/components/motion/SmoothScroll";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { ContactLink } from "@/components/conversion/ContactLink";
import { primaryAction } from "@/lib/channels";

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
  /* Resolved once per render, not per click: the gate is static data. */
  const primary = primaryAction();

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
      {/* Читаемость поверх первого кадра, БЕЗ плашки.
          Прозрачная шапка над роликом — решение дизайна, и на широком экране
          оно работает: от `lg` ролик уезжает в свою рамку справа, а полоса
          шапки лежит на тёмном поле секции. Ниже `lg` ролик занимает весь
          первый экран, и полоса попадает на светлое небо: кремовый логотип
          и приглушённые (`opacity-70`) неактивные пилюли языков на нём почти
          пропадают.

          Поэтому мягкая подложка-градиент — только ниже `lg` и только пока
          `atTop`. Она не рисует край: 96px (112 от `md`) от 75% cherry-black
          вверху до полной прозрачности внизу, то есть примерно полторы
          высоты полосы, и кадр под ней виден.

          Контраст по WCAG, замерен на самом светлом кадре ролика (перебор
          с шагом 0.2 с по средней яркости полосы шапки: 390 → t=4.0 c,
          768 → t=2.2 c), фон взят из-под самой надписи:

            неактивные пилюли  2.16—3.23 → 4.89—5.98
            логотип            3.93—4.79 → 9.19—10.38

          Активная пилюля рисует свой фон juice-500, её 4.78 подложка не
          меняет. 75/45 вместо 70/40 — ровно для запаса: на 70/40 худшая
          пилюля давала 4.51, то есть AA без права на ошибку.

          `opacity-0`, а не размонтирование: когда страница уже прокручена,
          у шапки есть своя заливка `cherry-deep/90`, и подложка поверх неё
          только затемнила бы верх полосы. Гаснет той же длительностью, что
          и появление заливки, — иначе на границе 24px видна ступенька. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-cherry-black/75 via-cherry-black/45 to-transparent transition-opacity duration-300 md:h-28 lg:hidden ${
          atTop ? "opacity-100" : "opacity-0"
        }`}
      />

      <a
        href="#main"
        onClick={(e) => handleAnchor(e, "#main")}
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:start-2 focus-visible:z-60 focus-visible:rounded-full focus-visible:bg-juice-500 focus-visible:px-4 focus-visible:py-2 focus-visible:text-paper-50"
      >
        {nav.skipToContent}
      </a>

      {/* v3: the bar carries three things — logo, language, one action. The
          phone left the header entirely (§4): it competed with the action that
          converts, and a call reaches nobody after hours. It lives in the
          footer now, as a detail.

          One `gap-2` at every width, on purpose — kept from the 19.09 fix for
          the longest language. `justify-between` already spreads the groups
          whenever there is room, so this value is a *minimum* that only binds
          when the bar is crowded, which is exactly when a wider minimum would
          push a Romanian CTA off the edge. Dropping the phone gives the row
          ~44–160px back depending on width, and the minimum stays anyway:
          slack is not a reason to re-introduce a value that only shows up in
          the failure case. */}
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 md:h-[72px]">
        <a
          href="#top"
          onClick={(e) => handleAnchor(e, "#top")}
          aria-label="SHUR-SHUR"
          className="cursor-pointer text-xl text-cream-type transition-colors hover:text-juice-300"
        >
          <Logo />
        </a>

        {/* The inline menu needs room for the LONGEST translation, not the
            shortest: Romanian "DESPRE NOI" and "SĂ DISCUTĂM PROIECTUL" are ~90px
            wider together than their Ukrainian counterparts. Hence `lg` instead
            of `md` (at 768 the whole bar used to run off the page in every
            locale) and the tighter `gap-4` in the 1024–1279 band, where the
            menu, the switcher and the CTA share one row. From `xl` up the
            spacing is the one the bar always had.

            The budget, measured: on the widest bar (≥1280, where `max-w-7xl`
            caps the row at 1232px of content) Romanian leaves ~14px of slack
            and Ukrainian ~45px. Whoever adds a fifth language should measure it
            here first; the next 47px are in the switcher, which can keep its
            compact size at `xl` too. */}
        <nav aria-label={nav.menuLabel} className="hidden items-center gap-4 lg:flex xl:gap-7">
          {anchors.map(({ id, key }) => (
            <a
              key={id}
              href={id}
              onClick={(e) => handleAnchor(e, id)}
              className="cursor-pointer font-display text-[13px] font-bold tracking-wide whitespace-nowrap text-cream-type uppercase transition-colors duration-200 hover:text-juice-300"
            >
              {nav[key]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-cream-type sm:gap-3">
          {/* useSearchParams() reads the request URL, so the switcher is the
              one client island that cannot be prerendered with the shell. */}
          <Suspense fallback={null}>
            <LanguageSwitcher locale={locale} dict={langSwitcher} />
          </Suspense>
          {/* §6: the single primary action. It goes straight to the messenger
              rather than to #contact — one tap instead of a scroll and a tap.

              Through `primaryAction()`, which is the readiness gate: if the
              chosen channel is ever switched off the button does not vanish
              and does not turn into a dead deep-link — it falls back to
              #contact, where the form and every live channel already are.
              The no-wrap rule on the label below is the 19.09 fix for the
              longest language and stays: it keeps "SĂ DISCUTĂM PROIECTUL" on
              one line.

              The phone is no longer beside it. Until 20.09 the bar carried a
              call link that appeared, shrank to an icon and disappeared again
              across four breakpoints — the most fragile thing in the row, and
              the item v3 §4 removes from the conversion path. The width rules
              that governed it are gone with it; what they protected — a bar
              that does not overflow in Romanian — is now protected by having
              one item fewer, and is measured directly in the overflow table. */}
          <ContactLink
            href={primary.href}
            channel={primary.key}
            locale={locale}
            placement="header"
            {...(primary.external ? {} : { target: undefined, rel: undefined })}
            className="hidden cursor-pointer items-center rounded-full bg-cherry-juice px-5 py-2.5 font-display text-xs font-bold tracking-wide whitespace-nowrap text-cream-type uppercase shadow-[3px_3px_0_rgb(244_239_230)] transition-[translate,box-shadow,background-color] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[1px_1px_0_rgb(244_239_230)] sm:inline-flex"
          >
            {nav.cta}
          </ContactLink>
        </div>
      </div>
    </header>
  );
}
