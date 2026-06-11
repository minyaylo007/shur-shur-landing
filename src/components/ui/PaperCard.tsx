import type { ReactNode } from "react";

interface PaperCardProps {
  children: ReactNode;
  rotate?: number;
  /** Show a masking-tape strip on the top edge. */
  tape?: boolean;
  className?: string;
}

/**
 * Crumpled-paper collage card with optional tape strip.
 * Cycle-2 "peel-off" hover: the card lifts, straightens toward 0° and casts a
 * deeper shadow while the tape stays stuck (scales up + drop-shadow). Base
 * tilt lives in the `--card-rotate` var so the hover state can derive from it
 * (inline `transform` would beat any hover utility). Tailwind v4 `hover:`
 * only applies on (hover: hover) devices → no sticky-hover on touch; the
 * global reduced-motion block makes the change instant, not animated.
 */
export function PaperCard({ children, rotate = 0, tape = true, className = "" }: PaperCardProps) {
  return (
    <div
      className={`paper-texture group relative rotate-[var(--card-rotate)] rounded-sm shadow-[0_18px_40px_-18px_rgb(0_0_0/0.55)] transition-[translate,rotate,box-shadow] duration-300 ease-out hover:-translate-y-2 hover:rotate-[calc(var(--card-rotate)*0.4)] hover:shadow-[0_30px_55px_-18px_rgb(0_0_0/0.65)] ${className}`}
      style={{ "--card-rotate": `${rotate}deg` } as React.CSSProperties}
    >
      {tape ? (
        <span
          aria-hidden="true"
          className="tape absolute -top-3 left-1/2 h-7 w-24 -translate-x-1/2 rotate-[-4deg] transition-[scale,filter] duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_5px_8px_rgb(0_0_0/0.35)]"
        />
      ) : null}
      {children}
    </div>
  );
}
