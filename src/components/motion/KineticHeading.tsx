"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Reveal timing — shared with the moment the mask slack reopens. */
const REVEAL_DURATION = 0.9;
const REVEAL_STAGGER = 0.026;

/** Progress of the LAST letter's tween at which the masks reopen. `power4.out`
 *  has covered ~94% of the travel by then, so the diacritics ride the final
 *  few pixels into place with their letter instead of popping in at the end —
 *  and the letters are far too close to home to leak out of the slack. */
const MASK_OPEN_AT = 0.5;

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

      const masks = element.querySelectorAll<HTMLElement>(".char-mask");

      /* Close the mask slack (see `.char-mask` in globals.css) for the reveal:
         while the letters sit below the line the mask has to clip exactly at
         the box edge, or their tops show through the slack. `fromTo` parks
         them down there on mount, so this happens now — not when the timeline
         starts, which for a scrolled-to heading can be minutes later. */
      gsap.set(masks, { "--char-mask-slack": "0px" });

      const timeline = gsap.timeline(
        immediate
          ? { delay: 0.15 }
          : { scrollTrigger: { trigger: element, start: "top 85%", once: true } },
      );

      timeline.fromTo(
        chars,
        { yPercent: 112, rotate: 4 },
        {
          yPercent: 0,
          rotate: 0,
          duration: REVEAL_DURATION,
          ease: "power4.out",
          stagger: REVEAL_STAGGER,
        },
        0,
      );

      /* Each word reopens its own slack the moment ITS last letter is all but
         home, so the ascenders and descenders the mask was hiding rejoin the
         letter mid-flight. The stagger runs in document order, so counting
         chars word by word gives each mask its own moment. */
      let charIndex = 0;
      for (const mask of masks) {
        charIndex += mask.querySelectorAll(".char").length;
        timeline.call(
          () => mask.style.removeProperty("--char-mask-slack"),
          undefined,
          (charIndex - 1) * REVEAL_STAGGER + MASK_OPEN_AT * REVEAL_DURATION,
        );
      }
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
                className="char-mask inline-block align-bottom whitespace-nowrap"
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
