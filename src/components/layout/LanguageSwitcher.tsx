"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  locales,
  localeNames,
  localeShort,
  localeSegmentPattern,
  localeStorageKey,
  type Locale,
} from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { track } from "@/lib/analytics";
import { GlobeIcon, ChevronDownIcon, CheckIcon } from "@/components/ui/icons";

interface LanguageSwitcherProps {
  locale: Locale;
  dict: Dictionary["langSwitcher"];
}

/**
 * The language control (v3, discrepancy §2).
 *
 * v2 drew four permanent pills. Four is already too many for a 320px header,
 * and it grows with every locale added. This is a disclosure instead: globe +
 * the current code + a chevron, opening a list of the languages written in
 * themselves.
 *
 * Deliberate choices:
 *  - NO FLAGS. A flag names a country, not a language: Hebrew is not Israel,
 *    Romanian is not only Romania, and English has no flag at all.
 *  - Native names (autonyms) from `localeNames` — someone who only reads
 *    Hebrew must find «עברית», not the word "Hebrew" spelled in Ukrainian.
 *  - THE QUERY STRING SURVIVES. v2 rebuilt the href from the pathname alone,
 *    so switching language on a campaign landing silently dropped every UTM
 *    parameter and the visit lost its attribution. `useSearchParams()` is
 *    re-appended below.
 *  - A manual choice is remembered in localStorage AND a cookie. The cookie is
 *    what a future middleware/redirect would read on the server; localStorage
 *    is what survives when cookies are cleared per-session. Nothing reads them
 *    yet — no middleware exists — but the choice is recorded from today, so
 *    turning the redirect on later does not need a fresh visit to learn it.
 *
 * Keyboard/ARIA: the trigger is a real `<button aria-expanded aria-controls>`;
 * the list is a `<ul role="listbox">` of `<a role="option">` links (still real
 * links, so middle-click and "open in new tab" keep working). Arrow keys move
 * between options, Home/End jump, Escape closes and returns focus to the
 * trigger, a pointerdown outside closes, and focus leaving the widget closes.
 */
/**
 * Record a MANUAL language choice for a year, in both stores.
 *
 * Module scope on purpose: writing to `document.cookie` is a mutation of a
 * value the component does not own, which the React Compiler's immutability
 * rule flags inside a component body — correctly, since it is a side effect
 * on the document, not on state. Here it is plainly what it is: a small
 * imperative helper a click handler calls.
 *
 * Two stores because they answer different questions. `localStorage` is read
 * by the client; the cookie is what a future server-side redirect would read,
 * so remembering the choice does not depend on shipping more JavaScript.
 */
function remember(code: Locale): void {
  try {
    window.localStorage.setItem(localeStorageKey, code);
  } catch {
    /* Private mode / storage disabled — the cookie below still records it. */
  }
  /* One year, site-wide, SameSite=Lax: a language preference, not a tracker. */
  document.cookie = `${localeStorageKey}=${code}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher({ locale, dict }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname() ?? `/${locale}`;
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  /* Replace only the locale segment and keep everything after it — including
     the query string, which is where campaign UTMs live. */
  const rest = pathname.replace(localeSegmentPattern, "");
  const query = searchParams?.toString();
  const hrefFor = (code: Locale) => `/${code}${rest}${query ? `?${query}` : ""}`;

  /* Close on Escape, on a pointer outside, and when focus leaves the widget. */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  /* Opening moves focus onto the current language, so a keyboard user lands
     where they already are rather than at the top of an unfamiliar list. */
  useEffect(() => {
    if (!open) return;
    const current = listRef.current?.querySelector<HTMLAnchorElement>('[aria-selected="true"]');
    (current ?? listRef.current?.querySelector("a"))?.focus();
  }, [open]);

  const choose = (code: Locale) => {
    remember(code);
    track({ name: "language_switch", locale, to: code, placement: "header" });
    setOpen(false);
    /* `scroll: false` keeps the reading position across the swap. */
    router.push(hrefFor(code), { scroll: false });
  };

  /** Roving focus inside the open list. */
  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll("a") ?? []);
    const index = items.indexOf(document.activeElement as HTMLAnchorElement);
    const go = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") go(index + 1);
    else if (event.key === "ArrowUp") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(items.length - 1);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${dict.label}: ${localeNames[locale]}`}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        /* min-h-11: a finger target, not a 24px pill. */
        className="flex min-h-11 cursor-pointer items-center gap-1 rounded-full border-2 border-current px-2.5 py-1.5 font-display text-xs font-bold tracking-wide uppercase transition-colors duration-200 hover:text-juice-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:px-3"
      >
        <GlobeIcon className="size-4" aria-hidden="true" />
        {/* Language codes are Latin: pinned LTR so they keep shape in Hebrew. */}
        <span dir="ltr">{localeShort[locale]}</span>
        <ChevronDownIcon
          className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={dict.label}
        hidden={!open}
        onKeyDown={onListKeyDown}
        className="absolute end-0 top-[calc(100%+0.5rem)] z-10 min-w-44 overflow-hidden rounded-2xl border-2 border-cream-type/20 bg-cherry-deep py-1 text-cream-type shadow-[0_12px_32px_rgb(0_0_0/0.35)]"
      >
        {locales.map((code) => {
          const isCurrent = code === locale;
          return (
            <li key={code} role="none">
              <a
                href={hrefFor(code)}
                role="option"
                aria-selected={isCurrent}
                lang={code}
                /* The names are written in their own script, so each option
                   carries its own direction rather than the page's. */
                dir="auto"
                onClick={(event) => {
                  /* Let modified clicks (new tab, new window) behave natively. */
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  choose(code);
                }}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-cream-type/10 focus-visible:bg-cream-type/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current ${
                  isCurrent ? "font-semibold" : ""
                }`}
              >
                <span>{localeNames[code]}</span>
                {isCurrent ? (
                  <>
                    <CheckIcon className="size-4 text-juice-300" aria-hidden="true" />
                    <span className="sr-only">{dict.current}</span>
                  </>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
