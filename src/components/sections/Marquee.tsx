import type { Dictionary } from "@/dictionaries";
import { CherryIcon } from "@/components/ui/icons";

interface MarqueeProps {
  dict: Dictionary["marquee"];
  /** Tilted collage band (default) vs straight frame strip (hero edges). */
  tilt?: boolean;
  className?: string;
}

/** Infinite CSS marquee on a hot cherry-juice band (brief §3, mechanic B). */
export function Marquee({ dict, tilt = true, className = "" }: MarqueeProps) {
  const row = (
    <span className="flex shrink-0 items-center">
      {dict.items.map((item) => (
        <span key={item} className="flex items-center">
          <span className="display-type px-6 text-2xl font-extrabold text-cream-type md:px-8 md:text-4xl">
            {item}
          </span>
          <CherryIcon className="size-6 shrink-0 text-cherry-black md:size-8" />
        </span>
      ))}
    </span>
  );

  return (
    <div
      aria-hidden="true"
      className={`relative z-20 overflow-hidden bg-cherry-juice ${
        tilt
          ? "-my-4 -rotate-2 py-4 shadow-[0_10px_30px_rgb(38_3_8/0.35)] md:py-5"
          : "py-3 md:py-4"
      } ${className}`}
      style={tilt ? { width: "104%", marginLeft: "-2%" } : undefined}
    >
      <div className="marquee-track flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
