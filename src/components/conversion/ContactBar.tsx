"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { localeChannels } from "@/lib/channels";
import { track } from "@/lib/analytics";
import { CHANNEL_ICONS, ChatIcon, CloseIcon } from "@/components/ui/icons";

interface ContactBarProps {
  locale: Locale;
  dict: Dictionary["contactBar"];
}

/**
 * ONE persistent contact control (brief §19; redesign v3 §4 and §6).
 *
 * It replaced two v1 components at once: the four-scrap messenger FAB and the
 * sticky mobile CTA bar. Between them the old page put up to five floating
 * targets over the content — the brief names that pattern explicitly as
 * something to avoid, and on a 390px phone the FAB and the CTA bar were
 * actually fighting for the same corner (hence the env(safe-area) arithmetic
 * that is still here to keep the control off the iOS home indicator).
 *
 * What v3 changes is what the panel contains.
 *
 *  - The phone left it (§4). A tap-to-call is the most expensive action on the
 *    page and reaches nobody outside office hours; the number now appears once
 *    in the footer, as a detail, and once inside the audit form's failure
 *    state, where a visitor whose message did not send needs every way out
 *    there is.
 *  - The channel list is not written here. It comes from `localeChannels`,
 *    which is the locale ordering and the readiness gate in one: a channel
 *    whose account is still a placeholder is dropped wherever it stands, and
 *    the footer, the contact section and the form's error state read the same
 *    list, so none of them can drift from this one.
 *
 * The control adapts to how many channels survive that gate instead of
 * hard-coding a shape:
 *
 *   1 ready  → the pill IS the link. One tap, straight into the messenger. A
 *              bottom sheet listing a single destination would cost an extra
 *              tap to say nothing — that is the mobile trade-off §6 asks to
 *              justify.
 *   2+ ready → the same pill becomes a disclosure listing them, which is what
 *              happens by itself the day the owner's real Telegram address
 *              lands in lib/site and `ready` flips to true. No other edit.
 *   0 ready  → nothing renders at all, rather than an empty panel.
 *
 * Disclosure semantics (the 2+ branch): aria-expanded on the trigger, Escape
 * and an outside pointer close it, focus moves into the panel and back to the
 * trigger. No modal, no focus trap — nothing here is a dialog.
 *
 * Gates: rendered inert and invisible until the hero (#top) has scrolled out
 * of view, so it never covers the hero's own CTA, and it stays inert for
 * keyboards and screen readers while hidden. SSR ships the hidden state; with
 * no JS it never appears and the contact section and footer carry the same
 * links. Motion is CSS transitions only, so the global reduced-motion
 * kill-switch makes it instant.
 *
 * Z-map: content < bar(40) < header(50) < grain(90).
 */
export function ContactBar({ locale, dict }: ContactBarProps) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const panelId = useId();

  const ready = localeChannels(locale);
  const single = ready.length === 1 ? ready[0] : null;

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

  if (ready.length === 0) return null;

  const pillClass =
    "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full bg-cherry-juice py-3.5 ps-4 pe-5 font-display text-xs font-bold tracking-wide text-cream-type uppercase shadow-[4px_4px_0_rgb(42_10_14)] transition-[translate,box-shadow,background-color] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[2px_2px_0_rgb(42_10_14)]";
  const rowClass =
    "flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-cherry-900 transition-colors duration-200 hover:bg-paper-200 focus-visible:bg-paper-200";

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
      {single ? (
        <a
          href={single.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track({
              name: "contact_click",
              channel: single.key,
              locale,
              placement: "contact_bar",
            })
          }
          className={pillClass}
        >
          <ChatIcon className="size-5" aria-hidden="true" />
          {dict.open}
        </a>
      ) : (
        <>
          {open ? (
            <div
              id={panelId}
              className="paper-texture w-64 rounded-lg border-2 border-cherry-900/15 p-2 shadow-[5px_5px_0_rgb(0_0_0/0.25)]"
            >
              <p className="px-3 pt-1.5 pb-2 font-display text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase">
                {dict.label}
              </p>
              <ul className="flex flex-col">
                {ready.map(({ key, href }, index) => {
                  const Icon = CHANNEL_ICONS[key];
                  return (
                    <li key={key}>
                      <a
                        ref={index === 0 ? firstLinkRef : undefined}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          track({
                            name: "contact_click",
                            channel: key,
                            locale,
                            placement: "contact_bar",
                          })
                        }
                        className={rowClass}
                      >
                        <Icon className="size-4 shrink-0 text-juice-500" aria-hidden="true" />
                        {dict.channels[key]}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            className={pillClass}
          >
            {open ? (
              <CloseIcon className="size-5" aria-hidden="true" />
            ) : (
              <ChatIcon className="size-5" aria-hidden="true" />
            )}
            {open ? dict.close : dict.open}
          </button>
        </>
      )}
    </div>
  );
}
