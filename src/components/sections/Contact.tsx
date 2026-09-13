import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PaperCard } from "@/components/ui/PaperCard";
import { Reveal } from "@/components/motion/Reveal";
import { LeadForm } from "@/components/forms/LeadForm";
import { InstagramIcon, TelegramIcon } from "@/components/ui/icons";

interface ContactProps {
  locale: Locale;
  dict: Dictionary["contact"];
}

export function Contact({ locale, dict }: ContactProps) {
  return (
    /* CTA chapter (brief §2): maroon→juice gradient — the ONLY field owned
       by the hottest red. The form keeps its paper backing for AA contrast. */
    <section
      id="contact"
      /* Programmatic focus target: scrollToAnchor() calls focus() on the
         anchor (WCAG 2.4.3) — without tabIndex it is a silent no-op and
         keyboard focus stays behind on <body>. Same pattern as <main>;
         the global :focus-visible ring gives keyboard users the feedback. */
      tabIndex={-1}
      className="relative scroll-mt-20 overflow-hidden bg-linear-to-b from-cherry-900 via-cherry-700 to-cherry-juice py-20 text-cream-type md:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.sub} tone="light" />

          <Reveal delay={0.2} className="flex flex-col gap-3">
            <span className="font-display text-xs font-bold tracking-[0.2em] text-cream-type/70 uppercase">
              {dict.channelsLabel}
            </span>
            <a
              href={site.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2.5 text-lg font-semibold text-cream-type transition-colors hover:text-paper-200"
            >
              <InstagramIcon className="size-5" />
              {/* dir="ltr": the leading "@" is bidi-neutral, so in an RTL
                  paragraph it drifts to the other end of the handle
                  ("shur.shur.agency@"). An LTR document is unaffected. */}
              <span dir="ltr">{site.socials.instagramHandle}</span>
            </a>
            <a
              href={site.socials.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2.5 text-lg font-semibold text-cream-type transition-colors hover:text-paper-200"
            >
              <TelegramIcon className="size-5" />
              <span dir="ltr">{site.socials.telegramHandle}</span>
            </a>
            <p className="mt-2 text-sm text-cream-type/75">{dict.cityLine}</p>
          </Reveal>

          {/* Cycle-4 honest scarcity (brief §7 / §9): capacity positioning,
              never a fake timer. */}
          <Reveal delay={0.3}>
            <p className="max-w-md border-s-4 border-juice-300 ps-4 text-base font-semibold text-cream-type/90">
              {dict.scarcity}
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <PaperCard rotate={0.8} className="p-7 md:p-10">
            <LeadForm locale={locale} dict={dict.form} />
          </PaperCard>
        </Reveal>
      </div>
    </section>
  );
}
