"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface KineticHeadingProps {
  /** Each entry renders as its own masked line. */
  lines: string[];
  as?: "h1" | "h2" | "h3";
  className?: string;
  /** Play immediately on mount (hero) instead of on scroll enter. */
  immediate?: boolean;
}

/**
 * Oversized display heading with per-char masked reveal (GSAP) and a subtle
 * letter-spacing "breathing" once in view (CSS class `.kinetic.is-inview`).
 * Reduced motion → static text, no GSAP.
 */
export function KineticHeading({
  lines,
  as: Tag = "h2",
  className = "",
  immediate = false,
}: KineticHeadingProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Breathing: toggle .is-inview while the heading is on screen.
    const breathObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle("is-inview", entry.isIntersecting);
        }
      },
      { threshold: 0.4 },
    );
    breathObserver.observe(element);

    gsap.registerPlugin(ScrollTrigger);

    // Live reduced-motion gate: the char reveal reverts to static text the
    // moment the preference flips on (and re-arms if it flips back off).
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const chars = element.querySelectorAll<HTMLElement>(".char");

      gsap.fromTo(
        chars,
        { yPercent: 112, rotate: 4 },
        {
          yPercent: 0,
          rotate: 0,
          duration: 0.9,
          ease: "power4.out",
          stagger: 0.026,
          ...(immediate
            ? { delay: 0.15 }
            : {
                scrollTrigger: {
                  trigger: element,
                  start: "top 85%",
                  once: true,
                },
              }),
        },
      );
    });

    return () => {
      breathObserver.disconnect();
      mm.revert();
    };
  }, [immediate]);

  return (
    <Tag ref={ref as never} className={`display-type kinetic ${className}`}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="char-line">
          <span className="sr-only">{line}</span>
          <span aria-hidden="true">
            {line.split(" ").map((word, wordIndex, words) => (
              /* Every char is its own inline-block, so the WORD decides their
                 order: under dir="rtl" a Latin word would come out mirrored
                 ("SMM" → "MMS"). `dir="auto"` resolves each word from its own
                 first strong character — Hebrew words stay RTL, Latin and
                 numeric ones go LTR. In an LTR document it resolves to the
                 direction those words already had, so uk/en/ro are untouched. */
              <span
                key={wordIndex}
                dir="auto"
                className="inline-block overflow-hidden align-bottom whitespace-nowrap"
              >
                {word.split("").map((char, charIndex) => (
                  <span key={charIndex} className="char">
                    {char}
                  </span>
                ))}
                {wordIndex < words.length - 1 ? <span className="char">&nbsp;</span> : null}
              </span>
            ))}
          </span>
        </span>
      ))}
    </Tag>
  );
}
