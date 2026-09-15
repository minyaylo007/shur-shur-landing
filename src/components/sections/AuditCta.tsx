import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { messengers, primaryChannel, site } from "@/lib/site";
import { AuditForm } from "@/components/forms/AuditForm";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { ContactLink } from "@/components/conversion/ContactLink";
import { buttonClass } from "@/components/ui/Button";
import { InstagramIcon, TelegramIcon } from "@/components/ui/icons";

/**
 * Conversion section (brief §4, §19, §20; v3 §4, §6, §7).
 *
 * v2 offered three equally-weighted rows here — phone, Telegram, Instagram —
 * beside the audit form. That is three ways to say "contact us" and no way to
 * know which one the agency actually wants, which §6 names explicitly as the
 * thing to stop doing. The hierarchy is now:
 *
 *   1. ONE filled button — «Обговорити проєкт» → WhatsApp. The same label and
 *      the same destination as the header and the hero.
 *   2. Telegram, quiet, second — and only when `messengers.telegram.ready` is
 *      true. It is false today (§7): the address in lib/site was never
 *      confirmed by the owner, so nothing renders it.
 *   3. Instagram, a text link, framed as the portfolio account it is rather
 *      than as a third support channel.
 *
 * The phone is not here at all (§4); it appears once, in the footer.
 * The audit form stays the other, differently-labelled offer beside it.
 */
export function AuditCta({
  locale,
  dict,
  ctaLabel,
}: {
  locale: Locale;
  dict: Dictionary["audit"];
  /** The page-wide primary label («Обговорити проєкт»), passed in from the
      nav dictionary so the one main action is worded identically in the
      header, the hero, the sticky control and here (§6). */
  ctaLabel: string;
}) {
  return (
    <section id="contact" className="scroll-mt-24 bg-paper-50 py-20 md:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 md:px-8">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.sub} tone="dark" />

        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          <Reveal>
            <div className="rounded-lg border-2 border-cherry-900/15 bg-paper-100 p-6 md:p-8">
              <AuditForm locale={locale} dict={dict.form} delivery={dict.delivery} />
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="flex flex-col items-start gap-5">
              <h3 className="font-display text-sm font-bold tracking-[0.14em] text-ink-700 uppercase">
                {dict.channelsLabel}
              </h3>

              <ContactLink
                href={primaryChannel.href}
                channel={primaryChannel.key}
                locale={locale}
                placement="contact_section"
                className={buttonClass("juice", "w-full justify-center sm:w-auto")}
              >
                {ctaLabel}
              </ContactLink>

              {/* Second, deliberately unfilled — and absent entirely while the
                  address is a placeholder (§7). */}
              {messengers.telegram.ready ? (
                <ContactLink
                  href={messengers.telegram.href}
                  channel="telegram"
                  locale={locale}
                  placement="contact_section"
                  className="group inline-flex items-center gap-2.5 text-base font-semibold text-cherry-900 underline decoration-cherry-900/25 underline-offset-4 transition-colors hover:text-juice-500 hover:decoration-juice-500"
                >
                  <TelegramIcon className="size-5 shrink-0 text-juice-500" aria-hidden="true" />
                  <span dir="ltr">{site.socials.telegramHandle}</span>
                </ContactLink>
              ) : null}

              {/* A portfolio link, not a rival action: no button, no border. */}
              <ContactLink
                href={site.socials.instagram}
                channel="instagram"
                locale={locale}
                placement="contact_section"
                className="inline-flex items-center gap-2.5 text-sm font-semibold text-ink-700 underline decoration-ink-500/30 underline-offset-4 transition-colors hover:text-juice-500 hover:decoration-juice-500"
              >
                <InstagramIcon className="size-4 shrink-0" aria-hidden="true" />
                {/* Latin handle: pinned LTR so the "@" stays at its head
                    inside an RTL line. */}
                <span dir="ltr">{site.socials.instagramHandle}</span>
              </ContactLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
