import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { primaryAction, readyChannel } from "@/lib/channels";
import { AuditForm } from "@/components/forms/AuditForm";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { ContactLink } from "@/components/conversion/ContactLink";
import { buttonClass } from "@/components/ui/Button";
import { CHANNEL_ICONS } from "@/components/ui/icons";

/**
 * Conversion section (brief §4, §19, §20; v3 §4, §6, §7).
 *
 * v2 offered three equally-weighted rows here — phone, Telegram, Instagram —
 * beside the audit form. That is three ways to say «contact us» and no way to
 * know which one the agency actually wants, which §6 names explicitly as the
 * thing to stop doing. The hierarchy is now:
 *
 *   1. ONE filled button — «Обговорити проєкт» → the primary channel. The same
 *      label and the same destination as the header and the hero.
 *   2. Telegram, quiet, second — and only while the gate in `lib/channels`
 *      hands it out. It does not today (§7): the address in lib/site was never
 *      confirmed by the owner, so nothing renders it, here or anywhere.
 *   3. Instagram, a text link, framed as the portfolio account it is rather
 *      than as a third support channel.
 *
 * The phone is not in this column at all (v3 §4); it appears once in the
 * footer. It does still appear a few lines below — inside the form's failure
 * state, which offers every live way to reach a human when the message could
 * not be delivered. That is not a conversion path competing for attention, it
 * is the way out of a dead end.
 *
 * Every account here comes through `readyChannel`, which hands out the link
 * and the visible @name together or hands out nothing: a render site cannot
 * print the name of an account it was not allowed to link to.
 */
export function AuditCta({
  locale,
  dict,
  ctaLabel,
  channelLabels,
  callLabel,
}: {
  locale: Locale;
  dict: Dictionary["audit"];
  /** The page-wide primary label («Обговорити проєкт»), passed in from the
      nav dictionary so the one main action is worded identically in the
      header, the hero and here (§6). */
  ctaLabel: string;
  /** Passed through to the form: the channels it offers when sending fails. */
  channelLabels: Dictionary["contactBar"]["channels"];
  /** Accessible name for the phone link in that failure state. */
  callLabel: string;
}) {
  const primary = primaryAction();
  const telegram = readyChannel("telegram");
  const instagram = readyChannel("instagram");
  const TelegramMark = CHANNEL_ICONS.telegram;
  const InstagramMark = CHANNEL_ICONS.instagram;

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
                channelLabels={channelLabels}
                callLabel={callLabel}
              />
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="flex flex-col items-start gap-5">
              <h3 className="font-display text-sm font-bold tracking-[0.14em] text-ink-700 uppercase">
                {dict.channelsLabel}
              </h3>

              <ContactLink
                href={primary.href}
                channel={primary.key}
                locale={locale}
                placement="contact_section"
                {...(primary.external ? {} : { target: undefined, rel: undefined })}
                className={buttonClass("juice", "w-full justify-center sm:w-auto")}
              >
                {ctaLabel}
              </ContactLink>

              {/* Second, deliberately unfilled — and absent entirely while the
                  address is a placeholder (§7). */}
              {telegram && telegram.handle !== null ? (
                <ContactLink
                  href={telegram.profile ?? telegram.href}
                  channel={telegram.key}
                  locale={locale}
                  placement="contact_section"
                  className="group inline-flex min-h-11 items-center gap-2.5 text-base font-semibold text-cherry-900 underline decoration-cherry-900/25 underline-offset-4 transition-colors hover:text-juice-500 hover:decoration-juice-500"
                >
                  <TelegramMark className="size-5 shrink-0 text-juice-500" aria-hidden="true" />
                  <span dir="ltr">{telegram.handle}</span>
                </ContactLink>
              ) : null}

              {/* A portfolio link, not a rival action: no button, no border. */}
              {instagram && instagram.handle !== null ? (
                <ContactLink
                  href={instagram.profile ?? instagram.href}
                  channel={instagram.key}
                  locale={locale}
                  placement="contact_section"
                  className="inline-flex min-h-11 items-center gap-2.5 text-sm font-semibold text-ink-700 underline decoration-ink-500/30 underline-offset-4 transition-colors hover:text-juice-500 hover:decoration-juice-500"
                >
                  <InstagramMark className="size-4 shrink-0" aria-hidden="true" />
                  {/* Latin handle: pinned LTR so the "@" stays at its head
                      inside an RTL line. */}
                  <span dir="ltr">{instagram.handle}</span>
                </ContactLink>
              ) : null}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
