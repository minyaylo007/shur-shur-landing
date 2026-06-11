"use client";

import { useId, useRef, type PointerEvent, type ReactNode } from "react";
import { gsap } from "gsap";

/* Precomputed splat offsets (px from the button center) — 8 drops. */
const SPLATS = [
  { x: -72, y: -34, s: 1 },
  { x: 64, y: -40, s: 0.8 },
  { x: 98, y: -6, s: 0.9 },
  { x: -100, y: 4, s: 0.7 },
  { x: -58, y: 34, s: 0.85 },
  { x: 50, y: 40, s: 1 },
  { x: 8, y: -48, s: 0.7 },
  { x: 106, y: 28, s: 0.65 },
] as const;

/**
 * Brief §4 effect #3 (splat half): hovering the primary CTA bursts 6–10 juice
 * drops out of the pill; on leave they fly back and goo-merge into it. The
 * goo layer holds its own pill (same shape, behind the real button) so drops
 * visually emerge from and melt back into the button without blurring it.
 *
 * Gates (Magnetic pattern): mouse pointers only + live reduced-motion check
 * in the handler. no-js / reduced motion / touch → drops stay at scale(0),
 * the CTA itself is a plain anchor and keeps working.
 */
export function SplatCTA({ children, className = "" }: { children: ReactNode; className?: string }) {
  const layerRef = useRef<HTMLSpanElement>(null);
  /* Per-instance filter id (cycle-2 review): hardcoded ids alias to the first
     DOM instance. Sanitized — useId may emit ":"/"«»", invalid in url(#…). */
  const filterId = `goo-splat-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const canSplat = (event: PointerEvent<HTMLSpanElement>) =>
    event.pointerType === "mouse" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const handleEnter = (event: PointerEvent<HTMLSpanElement>) => {
    const layer = layerRef.current;
    if (!layer || !canSplat(event)) return;
    gsap.to(layer.querySelectorAll("[data-splat]"), {
      x: (i: number) => SPLATS[i].x,
      y: (i: number) => SPLATS[i].y,
      scale: (i: number) => SPLATS[i].s,
      duration: 0.5,
      ease: "back.out(2.2)",
      stagger: 0.018,
      overwrite: "auto",
    });
  };

  const handleLeave = () => {
    const layer = layerRef.current;
    if (!layer) return;
    gsap.to(layer.querySelectorAll("[data-splat]"), {
      x: 0,
      y: 0,
      scale: 0,
      duration: 0.45,
      ease: "power3.inOut",
      stagger: 0.012,
      overwrite: "auto",
    });
  };

  return (
    <span
      className={`relative inline-block ${className}`}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
    >
      <svg className="absolute h-0 w-0" focusable="false" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
            />
          </filter>
        </defs>
      </svg>

      {/* Goo layer: shadow pill + drops. Sits behind the real button. */}
      <span
        ref={layerRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ filter: `url(#${filterId})` }}
      >
        <span className="absolute inset-0.5 rounded-full bg-juice-500" />
        {SPLATS.map((_, index) => (
          <span
            key={index}
            data-splat=""
            className="absolute top-1/2 left-1/2 -mt-1.75 -ml-1.75 block size-3.5 rounded-full bg-juice-500"
            style={{ transform: "scale(0)" }}
          />
        ))}
      </span>

      <span className="relative z-10 inline-flex">{children}</span>
    </span>
  );
}
