import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { primaryAction } from "@/lib/channels";
import { heroVideo } from "@/lib/work";
import { AutoVideo } from "@/components/media/AutoVideo";
import { KineticHeading } from "@/components/motion/KineticHeading";
import { Reveal } from "@/components/motion/Reveal";
import { ContactLink } from "@/components/conversion/ContactLink";
import { buttonClass } from "@/components/ui/Button";
import { AnchorLink } from "@/components/motion/SmoothScroll";

interface HeroProps {
  locale: Locale;
  dict: Dictionary["hero"];
}

/**
 * First screen (brief §5, v3 §1 and §6).
 *
 * v2 kept a city sticker, a headline, a subtitle, a button and a row of three
 * contact links. v3 removes two of those:
 *
 *  - The «Контент-агенція • Чернівці» sticker is gone, and the subtitle no
 *    longer ends «Україна, Румунія, Ізраїль» (§1). Geography on the first
 *    screen answers a question nobody has asked yet. It moved to the team
 *    block below the fold, and on 23.09.2026 the owner cut it back there
 *    too: naming three countries read as a limit on where the agency can
 *    work, which it is not.
 *  - The three-link row (phone / Telegram / Instagram) is gone (§4, §6).
 *    Three equally-weighted links next to a button is four actions, which is
 *    no action. What is left is ONE filled button straight into WhatsApp and
 *    one quiet text link down to the work.
 *
 * The media is one clip of the agency shooting on its own street. It is 9:16,
 * like every other file in the archive, so it is used natively: on a phone it
 * fills the screen exactly, and from `lg` up it becomes a tall frame on the
 * inline-end side instead of being cropped into a wide band.
 * `start-auto`/`end-*` are logical, so under RTL the frame moves to the other
 * side on its own and the text still leads.
 */
export function Hero({ locale, dict }: HeroProps) {
  /* The three-link row that used to stand under the button is gone with §4,
     and with it the last place on the first screen that read `site.socials`
     straight through — which is how a dead t.me link reached every locale
     here until 19.09. The button below keeps the lesson rather than the row:
     it is resolved by `primaryAction()`, the same readiness gate, so it can
     degrade to #contact but can never become a link to nowhere. */
  const primary = primaryAction();


  return (
    <section
      id="top"
      /* The gap that opened under the CTA was not a margin anywhere: it was
         this section's own height. `min-h-[88svh]` + `items-center` centre a
         ~500 px content block inside an ~800 px box, so half the leftover
         viewport was parked between the button and the section below — and
         the section below is the SAME cherry-black, so it read as a hole
         rather than as breathing room (owner's cleanup pass, 23.09.2026).
         Two fixes, one per breakpoint, and neither is a negative margin:
           - phones/tablets keep the near-full-screen video, but the content
             is anchored to the BOTTOM, so the leftover height sits above the
             text, over the clip, instead of below the button;
           - from `lg` the viewport height stops driving the box at all. The
             floor is a plain px minimum that real content always clears, so
             the height is content + padding on every desktop, and a taller
             monitor no longer reopens the hole. */
      className="relative isolate flex min-h-[88svh] items-end overflow-hidden bg-cherry-black text-cream-type lg:min-h-[600px] lg:items-center"
    >
      <div className="absolute inset-0 lg:inset-y-10 lg:start-auto lg:end-10 lg:w-[36%] lg:rounded-2xl lg:overflow-hidden">
        <AutoVideo
          eager
          src={heroVideo.src}
          poster={heroVideo.poster}
          width={heroVideo.width}
          height={heroVideo.height}
          label={heroVideo.alt[locale]}
          className="size-full object-cover"
        />
        {/* Scrim: heavy on phones, where the text sits on top of the clip;
            from `lg` the text has its own column and only a light edge
            gradient is needed to keep the frame from glaring. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-cherry-black via-cherry-black/75 to-cherry-black/35 lg:bg-linear-to-t lg:from-cherry-black/40 lg:via-transparent lg:to-transparent"
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 pt-24 pb-16 sm:px-6 lg:pt-28 lg:pb-20">
        <div className="flex max-w-xl flex-col items-start gap-7 lg:max-w-[52%]">
          <KineticHeading
            as="h1"
            immediate
            lines={dict.titleLines}
            className="text-[clamp(2.4rem,8vw,5.2rem)] font-extrabold text-cream-type"
          />

          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-cream-type/85 md:text-lg">
              {dict.subtitle}
            </p>
          </Reveal>

          {/* Exactly one filled button on the page's first screen (§6), and it
              opens the messenger directly rather than scrolling to a form. */}
          <Reveal delay={0.18} className="w-full">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              <ContactLink
                href={primary.href}
                channel={primary.key}
                locale={locale}
                placement="hero"
                {...(primary.external ? {} : { target: undefined, rel: undefined })}
                className={buttonClass("juice", "w-full justify-center sm:w-auto")}
              >
                {dict.cta}
              </ContactLink>
              <AnchorLink
                hash="#work"
                className="cursor-pointer text-sm font-semibold text-cream-type/75 underline decoration-cream-type/30 underline-offset-4 transition-colors hover:text-juice-300 hover:decoration-juice-300"
              >
                {dict.secondary}
              </AnchorLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
