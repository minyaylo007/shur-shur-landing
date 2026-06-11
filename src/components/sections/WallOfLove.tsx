import type { Dictionary } from "@/dictionaries";
import { PaperCard } from "@/components/ui/PaperCard";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Wall of Love (brief §5 pattern 8) — honest version. No invented DM
 * screenshots or revenue quotes (§9: never fake social proof): the notes are
 * verbatim community comments/captions from verified posts, and the caption
 * says exactly where they come from. Crumpled paper notes on tape, ready to
 * grow as real screenshots get collected.
 */
export function WallOfLove({ dict }: { dict: Dictionary["socials"]["wallOfLove"] }) {
  return (
    <div className="w-full">
      <p className="text-sm text-cream-type/75 italic">{dict.caption}</p>

      <ul className="mt-7 flex flex-wrap items-stretch justify-center gap-7">
        {dict.quotes.map((quote, index) => (
          <Reveal
            as="li"
            key={quote.text}
            delay={index * 0.1}
            className="w-full max-w-xs sm:w-auto sm:max-w-60"
          >
            <PaperCard
              rotate={index % 2 === 0 ? -2.2 : 1.8}
              className="flex h-full flex-col gap-3 p-5 text-left"
            >
              <blockquote className="display-type text-base leading-snug font-extrabold text-cherry-900 md:text-lg">
                «{quote.text}»
              </blockquote>
              <p className="mt-auto text-xs leading-snug text-ink-500">{quote.source}</p>
            </PaperCard>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
