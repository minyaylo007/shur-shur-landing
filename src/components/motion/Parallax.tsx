"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  /** Positive = drifts down slower, negative = drifts up. Range ~0.1–0.6 */
  speed?: number;
}

/** Scrub-tied vertical drift for floating collage decor. */
export function Parallax({ children, className = "", speed = 0.3 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    gsap.registerPlugin(ScrollTrigger);

    // Live reduced-motion gate: created/reverted as the preference flips.
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        element,
        { y: -60 * speed },
        {
          y: 60 * speed,
          ease: "none",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        },
      );
    });

    return () => mm.revert();
  }, [speed]);

  return (
    <div ref={ref} className={className} aria-hidden="true">
      {children}
    </div>
  );
}
