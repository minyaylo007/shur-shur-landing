import type { Dictionary } from "@/dictionaries";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StickerBadge } from "@/components/ui/StickerBadge";
import { Reveal } from "@/components/motion/Reveal";
import { Parallax } from "@/components/motion/Parallax";
import { CherryIcon, PaperClipIcon } from "@/components/ui/icons";

export function About({ dict }: { dict: Dictionary["about"] }) {
  return (
    <section id="about" className="relative scroll-mt-20 overflow-hidden bg-paper py-20 text-ink-900 md:py-28">
      <Parallax speed={0.5} className="absolute top-16 right-[8%] hidden text-cherry-700/30 lg:block">
        <CherryIcon className="animate-float-slow h-24 w-auto" />
      </Parallax>
      <Parallax speed={-0.3} className="absolute bottom-16 left-[6%] hidden text-ink-500/40 lg:block">
        <PaperClipIcon className="h-16 w-8 rotate-[-18deg]" />
      </Parallax>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
        <div>
          <SectionHeading kicker={dict.kicker} heading={dict.heading} />
          <div className="mt-8 flex flex-col gap-5">
            {dict.paragraphs.map((paragraph, index) => (
              <Reveal key={index} delay={index * 0.12}>
                <p className="max-w-xl text-lg leading-relaxed text-ink-700 md:text-xl">
                  {paragraph}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3} className="mt-8">
            <p className="display-type text-2xl font-extrabold text-cherry-juice md:text-3xl">
              {dict.highlight}
            </p>
          </Reveal>
        </div>

        <div className="flex flex-col items-start justify-center gap-6">
          <Reveal>
            <span className="font-display text-xs font-bold tracking-[0.2em] text-ink-500 uppercase">
              {dict.geoLabel}
            </span>
          </Reveal>
          <div className="flex flex-wrap gap-4">
            {dict.geo.map((place, index) => (
              <Reveal key={place} delay={index * 0.1}>
                <StickerBadge
                  variant={index === 0 ? "juice" : "paper"}
                  rotate={index % 2 === 0 ? -3 : 4}
                  className="px-6 py-2.5 text-sm!"
                >
                  {place}
                </StickerBadge>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
