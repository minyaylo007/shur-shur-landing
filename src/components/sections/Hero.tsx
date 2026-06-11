import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { CherryHero } from "@/components/three/CherryHero";
import { AuditForm } from "@/components/forms/AuditForm";
import { HeroSlam } from "@/components/motion/HeroSlam";
import { RotatingWords } from "@/components/motion/RotatingWords";
import { Reveal } from "@/components/motion/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { FloatingCherries } from "@/components/motion/FloatingCherries";
import { Marquee } from "@/components/sections/Marquee";
import { StickerBadge } from "@/components/ui/StickerBadge";
import { PaperCard } from "@/components/ui/PaperCard";
import { ButtonLink } from "@/components/ui/Button";
import { SplatCTA } from "@/components/ui/SplatCTA";
import { ArrowUpRightIcon } from "@/components/ui/icons";

interface HeroProps {
  locale: Locale;
  dict: Dictionary["hero"];
  marquee: Dictionary["marquee"];
}

/**
 * Cycle-1 hero (brief §2/§3): cherry-deep field + full-bleed brand photo
 * under a 40–60% scrim, cream condensed display slammed in by SplitText,
 * a crumpled paper card carrying the CTA, and marquee tickers framing the
 * first screen top & bottom (the bottom one lives in page.tsx).
 */
export function Hero({ locale, dict, marquee }: HeroProps) {
  return (
    <section
      id="top"
      className="relative isolate flex min-h-svh flex-col overflow-hidden bg-cherry-deep pb-16 text-cream-type md:pb-20"
    >
      {/* Full-bleed brand photo + cherry tint + scrims. Text NEVER sits on
          raw pixels: the left/bottom gradients keep 40–60%+ coverage under
          every line of type (brief §2 contrast invariant). */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src="/brand/cover.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-cherry-deep/40 mix-blend-multiply" />
        <div className="absolute inset-0 bg-linear-to-r from-cherry-deep/90 via-cherry-deep/50 to-cherry-deep/15" />
        <div className="absolute inset-0 bg-linear-to-b from-cherry-deep/80 via-transparent to-cherry-deep" />
      </div>

      {/* Top ticker frame — straight band right under the fixed header. */}
      <div className="pt-16 md:pt-[72px]">
        <Marquee dict={marquee} tilt={false} />
      </div>

      {/* Depth-parallax collage layer (brief §4 #2): 8 floating cherries /
          drops / scraps on different z-depths — scroll-scrub + mouse drift. */}
      <FloatingCherries variant="hero" />

      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 pt-10 pb-4 sm:px-6 md:pt-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative z-10 flex flex-col items-start gap-6">
          <Reveal>
            <StickerBadge variant="juice" rotate={-2.5}>
              {dict.badge}
            </StickerBadge>
          </Reveal>

          <HeroSlam
            lines={dict.titleLines}
            className="text-[clamp(3rem,11vw,8rem)] font-black text-cream-type drop-shadow-[0_6px_30px_rgba(42,10,14,0.6)]"
          />

          <p className="display-type flex items-baseline gap-3 text-2xl font-extrabold md:text-3xl">
            <span aria-hidden="true" className="text-cream-type/70">→</span>
            <RotatingWords
              words={dict.rotatingWords}
              className="inline-block min-w-[8ch] text-juice-400"
            />
          </p>

          {/* Crumpled paper card "taped" over the photo — carries the CTA,
              so the primary action stays inside the first viewport. */}
          <Reveal delay={0.35} className="mt-2 w-full max-w-xl">
            <PaperCard rotate={-1.2} className="flex flex-col gap-5 p-6 md:p-8">
              <p className="text-base leading-relaxed text-ink-700 md:text-lg">{dict.subtitle}</p>

              <div className="flex flex-wrap items-center gap-4">
                <Magnetic>
                  {/* Splat-CTA (brief §4 #3): hover bursts juice drops out of
                      the button, leave goo-merges them back. */}
                  <SplatCTA>
                    <ButtonLink href="#contact" variant="juice">
                      {dict.cta}
                      <ArrowUpRightIcon className="size-4" />
                    </ButtonLink>
                  </SplatCTA>
                </Magnetic>
                <ButtonLink href="#services" variant="ghost" className="text-cherry-900">
                  {dict.secondaryCta}
                </ButtonLink>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-cherry-900/15 pt-4">
                {dict.stats.map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-1">
                    <span className="display-type text-3xl font-black text-juice-500 md:text-4xl">
                      {stat.value}
                    </span>
                    <span className="text-xs leading-snug text-ink-500 md:text-sm">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Cycle-4 conversion offer (brief §7.3): one-field free IG
                  audit — minimal friction, same lead pipeline (kind=audit). */}
              <div className="border-t border-cherry-900/15 pt-4">
                <AuditForm locale={locale} dict={dict.audit} />
              </div>
            </PaperCard>
          </Reveal>
        </div>

        {/* 3D cherry (drops into frame, then idles) / poster fallback */}
        <div className="relative mx-auto aspect-square w-full max-w-105 md:max-w-130 lg:max-w-full">
          <CherryHero posterAlt={dict.posterAlt} />
        </div>
      </div>

      <p
        aria-hidden="true"
        className="hidden justify-center font-display text-[11px] font-bold tracking-[0.3em] text-cream-type/60 uppercase md:flex"
      >
        ↓ {dict.scrollHint} ↓
      </p>
    </section>
  );
}
