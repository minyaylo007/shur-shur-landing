import Image from "next/image";
import type { Dictionary } from "@/dictionaries";
import { knownHandles } from "@/lib/posts";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PaperCard } from "@/components/ui/PaperCard";
import { Reveal } from "@/components/motion/Reveal";
import { PhoneReels } from "@/components/sections/PhoneReels";
import { ArrowUpRightIcon, PaperClipIcon } from "@/components/ui/icons";

/**
 * Photographic dark chapter #2 (brief §2 Cases row): full-bleed brand photo
 * in the cherry duotone (same CSS recipe as Socials), with four anonymized
 * metric cards as numbered paper scraps (Obys 01–04 + one hard NoGood-style
 * figure each, brief §5 placeholder strategy), the reel-phone row, and the
 * «нас знають» strip of VERIFIED client/partner handles.
 */
export function Cases({ dict }: { dict: Dictionary["cases"] }) {
  return (
    <section
      id="cases"
      className="relative isolate scroll-mt-20 overflow-hidden bg-cherry-deep py-20 text-cream-type md:py-28"
    >
      {/* Duotone backdrop — grayscale photo + cherry colorize + multiply +
          scrim, so type never sits on raw pixels (brief §2). */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src="/brand/video.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover grayscale"
        />
        <div className="absolute inset-0 bg-cherry-deep mix-blend-color" />
        <div className="absolute inset-0 bg-cherry-deep/60 mix-blend-multiply" />
        <div className="absolute inset-0 bg-linear-to-b from-cherry-deep/85 via-cherry-deep/50 to-cherry-deep/90" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.sub} tone="light" />

        <ul className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
          {dict.items.map((item, index) => (
            <Reveal as="li" key={item.niche} delay={(index % 4) * 0.1}>
              <PaperCard
                rotate={index % 2 === 0 ? -1.8 : 1.6}
                tape={index % 2 === 1}
                className="relative flex h-full flex-col gap-3 p-6 md:p-7"
              >
                {index % 2 === 0 ? (
                  <PaperClipIcon
                    aria-hidden="true"
                    className="absolute -top-6 right-7 h-12 w-6 rotate-12 text-ink-500"
                  />
                ) : null}

                {/* Obys-style catalogue number. */}
                <span className="font-display text-xs font-black tracking-[0.3em] text-cherry-700">
                  {item.num}
                </span>

                <h3 className="display-type text-xl font-extrabold text-cherry-900">
                  {item.niche}
                </h3>

                {/* ONE giant figure per card (Ragged Edge formula, brief §5). */}
                <span className="display-type text-[clamp(2.9rem,4.5vw,4rem)] leading-none font-black text-cherry-juice">
                  {item.value}
                </span>
                <p className="text-sm font-semibold text-ink-700">{item.context}</p>

                <a
                  href="#contact"
                  aria-label={`${dict.micro} — ${item.niche}`}
                  className="mt-auto inline-flex cursor-pointer items-center gap-1.5 border-t border-cherry-900/15 pt-4 font-display text-xs font-bold tracking-wide text-cherry-700 uppercase transition-colors duration-200 hover:text-cherry-juice"
                >
                  {dict.micro}
                  <ArrowUpRightIcon className="size-3.5" />
                </a>
              </PaperCard>
            </Reveal>
          ))}
        </ul>

        {/* Reel phones — movement + proof + product in one row. */}
        <PhoneReels dict={dict.reels} />

        {/* «Нас знають» — real, verified handles (appendix research). */}
        <Reveal className="mt-14">
          <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3 border-t border-cream-type/15 pt-6">
            <span className="font-display text-[11px] font-bold tracking-[0.25em] text-cream-type/70 uppercase">
              {dict.knownBy.label}
            </span>
            {knownHandles.map((known, index) => (
              <a
                key={known.handle}
                href={known.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex cursor-pointer items-baseline gap-1.5 text-sm transition-colors duration-200 hover:text-juice-300"
              >
                <span className="font-bold">{known.handle}</span>
                <span className="text-cream-type/65 transition-colors duration-200 group-hover:text-juice-300/80">
                  — {dict.knownBy.names[index]}
                </span>
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
