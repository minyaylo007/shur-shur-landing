import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { processPair } from "@/lib/work";
import { AutoVideo } from "@/components/media/AutoVideo";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

interface ProcessResultProps {
  locale: Locale;
  dict: Dictionary["process"];
}

/**
 * Behind the scenes → finished frame (brief §8).
 *
 * The archive happens to contain both halves of the same shoot: the studio
 * clip of water being poured into a glass tank over a balm, and the finished
 * product frame of that same balm. Showing them as a pair is the single
 * clearest piece of evidence on the page that the agency does the work
 * rather than commissions it.
 *
 * The brief floated a hover-swap or a swipe for this. Both hide one half
 * until the visitor does something, and on a phone a swipe competes with the
 * page scroll. Two panels side by side say the same thing with no
 * interaction to discover, which is also why it survives reduced motion and
 * keyboard-only use untouched.
 */
export function ProcessResult({ locale, dict }: ProcessResultProps) {
  return (
    <section className="bg-paper-100 py-20 md:py-28">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.sub} />

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <Reveal>
            <figure className="flex flex-col gap-3">
              <div className="relative aspect-9/16 overflow-hidden rounded-lg bg-cherry-black/10">
                <AutoVideo
                  src={processPair.bts.src}
                  poster={processPair.bts.poster}
                  width={processPair.bts.width}
                  height={processPair.bts.height}
                  label={processPair.bts.alt[locale]}
                  className="size-full object-cover"
                />
              </div>
              <figcaption className="font-display text-xs font-bold tracking-[0.18em] text-ink-700 uppercase">
                {dict.btsLabel}
              </figcaption>
            </figure>
          </Reveal>

          <Reveal delay={0.12}>
            <figure className="flex flex-col gap-3">
              <div className="relative aspect-9/16 overflow-hidden rounded-lg bg-cherry-black/10">
                <Image
                  src={processPair.result.src}
                  alt={processPair.result.alt[locale]}
                  width={processPair.result.width}
                  height={processPair.result.height}
                  sizes="(min-width: 640px) 45vw, 100vw"
                  className="size-full object-cover"
                />
              </div>
              <figcaption className="font-display text-xs font-bold tracking-[0.18em] text-cherry-900 uppercase">
                {dict.resultLabel}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
