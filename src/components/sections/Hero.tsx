import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { readyChannel } from "@/lib/channels";
import { heroVideo } from "@/lib/work";
import { AutoVideo } from "@/components/media/AutoVideo";
import { KineticHeading } from "@/components/motion/KineticHeading";
import { Reveal } from "@/components/motion/Reveal";
import { StickerBadge } from "@/components/ui/StickerBadge";
import { ButtonLink } from "@/components/ui/Button";
import { CHANNEL_ICONS, PhoneIcon } from "@/components/ui/icons";

interface HeroProps {
  locale: Locale;
  dict: Dictionary["hero"];
  contactLabels: { call: string };
}

/**
 * First screen (brief §5).
 *
 * v1 stacked nine competing elements here — a marquee, a 3D cherry, a
 * rotating word, three statistics, two buttons and the whole audit form.
 * v2 keeps four things: who we are, what we do, one primary action, and a
 * direct way to reach a human. The audit form moved to its own section
 * further down, where it is a step in the funnel rather than a second
 * headline competing with the first.
 *
 * The media is one clip of the agency shooting on its own street. It is
 * 9:16, like every other file in the archive, so it is used natively: on a
 * phone it fills the screen exactly, and from `lg` up it becomes a tall
 * frame on the inline-end side instead of being cropped into a wide band.
 * `start-auto`/`end-*` are logical, so under RTL the frame moves to the
 * other side on its own and the text still leads.
 */
export function Hero({ locale, dict, contactLabels }: HeroProps) {
  // The two accounts under the CTA, in the order they have always stood here
  // — but only while the account exists. This row read `site.socials.*`
  // straight through and was the last place still printing a dead t.me link,
  // on the first screen of every locale. `readyChannel` returns null for a
  // channel that is not live, so the @name is unreachable without its link.
  const accounts = (["telegram", "instagram"] as const)
    .map(readyChannel)
    .flatMap((channel) =>
      channel && channel.handle !== null
        ? [{ key: channel.key, href: channel.profile ?? channel.href, handle: channel.handle }]
        : [],
    );

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[88svh] items-center overflow-hidden bg-cherry-black text-cream-type"
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

      <div className="relative mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:py-28">
        <div className="flex max-w-xl flex-col items-start gap-7 lg:max-w-[52%]">
          <Reveal>
            <StickerBadge variant="juice" rotate={-2}>
              {dict.badge}
            </StickerBadge>
          </Reveal>

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

          {/* Exactly one primary action (brief §21). Everything beside it is
              a text link, so there is no second filled button to compete. */}
          <Reveal delay={0.18} className="w-full">
            <ButtonLink href="#contact" variant="juice" className="w-full sm:w-auto">
              {dict.cta}
            </ButtonLink>
          </Reveal>

          <Reveal delay={0.26} className="w-full">
            <div className="flex flex-col gap-3">
              <span className="font-display text-[11px] font-bold tracking-[0.2em] text-cream-type/60 uppercase">
                {dict.contactLabel}
              </span>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold">
                {/* The number was already in the project, inside the wa.me
                    and viber links — brief §5 asks for it to be visible and
                    tappable, so here it is as a real tel: link. */}
                <a
                  href={site.phone.tel}
                  aria-label={contactLabels.call}
                  className="inline-flex cursor-pointer items-center gap-2 text-cream-type transition-colors hover:text-juice-300"
                >
                  <PhoneIcon className="size-4 shrink-0" />
                  <span dir="ltr">{site.phone.display}</span>
                </a>
                {accounts.map(({ key, href, handle }) => {
                  const Icon = CHANNEL_ICONS[key];
                  return (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex cursor-pointer items-center gap-2 text-cream-type transition-colors hover:text-juice-300"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span dir="ltr">{handle}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
