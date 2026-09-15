"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * In-page navigation helpers.
 *
 * v3, discrepancy §11: this file used to import Lenis, GSAP and ScrollTrigger
 * to run an inertial-scroll loop. Both are gone.
 *
 *  - Lenis hijacked the wheel: it replaced the browser's own scrolling with a
 *    1.15s eased animation. Brief §14 rules out scroll hijacking, and the
 *    platform already offers the tame version — `html { scroll-behavior:
 *    smooth }`, which globals.css sets, and which the browser itself disables
 *    under `prefers-reduced-motion`.
 *  - With Lenis gone, nothing needed GSAP's ticker, so ScrollTrigger went too.
 *
 * What remains is `scrollIntoView` plus the focus move, which is the part that
 * actually mattered for accessibility.
 */

/** Scroll to an in-page anchor and move keyboard focus with it. */
export function scrollToAnchor(hash: string) {
  const element = document.querySelector(hash);
  if (!element) return;

  /* `behavior: "smooth"` is already reduced-motion-aware in every current
     browser, but the explicit check keeps the promise if that ever regresses. */
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });

  /* WCAG 2.4.1 — the skip link must actually move focus, not just the
     viewport. No-op for non-focusable targets; <main id="main"> carries
     tabIndex={-1}. */
  (element as HTMLElement).focus({ preventScroll: true });
}

interface AnchorLinkProps {
  hash: string;
  className?: string;
  children: ReactNode;
}

/**
 * A real `<a href="#...">` that also moves focus. Server components cannot
 * carry an onClick, so section markup renders this instead; with JS off it
 * degrades to the browser's own anchor jump.
 */
export function AnchorLink({ hash, className, children }: AnchorLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollToAnchor(hash);
  };
  return (
    <a href={hash} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
