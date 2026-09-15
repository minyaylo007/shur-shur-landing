"use client";

import { useEffect, useRef } from "react";

interface KineticHeadingProps {
  /** Each entry renders as its own masked line. */
  lines: string[];
  as?: "h1" | "h2" | "h3";
  className?: string;
  /** Play immediately on mount (hero) instead of on scroll enter. */
  immediate?: boolean;
}

/**
 * Oversized display heading with a per-character masked reveal.
 *
 * v3, discrepancy §11: this used to be the reason the site shipped GSAP +
 * ScrollTrigger (~124 KB gzipped for two components). The animation is a
 * transform on N spans with a stagger — CSS does that natively, and an
 * IntersectionObserver decides when. What is left in JS is one observer and
 * one class toggle; the motion itself is the `char-rise` keyframe in
 * globals.css, and the per-character delay is a CSS custom property.
 *
 * Behaviour parity with the GSAP version:
 *  - same rise-and-settle (112% → 0 with a slight rotation),
 *  - same ~26ms stagger,
 *  - plays once, on entering the viewport (or immediately for the hero),
 *  - reduced motion → static text. That gate is now the `@media
 *    (prefers-reduced-motion: reduce)` block in globals.css, so it is LIVE in
 *    exactly the same way `gsap.matchMedia()` was, without the library.
 *  - the "breathing" letter-spacing while in view is unchanged.
 *
 * With JS off the `.no-js` guard in globals.css leaves every character at its
 * final position, so the heading is simply there.
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

    /* Breathing: toggle .is-inview while the heading is on screen. */
    const breathObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle("is-inview", entry.isIntersecting);
        }
      },
      { threshold: 0.4 },
    );
    breathObserver.observe(element);

    if (immediate) {
      element.classList.add("is-revealed");
      return () => breathObserver.disconnect();
    }

    /* `rootMargin: -15%` reproduces ScrollTrigger's `start: "top 85%"`. */
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target); // once
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    revealObserver.observe(element);

    return () => {
      breathObserver.disconnect();
      revealObserver.disconnect();
    };
  }, [immediate]);

  /* One running index across all lines, so the stagger reads as a single
     sweep through the heading rather than restarting on every line. */
  let charIndex = 0;

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
                {word.split("").map((char) => (
                  <span
                    key={charIndex}
                    className="char"
                    style={{ "--char-index": charIndex++ } as React.CSSProperties}
                  >
                    {char}
                  </span>
                ))}
                {wordIndex < words.length - 1 ? (
                  <span
                    className="char"
                    style={{ "--char-index": charIndex++ } as React.CSSProperties}
                  >
                    &nbsp;
                  </span>
                ) : null}
              </span>
            ))}
          </span>
        </span>
      ))}
    </Tag>
  );
}
