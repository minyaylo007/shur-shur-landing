"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { CherryIcon } from "@/components/ui/icons";

/**
 * Tiny trailing cherry companion for the cursor (brief §8 cycle 2, optional).
 * It LAGS slightly behind/beside the pointer via gsap.quickTo and squishes on
 * mousedown — the system cursor is NEVER hidden (interactive elements keep
 * their normal `cursor: pointer`).
 *
 * Gates: lives only inside gsap.matchMedia
 * "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
 * → touch devices, small screens, reduced motion and no-js all render nothing
 * (the element stays display:none).
 */
export function CherryCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    mm.add(
      "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        gsap.set(el, { display: "block", autoAlpha: 0 });
        const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3.out" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3.out" });
        let shown = false;

        const onMove = (event: MouseEvent) => {
          // Offset below-right so the cherry never covers the pointer tip.
          const x = event.clientX + 14;
          const y = event.clientY + 20;
          if (!shown) {
            shown = true;
            // Jump straight onto the pointer BEFORE revealing — quickTo starts
            // from the element's CURRENT transform (0,0 by default), so without
            // this set the cherry visibly flies in from the screen corner
            // (cycle-2 hunt HIGH). After the set, quickTo continues from here.
            gsap.set(el, { x, y });
            gsap.to(el, { autoAlpha: 1, duration: 0.3 });
            return;
          }
          xTo(x);
          yTo(y);
        };
        const onDown = () => gsap.to(el, { scaleX: 1.35, scaleY: 0.68, duration: 0.1, ease: "power2.out" });
        const onUp = () => gsap.to(el, { scaleX: 1, scaleY: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
        const onLeave = () => {
          shown = false;
          gsap.to(el, { autoAlpha: 0, duration: 0.25 });
        };

        window.addEventListener("mousemove", onMove, { passive: true });
        window.addEventListener("mousedown", onDown);
        window.addEventListener("mouseup", onUp);
        document.documentElement.addEventListener("mouseleave", onLeave);

        return () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mousedown", onDown);
          window.removeEventListener("mouseup", onUp);
          document.documentElement.removeEventListener("mouseleave", onLeave);
        };
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none fixed top-0 left-0 z-[95] hidden">
      <CherryIcon className="h-7 w-auto text-cherry-juice drop-shadow-[0_2px_6px_rgba(42,10,14,0.45)]" />
    </div>
  );
}
