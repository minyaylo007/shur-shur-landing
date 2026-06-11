import type { Dictionary } from "@/dictionaries";
import { Reveal } from "@/components/motion/Reveal";
import { StickerBadge } from "@/components/ui/StickerBadge";

/**
 * Pain block (brief §7 copy layer, Sociallyin pattern): a narrow dark strip
 * right after the hero marquee — the provocative question, three short
 * pains, and an arrow that funnels into Services. Visually it continues the
 * hero chapter (same cherry-deep field), so the torn paper edge below it
 * still reads as the first dark→cream transition.
 */
export function Pain({ dict }: { dict: Dictionary["pain"] }) {
  return (
    <section className="relative overflow-hidden bg-cherry-deep py-16 text-cream-type md:py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-9 px-4 sm:px-6">
        <Reveal>
          <StickerBadge variant="outline" rotate={-2}>
            {dict.kicker}
          </StickerBadge>
        </Reveal>

        <Reveal delay={0.1}>
          <h2 className="display-type text-[clamp(1.9rem,5.5vw,3.8rem)] font-black text-cream-type">
            {dict.heading}
          </h2>
        </Reveal>

        <ul className="flex flex-col gap-4">
          {dict.pains.map((pain, index) => (
            <Reveal as="li" key={pain} delay={0.18 + index * 0.12}>
              <div className="flex items-baseline gap-4">
                <span
                  aria-hidden="true"
                  className="font-display text-sm font-black tracking-[0.2em] text-juice-300"
                >
                  0{index + 1}
                </span>
                <p className="text-lg leading-snug font-semibold text-cream-type/90 md:text-xl">
                  {pain}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.55}>
          <a
            href="#services"
            className="group inline-flex cursor-pointer items-baseline gap-3 font-display text-sm font-bold tracking-wide text-juice-300 uppercase underline decoration-2 underline-offset-8 transition-colors hover:text-cream-type"
          >
            {dict.cta}
            <span aria-hidden="true" className="inline-block transition-[translate] duration-200 group-hover:translate-y-1">
              ↓
            </span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
