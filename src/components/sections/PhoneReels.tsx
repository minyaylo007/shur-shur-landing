import Image from "next/image";
import type { Dictionary } from "@/dictionaries";
import { PlayIcon } from "@/components/ui/icons";
import { StickerBadge } from "@/components/ui/StickerBadge";

/**
 * Reel frames from /public/brand styled as "stills from our reels" — no video
 * assets exist yet, so these are honest static crops with a play affordance.
 * Order matches dict.cases.reels.alts. Stickers are deliberately NON-numeric
 * (REM-FIX-C3, brief §9: no invented view counts — real metrics can replace
 * them once the client supplies verified numbers).
 */
const REELS = [
  { image: "/brand/content.png", sticker: "REELS", rotate: -3 },
  { image: "/brand/motion.png", sticker: "MOTION", rotate: 2 },
  { image: "/brand/target.png", sticker: "TIKTOK", rotate: -1.5 },
  { image: "/brand/consult.png", sticker: "NEW", rotate: 3 },
] as const;

/**
 * Row of tilted CSS phone mockups (brief §5 pattern 3) — pure CSS frames,
 * zero mockup assets. Mobile: horizontal snap-scroll; desktop: static row.
 * Hover tilt straightens the phone and lifts it (Tailwind v4 rotate/translate
 * are separate CSS properties → listed explicitly in the transition; `hover:`
 * only fires on hover-capable devices, the global reduced-motion kill-switch
 * makes the change instant).
 */
export function PhoneReels({ dict }: { dict: Dictionary["cases"]["reels"] }) {
  return (
    <div className="mt-16 md:mt-20">
      <p className="font-display text-[11px] font-bold tracking-[0.25em] text-cream-type/70 uppercase">
        → {dict.kicker}
      </p>

      {/* Keyboard-reachable scroll region (REM-FIX-C3): horizontal scrollers
          must be focusable + labelled so keyboard users can pan them. */}
      <div
        tabIndex={0}
        role="region"
        aria-label={dict.kicker}
        className="-mx-4 mt-7 flex snap-x snap-mandatory gap-7 overflow-x-auto px-4 pt-5 pb-6 sm:-mx-6 sm:px-6 lg:mx-0 lg:justify-between lg:overflow-x-visible lg:px-2"
      >
        {REELS.map((reel, index) => (
          <div
            key={reel.image}
            className="group w-42 shrink-0 snap-center md:w-46"
            style={{ "--phone-rotate": `${reel.rotate}deg` } as React.CSSProperties}
          >
            <div className="relative aspect-[9/19.5] rotate-[var(--phone-rotate)] overflow-hidden rounded-[2.2rem] border-[6px] border-cherry-black bg-cherry-black shadow-[0_26px_45px_-22px_rgb(0_0_0/0.75)] transition-[rotate,translate] duration-300 ease-out group-hover:-translate-y-2 group-hover:rotate-[calc(var(--phone-rotate)*0.35)]">
              <Image
                src={reel.image}
                alt={dict.alts[index] ?? ""}
                fill
                sizes="(min-width: 768px) 184px, 168px"
                className="object-cover"
              />
              {/* Speaker notch + scrim + play affordance + collage sticker. */}
              <span
                aria-hidden="true"
                className="absolute top-2 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-cherry-black"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-cherry-black/60 via-transparent to-cherry-black/20"
              />
              <PlayIcon className="absolute top-1/2 left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-cream-type drop-shadow-[0_4px_10px_rgb(0_0_0/0.4)]" />
              <StickerBadge
                variant="juice"
                rotate={index % 2 === 0 ? -5 : 4}
                className="absolute bottom-4 left-1/2 -translate-x-1/2"
              >
                {reel.sticker}
              </StickerBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
