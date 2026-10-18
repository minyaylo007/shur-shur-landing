import type { LandingCopy } from "@/content/landings/types";
import type { MarketLanding } from "@/lib/markets";
import { workByIds } from "@/lib/markets";
import { privacyPath } from "@/lib/legal";
import { getDictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { Tile } from "@/components/sections/SelectedWork";
import { AuditForm } from "@/components/forms/AuditForm";
import { TapeDivider } from "@/components/ui/TapeDivider";
import { ConsentSettingsButton } from "@/components/consent/ConsentLayer";
import { buttonClass } from "@/components/ui/Button";
import { CherryIcon, PhoneIcon } from "@/components/ui/icons";

/**
 * One market landing (lib/markets): the page an ad points at.
 *
 * Deliberately NOT the home page with a different hero. It has no site menu
 * and no language switcher — a landing has no language siblings, and every
 * link away from it is a visitor lost before the form. What stays: the logo
 * (a way back to the whole site), the real cases of the hypothesis, the
 * free-audit form on the same /api/lead pipeline, and the policy link.
 *
 * The market of the lead is NOT passed by this page. It is read from the
 * landing path the visitor arrived on (lib/attribution → marketOf), exactly
 * as the contract says, so a lead from here and a lead from an ad that
 * pointed at the home page cannot be told apart by anything but that path.
 *
 * Direction comes from <html dir> set by the locale layout: on /he the page
 * lays out right to left through logical utilities (ps/pe, start/end) only.
 */
export function MarketLandingPage({
  landing,
  copy,
}: {
  landing: MarketLanding;
  copy: LandingCopy;
}) {
  const locale = landing.locale;
  const dict = getDictionary(locale);
  const { localPhone, price } = landing;

  return (
    <>
      <header className="bg-cherry-black text-cream-type">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6">
          <a href={`/${locale}`} aria-label={copy.footer.home} className="text-xl">
            <Logo className="text-paper-50" />
          </a>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {/* Hero: who, where, the one action. */}
        <section className="bg-cherry-black pt-10 pb-16 text-cream-type md:pt-16 md:pb-24">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 sm:px-6">
            <span className="rounded-full border-2 border-juice-300/60 px-3 py-1 font-display text-xs font-bold tracking-[0.18em] text-juice-300 uppercase">
              {copy.hero.kicker}
            </span>
            <h1 className="display-type max-w-4xl text-[clamp(2rem,7.5vw,4.6rem)] leading-[0.98] font-extrabold break-words hyphens-auto text-cream-type">
              {copy.hero.title}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-cream-type/85 md:text-lg">
              {copy.hero.sub}
            </p>
            <a href="#audit" className={buttonClass("juice", "w-full justify-center sm:w-auto")}>
              {copy.hero.cta}
            </a>
          </div>
        </section>

        <TapeDivider color="paper1" decor="cherry" />

        <div className="bg-paper-50 text-ink-900">
          {/* Who we are — only what is true (lib/markets). */}
          <section className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-16 sm:px-6 md:pt-20">
            <h2 className="display-type text-2xl font-extrabold break-words text-cherry-900 md:text-3xl">
              {copy.about.heading}
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-ink-700">{copy.about.text}</p>

            {/* Config, not copy: renders only once lib/markets has a real value. */}
            {localPhone || price ? (
              <div className="flex flex-col gap-2 text-base">
                {localPhone ? (
                  <a
                    href={`tel:${localPhone.e164}`}
                    className="inline-flex min-h-11 items-center gap-2 font-semibold text-cherry-900 underline underline-offset-4"
                  >
                    <PhoneIcon className="size-4 text-juice-500" aria-hidden="true" />
                    <span>{copy.whenConfigured.phoneLabel}</span>
                    <span dir="ltr">{localPhone.display}</span>
                  </a>
                ) : null}
                {price ? (
                  <p className="font-semibold text-cherry-900">
                    {copy.whenConfigured.priceFrom}{" "}
                    <span dir="ltr">
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency: price.currency,
                        maximumFractionDigits: 0,
                      }).format(price.from)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {copy.segments.map((segment) => {
            const items = workByIds(segment.work);
            return (
              <section
                key={segment.key}
                className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pt-16 sm:px-6 md:pt-20"
              >
                <SectionHeading
                  kicker={segment.kicker}
                  heading={segment.heading}
                  sub={segment.text}
                  tone="dark"
                />
                <ul className="flex flex-col gap-2 text-base text-ink-700">
                  {segment.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <CherryIcon className="mt-1 size-4 shrink-0 text-juice-500" />
                      <span className="min-w-0 break-words">{point}</span>
                    </li>
                  ))}
                </ul>
                {items.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                      {items.map((item, index) => (
                        <Tile key={item.id} item={item} locale={locale} index={index} />
                      ))}
                    </ul>
                    <p className="text-xs text-ink-500">
                      {segment.workNote} {dict.work.playLabel}
                    </p>
                  </div>
                ) : null}
              </section>
            );
          })}

          <section className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-16 sm:px-6 md:pt-20">
            <h2 className="display-type text-2xl font-extrabold break-words text-cherry-900 md:text-3xl">
              {copy.steps.heading}
            </h2>
            <ol className="flex list-inside list-decimal flex-col gap-2 text-base text-ink-700">
              {copy.steps.items.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          {/* The form: the same /api/lead pipeline as the home page. */}
          <section id="audit" className="scroll-mt-6 py-16 md:py-24">
            <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 sm:px-6">
              <SectionHeading
                kicker={copy.audit.kicker}
                heading={copy.audit.heading}
                sub={copy.audit.sub}
                tone="dark"
              />
              <Reveal>
                <div className="rounded-lg border-2 border-cherry-900/15 bg-paper-100 p-6 md:p-8">
                  <AuditForm
                    locale={locale}
                    dict={dict.audit.form}
                    delivery={dict.audit.delivery}
                    channelLabels={dict.contactBar.channels}
                    callLabel={dict.nav.callLabel}
                  />
                </div>
              </Reveal>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-cherry-black text-paper-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-10 text-xs text-paper-200/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <a href={`/${locale}`} className="underline underline-offset-4 hover:text-juice-300">
            {copy.footer.home}
          </a>
          <p>
            © {site.name}.{" "}
            <ConsentSettingsButton
              label={dict.consent.settings}
              className="cursor-pointer underline underline-offset-4 hover:text-juice-300"
            />
            {" · "}
            <a href={privacyPath(locale)} className="underline underline-offset-4 hover:text-juice-300">
              {dict.footer.privacy}
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
