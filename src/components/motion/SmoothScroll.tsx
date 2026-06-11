"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let activeLenis: Lenis | null = null;

/** Smooth-scroll to an in-page anchor, falling back gracefully. */
export function scrollToAnchor(hash: string) {
  const element = document.querySelector(hash);
  if (!element) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (activeLenis && !prefersReduced) {
    activeLenis.scrollTo(hash, { offset: -72, duration: 1.4 });
  } else {
    element.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
  }

  // Move keyboard focus with the scroll (WCAG 2.4.1 — skip link must work).
  // No-op for non-focusable targets; <main id="main"> carries tabIndex={-1}.
  (element as HTMLElement).focus({ preventScroll: true });
}

/**
 * Lenis inertial scrolling synced to GSAP's ticker, so ScrollTrigger and
 * Lenis share one rAF loop. Gated by a LIVE reduced-motion query: flipping
 * the OS setting mid-session starts/stops Lenis without a reload.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const lenis = new Lenis({
        duration: 1.15,
        smoothWheel: true,
      });
      activeLenis = lenis;

      lenis.on("scroll", ScrollTrigger.update);

      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      return () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
        activeLenis = null;
      };
    });

    return () => mm.revert();
  }, []);

  return <>{children}</>;
}
