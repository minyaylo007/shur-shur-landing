"use client";

import { useEffect, useState } from "react";

interface RotatingWordsProps {
  words: string[];
  /** Rotation interval, ms (brief §3: ~1.6s). */
  intervalMs?: number;
  className?: string;
}

/**
 * Cycling hero sub-headline word («SMM / REELS / ТАРГЕТ / КОНТЕНТ»).
 * - SSR/no-js renders the first word — always readable.
 * - Screen readers get the full static list (sr-only); the cycling span is
 *   aria-hidden so it never spams live announcements.
 * - Reduced motion (incl. mid-session flips) stops the rotation entirely.
 */
export function RotatingWords({ words, intervalMs = 1600, className = "" }: RotatingWordsProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    let id: number | undefined;

    const sync = () => {
      if (mql.matches) {
        window.clearInterval(id);
        id = undefined;
      } else if (id === undefined) {
        id = window.setInterval(() => {
          setIndex((current) => (current + 1) % words.length);
        }, intervalMs);
      }
    };

    sync();
    mql.addEventListener("change", sync);
    return () => {
      mql.removeEventListener("change", sync);
      window.clearInterval(id);
    };
  }, [words.length, intervalMs]);

  return (
    <span className={className}>
      <span className="sr-only">{words.join(", ")}</span>
      <span aria-hidden="true" key={index} className="rotating-word">
        {words[index]}
      </span>
    </span>
  );
}
