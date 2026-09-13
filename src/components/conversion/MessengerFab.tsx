"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { messengers } from "@/lib/site";
import {
  ChatIcon,
  CloseIcon,
  InstagramIcon,
  TelegramIcon,
  ViberIcon,
  WhatsAppIcon,
} from "@/components/ui/icons";

interface MessengerFabProps {
  locale: Locale;
  dict: Dictionary["fab"];
}

/** Static tilt per paper scrap (CSS rotate property — survives reduce). */
const SCRAP_TILTS = [-2, 1.6, -1.2, 2.2];

type ChannelKey = "telegram" | "whatsapp" | "instagram" | "viber";

/**
 * Which messenger sits closest to the thumb, per locale. There is no geo-IP
 * here, so the page language stands in for the region: Ukrainian visitors get
 * Telegram first (≈92% weekly usage in Ukraine), everyone else — English,
 * Hebrew, Romanian — gets WhatsApp first, which dominates in Israel, Romania
 * and most of the rest of our market. Spelled out per locale on purpose: a new
 * language must state its own preference instead of inheriting a `!== "uk"`.
 */
const MESSENGER_ORDER: Record<Locale, readonly ChannelKey[]> = {
  uk: ["telegram", "instagram", "whatsapp", "viber"],
  en: ["whatsapp", "telegram", "instagram", "viber"],
  he: ["whatsapp", "telegram", "instagram", "viber"],
  ro: ["whatsapp", "telegram", "instagram", "viber"],
};

/**
 * Floating multi-messenger button (brief §7.1). A cherry chat FAB in the
 * bottom-right corner that unfolds into paper-scrap deep-links.
 *
 * Geo-ordering approximation: no geo-IP infrastructure exists, so the order
 * follows the page locale — see MESSENGER_ORDER above. Honest subset of the
 * brief's Accept-Language/IP idea. Channels whose contact details are still
 * placeholders are gated out by the `ready` flag in lib/site — the full order
 * kicks in by itself once the real numbers land.
 *
 * Gates: appears only after the hero is scrolled out of view (IO on #top);
 * SSR/no-js keep it inert + invisible (footer/contact carry the same links).
 * The appear/expand motion is plain CSS transitions, killed globally under
 * prefers-reduced-motion (no bounce keyframes by design).
 * Z-map: content < FAB(40) < header(50) < grain(90) < cursor(95).
 */
export function MessengerFab({ locale, dict }: MessengerFabProps) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const menuId = useId();

  const channels = {
    telegram: { ...messengers.telegram, label: dict.channels.telegram, Icon: TelegramIcon },
    whatsapp: { ...messengers.whatsapp, label: dict.channels.whatsapp, Icon: WhatsAppIcon },
    instagram: { ...messengers.instagram, label: dict.channels.instagram, Icon: InstagramIcon },
    viber: { ...messengers.viber, label: dict.channels.viber, Icon: ViberIcon },
  };
  // Only launch-ready channels render — placeholder-numbered deep-links
  // (ready:false in lib/site) would silently swallow real enquiries.
  const order = MESSENGER_ORDER[locale]
    .map((key) => channels[key])
    .filter((channel) => channel.ready);

  // Scroll gate: reveal only after the hero (#top) fully leaves the viewport.
  useEffect(() => {
    const hero = document.querySelector("#top");
    if (!hero) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const passed = !entry.isIntersecting;
          setVisible(passed);
          // Collapse when hiding again (user scrolled back up to the hero).
          if (!passed) {
            setOpen(false);
            // Focus stranded inside the unfolding menu would silently drop
            // to <body> when the scraps unmount — hand it to the trigger.
            if (rootRef.current?.contains(document.activeElement)) {
              buttonRef.current?.focus();
            }
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // Escape closes (focus returns to the trigger); pointer outside closes.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Move focus into the list when it unfolds (disclosure menu pattern).
  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);

  return (
    /* Mobile offset = 5rem (clear of the sticky CTA bar) + the iOS home
       indicator inset — viewportFit:"cover" makes the bar grow by the same
       env() amount, so without it the bar would overlap the FAB. inert makes
       the hidden state unfocusable for keyboards/SRs (SSR ships it hidden). */
    <div
      ref={rootRef}
      inert={!visible}
      className={`fixed end-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 transition-[opacity,translate] duration-300 md:end-6 md:bottom-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      {open ? (
        <ul id={menuId} aria-label={dict.label} className="flex flex-col items-end gap-2.5">
          {order.map(({ href, label, Icon }, index) => (
            <li key={label} style={{ rotate: `${SCRAP_TILTS[index]}deg` }}>
              <a
                ref={index === 0 ? firstLinkRef : undefined}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="paper-texture group relative flex cursor-pointer items-center gap-2.5 rounded-sm px-4 py-2.5 font-display text-xs font-bold tracking-wide text-cherry-900 uppercase shadow-[3px_3px_0_rgb(0_0_0/0.3)] transition-[translate,box-shadow] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_rgb(0_0_0/0.3)]"
              >
                <span
                  aria-hidden="true"
                  className="tape absolute -top-2 left-1/2 h-3.5 w-10 -translate-x-1/2 rotate-[-5deg]"
                />
                <Icon className="size-4 text-juice-500" />
                {label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={open ? dict.close : dict.open}
        className="flex size-14 cursor-pointer items-center justify-center rounded-full bg-cherry-juice text-cream-type shadow-[4px_4px_0_rgb(42_10_14)] transition-[translate,box-shadow,background-color] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[2px_2px_0_rgb(42_10_14)]"
      >
        {open ? <CloseIcon className="size-6" /> : <ChatIcon className="size-6" />}
      </button>
    </div>
  );
}
