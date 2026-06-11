import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { Reveal } from "@/components/motion/Reveal";
import { Magnetic } from "@/components/motion/Magnetic";
import { FloatingCherries } from "@/components/motion/FloatingCherries";
import { StickerBadge } from "@/components/ui/StickerBadge";
import { InstaGrid } from "@/components/sections/InstaGrid";
import { WallOfLove } from "@/components/sections/WallOfLove";
import { ArrowUpRightIcon, InstagramIcon, TelegramIcon } from "@/components/ui/icons";

/**
 * Photographic dark chapter (brief §2): full-bleed brand photo pulled into
 * the cherry palette with a CSS duotone (grayscale + cherry multiply +
 * color blend) and a scrim under every line of text. Cycle 3 (brief §6):
 * hosts the curated Instagram grid and the honest Wall of Love.
 */
export function Socials({ locale, dict }: { locale: Locale; dict: Dictionary["socials"] }) {
  return (
    <section className="relative isolate overflow-hidden bg-cherry-deep py-20 text-cream-type md:py-24">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src="/brand/smm.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover grayscale"
        />
        <div className="absolute inset-0 bg-cherry-deep mix-blend-color" />
        <div className="absolute inset-0 bg-cherry-deep/55 mix-blend-multiply" />
        <div className="absolute inset-0 bg-linear-to-b from-cherry-deep/75 via-cherry-deep/45 to-cherry-deep/80" />
      </div>

      {/* Floating decor over the team→socials transition (brief §4 #2). */}
      <FloatingCherries variant="section" />

      {/* `relative z-10` (cycle-2 review): under reduce/no-js the Reveal
          children have transform:none → no stacking context, so without an
          explicit one the absolutely-positioned decor paints OVER the text. */}
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-7 px-4 text-center sm:px-6">
        <Reveal>
          <StickerBadge variant="paper" rotate={2}>
            {dict.kicker}
          </StickerBadge>
        </Reveal>

        <Reveal delay={0.1}>
          <h2 className="display-type text-[clamp(2rem,6vw,4.2rem)] font-black">{dict.heading}</h2>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="max-w-xl text-lg text-cream-type/90">{dict.sub}</p>
        </Reveal>

        {/* Curated 6-tile grid — Approach A (brief §6): owned imagery, real
            post links, zero third-party widgets. */}
        <InstaGrid locale={locale} label={dict.gridLabel} />

        <Reveal delay={0.1} className="flex flex-wrap items-center justify-center gap-5">
          <Magnetic strength={10}>
            <a
              href={site.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex cursor-pointer items-center gap-3 rounded-full bg-cherry-950 px-8 py-4 font-display text-sm font-bold tracking-wide uppercase shadow-[5px_5px_0_rgb(38_3_8/0.45)] transition-[translate,box-shadow] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgb(38_3_8/0.45)]"
            >
              <InstagramIcon className="size-5" />
              {dict.ctaInstagram}
              <ArrowUpRightIcon className="size-4 transition-[translate] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </Magnetic>
          <a
            href={site.socials.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-cream-type px-6 py-3.5 font-display text-sm font-bold tracking-wide uppercase transition-colors duration-200 hover:bg-cream-type hover:text-cherry-juice"
          >
            <TelegramIcon className="size-5" />
            {dict.ctaTelegram}
          </a>
        </Reveal>

        {/* Wall of Love — verbatim community comments, honestly sourced. */}
        <div className="mt-6 w-full">
          <WallOfLove dict={dict.wallOfLove} />
        </div>
      </div>
    </section>
  );
}
