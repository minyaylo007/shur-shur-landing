"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

interface HeroSlamProps {
  /** Each entry renders as its own display line. */
  lines: string[];
  className?: string;
}

/**
 * Hero headline "slam" (brief §3, mechanic A): GSAP SplitText (free since
 * 3.13) hammers the chars in with an aggressive stagger — scale + y-drop +
 * blur→sharp. The h1 is server-rendered as PLAIN visible text:
 * - no-js / pre-hydration → headline readable (and counts as LCP);
 * - reduced motion → gsap.matchMedia never runs, text stays static;
 * - a11y: `aria: "auto"` would write aria-label from raw textContent and
 *   glue the block lines together ("СОКОВИТИЙSMM ТА…") — so the split is
 *   `aria: "none"` and the h1 carries an explicit space-joined aria-label;
 * - `type: "words,chars"` forbids line breaks INSIDE a word;
 * - `charsClass: "char"` feeds the `.hero-slam .char` CSS hook.
 */
export function HeroSlam({ lines, className = "" }: HeroSlamProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    gsap.registerPlugin(SplitText);

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const split = SplitText.create(element, {
        type: "words,chars",
        charsClass: "char",
        aria: "none",
      });

      const tween = gsap.from(split.chars, {
        yPercent: 110,
        scale: 1.45,
        opacity: 0,
        filter: "blur(12px)",
        duration: 0.65,
        ease: "power4.out",
        stagger: 0.032,
        delay: 0.1,
        clearProps: "filter,willChange",
      });

      return () => {
        tween.kill();
        split.revert();
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <h1
      ref={ref}
      aria-label={lines.join(" ")}
      className={`display-type hero-slam ${className}`}
    >
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
    </h1>
  );
}
