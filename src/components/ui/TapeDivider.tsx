import { CherryIcon, PaperClipIcon } from "@/components/ui/icons";

const colors = {
  /* Cycle-1 palette */
  paper: "bg-paper",
  paper1: "bg-paper-100",
  paper2: "bg-paper-200",
  deep: "bg-cherry-deep",
  black: "bg-cherry-black",
  juiceHot: "bg-cherry-juice",
  /* Legacy keys kept for compatibility */
  cherry: "bg-cherry-900",
  juice: "bg-juice-500",
  ink: "bg-ink-900",
} as const;

interface TapeDividerProps {
  /** Color of the section BELOW the divider (the torn edge "tears into" it). */
  color: keyof typeof colors;
  /** Collage object stitching the two sections together (brief §2: decor
      must overlap the boundary by 40–80px in at least 2 places). */
  decor?: "cherry" | "clip";
  className?: string;
  flip?: boolean;
}

/** Torn-paper section boundary — pure CSS clip-path, zero JS. */
export function TapeDivider({ color, decor, className = "", flip = false }: TapeDividerProps) {
  return (
    <div aria-hidden="true" className={`relative z-10 -mt-8 -mb-px md:-mt-12 ${className}`}>
      <div
        className={`torn-edge h-8 w-full md:h-12 ${colors[color]} ${flip ? "scale-x-[-1]" : ""}`}
      />
      {decor === "cherry" ? (
        <CherryIcon className="absolute -top-12 right-[10%] z-30 h-24 w-auto rotate-12 text-cherry-juice drop-shadow-[0_10px_18px_rgba(38,3,8,0.45)]" />
      ) : null}
      {decor === "clip" ? (
        <PaperClipIcon className="absolute -top-10 left-[12%] z-30 h-24 w-12 -rotate-12 text-ink-500 drop-shadow-[0_8px_14px_rgba(38,3,8,0.4)]" />
      ) : null}
    </div>
  );
}
