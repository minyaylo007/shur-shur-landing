"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { Dictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { scrollToAnchor } from "@/components/motion/SmoothScroll";
import { CherryIcon, TelegramIcon } from "@/components/ui/icons";

interface StickyCtaProps {
  dict: Dictionary["stickyCta"];
}

/**
 * Mobile-only sticky bottom CTA bar (brief §7.5): IG-bio traffic is ≈100%
 * mobile, so one juicy brand-voice button rides along until the visitor
 * reaches the contact form.
 *
 * Visibility = hero scrolled past AND #contact not yet reached. The contact
 * gate is a ONE-WAY latch (REM-FIX-C4): once the visitor has seen the form
 * the bar's job is done — without the latch it pops back over the footer on
 * short screens. SSR/no-js ship it inert + invisible; the slide-in is a CSS
 * transition, killed globally under reduced motion.
 * Z-map: content < bar(40) < header(50) < grain(90) < cursor(95).
 */
export function StickyCta({ dict }: StickyCtaProps) {
  const [heroPassed, setHeroPassed] = useState(false);
  const [contactReached, setContactReached] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("#top");
    const contact = document.querySelector("#contact");
    if (!hero || !contact) return;

    const heroIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setHeroPassed(!entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );
    const contactIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // One-way latch: never un-set — the bar must not return after
          // the visitor has already reached the form once.
          if (entry.isIntersecting) setContactReached(true);
        }
      },
      { threshold: 0 },
    );

    heroIo.observe(hero);
    contactIo.observe(contact);
    return () => {
      heroIo.disconnect();
      contactIo.disconnect();
    };
  }, []);

  const visible = heroPassed && !contactReached;

  const handleCta = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollToAnchor("#contact");
  };

  return (
    <div
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 transition-[opacity,translate] duration-300 md:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
      }`}
    >
      {/* safe-area padding keeps the buttons above iOS home indicators. */}
      <div className="flex items-center gap-3 border-t-2 border-cherry-juice/60 bg-cherry-black/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
        <a
          href="#contact"
          onClick={handleCta}
          className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-cherry-juice px-5 py-2.5 font-display text-sm font-bold tracking-wide text-cream-type uppercase shadow-[3px_3px_0_rgb(244_239_230/0.25)]"
        >
          {dict.cta}
          <CherryIcon className="size-5" />
        </a>
        <a
          href={site.socials.telegram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={dict.telegramLabel}
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-cream-type/40 text-cream-type transition-colors hover:border-juice-300 hover:text-juice-300"
        >
          <TelegramIcon className="size-5" />
        </a>
      </div>
    </div>
  );
}
