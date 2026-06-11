"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface CountUpProps {
  value: number;
  /** Fractional digits to keep while counting (e.g. 4.2 → 1). */
  decimals?: number;
  /** Animation length, s (brief §5: 1.5s). */
  duration?: number;
  className?: string;
}

const format = (val: number, decimals: number) => val.toFixed(decimals);

/**
 * Count-up number (brief §5 pattern 6+11). Self-defending by construction:
 * - SSR/no-js/SEO: the span is server-rendered with the FINAL value;
 * - reduced motion: gsap.matchMedia never runs → the final value just stays;
 * - motion: the matched context rewinds the text to 0, then an
 *   IntersectionObserver starts a 1.5s gsap tween that writes via
 *   `textContent` on a ref (no setState in effects — React Compiler safe).
 * Context revert (reduce flipped mid-session) restores the final value.
 */
export function CountUp({ value, decimals = 0, duration = 1.5, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const final = format(value, decimals);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Rewind the SSR'd final only once we KNOW we'll animate.
      el.textContent = format(0, decimals);
      const counter = { v: 0 };
      let tween: gsap.core.Tween | null = null;

      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          io.disconnect();
          tween = gsap.to(counter, {
            v: value,
            duration,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = format(counter.v, decimals);
            },
            // Land exactly on the true value (float easing drift).
            onComplete: () => {
              el.textContent = final;
            },
          });
        },
        { threshold: 0.5 },
      );
      io.observe(el);

      return () => {
        io.disconnect();
        tween?.kill();
        el.textContent = final;
      };
    });

    return () => mm.revert();
  }, [value, decimals, duration]);

  return (
    <span ref={ref} className={className}>
      {format(value, decimals)}
    </span>
  );
}
