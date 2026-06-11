import type { ReactNode } from "react";

interface StickerBadgeProps {
  children: ReactNode;
  variant?: "paper" | "juice" | "outline";
  rotate?: number;
  className?: string;
}

/** Collage sticker: rotated pill with a hard offset shadow. */
export function StickerBadge({
  children,
  variant = "paper",
  rotate = -3,
  className = "",
}: StickerBadgeProps) {
  const variants: Record<NonNullable<StickerBadgeProps["variant"]>, string> = {
    paper: "bg-paper-50 text-cherry-800 border-cherry-800",
    juice: "bg-juice-500 text-paper-50 border-paper-50",
    outline: "bg-transparent text-paper-50 border-paper-50",
  };

  return (
    <span
      className={`inline-block rounded-full border-2 px-4 py-1.5 font-display text-[11px] font-bold tracking-[0.14em] uppercase shadow-[3px_3px_0_rgb(0_0_0/0.25)] ${variants[variant]} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
