"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { messengers, site } from "@/lib/site";
import {
  ChatIcon,
  CloseIcon,
  InstagramIcon,
  PhoneIcon,
  TelegramIcon,
  ViberIcon,
  WhatsAppIcon,
} from "@/components/ui/icons";

interface ContactBarProps {
  locale: Locale;
  dict: Dictionary["contactBar"];
  /** Accessible name for the phone row — the visible label is the number. */
  callLabel: string;
}

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
 * ONE persistent contact control (brief §19).
 *
 * It replaces two v1 components at once: the four-scrap messenger FAB and the
 * sticky mobile CTA bar. Between them the old page put up to five floating
 * targets over the content — the brief names that pattern explicitly as
 * something to avoid, and on a 390px phone the FAB and the CTA bar were
 * actually fighting for the same corner (hence the env(safe-area) arithmetic
 * that used to be needed to keep them apart).
 *
 * What is left is a single labelled pill in the inline-end corner. Closed it
 * reads as one word; open it is a small panel with the phone number first —
 * the one channel v1 never showed anywhere — then the messengers in locale
 * order. Panel semantics are a plain disclosure: aria-expanded on the trigger,
 * Escape and outside-pointer close it, focus goes into the panel and back to
 * the trigger. No modal, no focus trap: nothing here is a dialog.
 *
 * Gates: rendered inert and invisible until the hero (#top) has scrolled out
 * of view, so it never covers the hero's own CTA, and it stays inert for
 * keyboards and screen readers while hidden. SSR ships the hidden state; with
 * no JS it simply never appears and the footer/contact section carry the same
 * links. Motion is CSS transitions only, so the global reduced-motion
 * kill-switch makes it instant.
 *
 * Z-map: content < bar(40) < header(50) < grain(90).
 */
export function ContactBar({ locale, dict, callLabel }: ContactBarProps) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const panelId = useId();

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
          if (!passed) {
            setOpen(false);
            // Focus stranded inside the closing panel would silently drop to
            // <body> when the rows unmount — hand it back to the trigger.
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

  // Move focus into the panel when it opens (disclosure pattern).
  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);

  const rowClass =
    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-cherry-900 transition-colors duration-200 hover:bg-paper-200 focus-visible:bg-paper-200";

  return (
    <div
      ref={rootRef}
      inert={!visible}
      /* end-/bottom- are logical, so the control sits bottom-left in Hebrew
         without a mirrored copy. The safe-area inset keeps it clear of the
         iOS home indicator (viewportFit:"cover" is set in the layout). */
      className={`fixed end-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-3 transition-[opacity,translate] duration-300 md:end-6 md:bottom-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      {open ? (
        <div
          id={panelId}
          className="paper-texture w-64 rounded-lg border-2 border-cherry-900/15 p-2 shadow-[5px_5px_0_rgb(0_0_0/0.25)]"
        >
          <p className="px-3 pt-1.5 pb-2 font-display text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">
            {dict.label}
          </p>
          <ul className="flex flex-col">
            <li>
              <a ref={firstLinkRef} href={site.phone.tel} aria-label={callLabel} className={rowClass}>
                <PhoneIcon className="size-4 shrink-0 text-juice-500" />
                {/* Bidi-neutral number: without the pin the "+" would be
                    re-ordered to the far end of the RTL line. */}
                <span dir="ltr">{site.phone.display}</span>
              </a>
            </li>
            {order.map(({ href, label, Icon }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" className={rowClass}>
                  <Icon className="size-4 shrink-0 text-juice-500" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="flex cursor-pointer items-center gap-2.5 rounded-full bg-cherry-juice py-3.5 ps-4 pe-5 font-display text-xs font-bold tracking-wide text-cream-type uppercase shadow-[4px_4px_0_rgb(42_10_14)] transition-[translate,box-shadow,background-color] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[2px_2px_0_rgb(42_10_14)]"
      >
        {open ? <CloseIcon className="size-5" /> : <ChatIcon className="size-5" />}
        {open ? dict.close : dict.open}
      </button>
    </div>
  );
}
