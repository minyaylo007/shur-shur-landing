"use client";

import { useEffect, useId, useRef } from "react";
import { gsap } from "gsap";

interface DropSpec {
  /** Horizontal position inside the strip. */
  left: string;
  /** Diameter, px. */
  size: number;
  /** Resting offset below the juice bar, px — the static "hanging" pose. */
  hang: number;
  /** Idle oscillation period, s. */
  dur: number;
  /** Periodically detaches and falls (goo neck → separation). */
  fall?: boolean;
}

const DROPS: DropSpec[] = [
  { left: "6%", size: 16, hang: 14, dur: 2.8 },
  { left: "19%", size: 11, hang: 6, dur: 3.6 },
  { left: "33%", size: 20, hang: 20, dur: 2.3, fall: true },
  { left: "48%", size: 9, hang: 4, dur: 4 },
  { left: "61%", size: 15, hang: 16, dur: 3 },
  { left: "76%", size: 18, hang: 10, dur: 2.5, fall: true },
  { left: "90%", size: 12, hang: 18, dur: 3.3 },
];

/**
 * Brief §4 effect #3: cherry juice "leaks" through the torn-paper seam at the
 * hero→services boundary — the ONE place this happens. An SVG goo filter
 * (feGaussianBlur + feColorMatrix alpha-contrast) merges a juice bar with a
 * handful of hanging drops; two of them periodically stretch, neck and fall.
 *
 * Self-defending gates:
 * - reduced motion → gsap.matchMedia never runs: drops stay as STATIC goo;
 * - no-js → same static render (markup is the resting pose);
 * - perf  → the filter rasterizes a small ~max-w-xl strip, never the section.
 * Pure decoration: aria-hidden + pointer-events-none.
 */
export function GooDrips({ className = "" }: { className?: string }) {
  const stripRef = useRef<HTMLDivElement>(null);
  /* Per-instance filter id (cycle-2 review): a hardcoded id silently aliases
     to the first DOM instance and dangles after its unmount. useId output may
     contain ":"/"«»" — strip to keep a valid CSS url() fragment. */
  const filterId = `goo-drips-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const drops = Array.from(strip.querySelectorAll<HTMLElement>("[data-goo-drop]"));
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      drops.forEach((el, i) => {
        const spec = DROPS[i];
        if (spec.fall) {
          // Stretch down, neck off and fall, then regrow from the bar.
          const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.4 + i * 0.8, delay: i * 1.1 });
          tl.to(el, { y: 26, scaleY: 1.5, scaleX: 0.75, duration: 1.15, ease: "power2.in" })
            .to(el, { autoAlpha: 0, duration: 0.22 }, ">-0.12")
            .set(el, { y: 0, scaleX: 1, scaleY: 1 })
            .to(el, { autoAlpha: 1, duration: 0.45, ease: "power1.out" });
        } else {
          // Lazy dangle — the goo neck breathes against the bar.
          gsap.to(el, {
            y: 5 + (i % 3) * 3,
            duration: spec.dur,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: -i * 0.7,
          });
        }
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-0 left-[5%] z-10 h-16 w-[55%] max-w-xl ${className}`}
    >
      <svg className="absolute h-0 w-0" focusable="false" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
            />
          </filter>
        </defs>
      </svg>

      <div ref={stripRef} className="absolute inset-0" style={{ filter: `url(#${filterId})` }}>
        {/* Juice source: clipped flat by the section's overflow-hidden, so it
            reads as paint seeping from under the torn edge above. */}
        <div className="absolute inset-x-0 -top-5 h-8 rounded-b-[48px] bg-cherry-juice" />
        {DROPS.map((drop, index) => (
          <span
            key={index}
            data-goo-drop=""
            className="absolute rounded-full bg-cherry-juice"
            style={{ left: drop.left, top: drop.hang, width: drop.size, height: drop.size }}
          />
        ))}
      </div>
    </div>
  );
}
