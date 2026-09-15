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

      {/* One `gap-2` at every width, on purpose. `justify-between` already
          spreads the three groups whenever there is room, so this value is a
          *minimum* that only binds when the bar is crowded — which is exactly
          when a wider minimum would push a Romanian CTA off the edge. Nothing
          moves on a roomy bar: the 16px the old `sm:gap-4` reserved was never
          visible there. */}
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
          {/* Brief §5: the phone must be reachable from the top of the page,
              not only from the footer. It is the one item in the bar that has a
              second home two taps away (the contact pill, the hero, the
              footer), so it is also the one that yields when the bar is full —
              and the bar is full wherever the CTA and the four language pills
              have to share the row with something else:

                <768   no room even for the icon. It used to show from 640
                       (`sm:inline-flex`), which is what the `md` here
                       changed: at 640 the Romanian bar does not fit with it
                768—1023  icon only — no inline menu at these widths
                1024—1279 nothing — the inline menu has the middle of the bar
                ≥1280  icon + number, the full bar the site always had

              The gap in the middle is the deliberate part: at 1024 the Romanian
              menu plus CTA leave ~20px of slack, and a 44px phone would spend
              all of it. */}
          <a
            href={site.phone.tel}
            aria-label={nav.callLabel}
            className="hidden cursor-pointer items-center gap-2 rounded-full px-2 py-2 text-cream-type transition-colors duration-200 hover:text-juice-300 md:inline-flex lg:hidden xl:inline-flex xl:px-3"
          >
            <PhoneIcon className="size-4" />
            {/* Bidi-neutral: pinned LTR so "+380…" keeps its shape in Hebrew. */}
            <span dir="ltr" className="hidden text-sm font-semibold whitespace-nowrap xl:inline">
              {site.phone.display}
            </span>
          </a>
          <LanguageSwitcher locale={locale} dict={langSwitcher} />
          <a
            href="#contact"
            onClick={(e) => handleAnchor(e, "#contact")}
            className="hidden cursor-pointer items-center rounded-full bg-cherry-juice px-5 py-2.5 font-display text-xs font-bold tracking-wide whitespace-nowrap text-cream-type uppercase shadow-[3px_3px_0_rgb(244_239_230)] transition-[translate,box-shadow,background-color] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[1px_1px_0_rgb(244_239_230)] sm:inline-flex"
          >
            {nav.cta}
          </a>
        </div>
      </div>
    </header>
  );
}
