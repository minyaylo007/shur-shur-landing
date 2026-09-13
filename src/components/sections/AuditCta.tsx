import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { AuditForm } from "@/components/forms/AuditForm";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { InstagramIcon, PhoneIcon, TelegramIcon } from "@/components/ui/icons";

/**
 * Conversion section (brief §4, §19, §20): the free Instagram audit and the
 * direct channels, side by side, as the single destination of every CTA on
 * the page.
 *
 * Two deliberate changes from v1:
 *
 * 1. The audit form used to sit inside the hero, competing with the primary
 *    CTA for the first screen. It now lives here, after the visitor has seen
 *    the work — asking for a handle before showing anything is the weakest
 *    possible order (§5).
 * 2. v1 had a separate «Контакти» section AND a contact block in the footer
 *    AND four floating messenger circles. All three are consolidated: the
 *    channels below, one persistent control (ContactBar), and the footer.
 *
 * The channel list is deliberately short. Phone first, because it was the one
 * thing the old site never showed; then the two the agency actually watches.
 * WhatsApp and Viber reach the same number and live in the ContactBar, so
 * repeating them here would just be four near-identical rows.
 */
export function AuditCta({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary["audit"];
}) {
  const channels = [
    {
      href: site.phone.tel,
      icon: PhoneIcon,
      label: site.phone.display,
      /* Bidi-neutral: a "+380 97…" string inside an RTL paragraph is laid
         out right-to-left by the algorithm and the "+" jumps to the end. */
      pin: true,
      external: false,
    },
    {
      href: site.socials.telegram,
      icon: TelegramIcon,
      label: site.socials.telegramHandle,
      pin: true,
      external: true,
    },
    {
      href: site.socials.instagram,
      icon: InstagramIcon,
      label: site.socials.instagramHandle,
      pin: true,
      external: true,
    },
  ];

  return (
    <section id="contact" className="scroll-mt-24 bg-paper-50 py-20 md:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 md:px-8">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.sub} tone="dark" />

        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          <Reveal>
            <div className="rounded-lg border-2 border-cherry-900/15 bg-paper-100 p-6 md:p-8">
              <AuditForm
                locale={locale}
                dict={dict.form}
                delivery={dict.delivery}
              />
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="flex flex-col gap-5">
              <h3 className="font-display text-sm font-bold tracking-[0.14em] text-ink-700 uppercase">
                {dict.channelsLabel}
              </h3>
              <ul className="flex flex-col gap-3">
                {channels.map(({ href, icon: Icon, label, pin, external }) => (
                  <li key={href}>
                    <a
                      href={href}
                      {...(external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="group flex items-center gap-3.5 rounded-md border-2 border-cherry-900/15 bg-paper-100 px-4 py-3.5 transition-colors duration-200 hover:border-juice-500 hover:bg-paper-200"
                    >
                      <Icon className="size-5 shrink-0 text-juice-500" />
                      <span
                        {...(pin ? { dir: "ltr" as const } : {})}
                        className="text-base font-semibold text-cherry-900 group-hover:text-juice-500"
                      >
                        {label}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-ink-500">{dict.cityLine}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
