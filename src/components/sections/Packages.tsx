import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { business, type PackageKey } from "@/lib/business";
import { primaryAction } from "@/lib/channels";
import { ContactLink } from "@/components/conversion/ContactLink";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

interface PackagesProps {
  locale: Locale;
  dict: Dictionary["packages"];
  /** services.items — the bullets of the first three are the packages'. */
  services: Dictionary["services"]["items"];
}

const ORDER: PackageKey[] = ["shoot", "social", "ads"];

/**
 * Packages (redesign v4, brief B1.3), in place of the four service cards.
 *
 * Three ways in, with the bullets the services section already had. The
 * «від» price comes from lib/business and is drawn only when it is there;
 * until Sasha names it, every card asks for the price in the messenger —
 * through the same primary action as the rest of the page, so it is a quiet
 * link here and not a second filled button.
 */
export function Packages({ locale, dict, services }: PackagesProps) {
  const primary = primaryAction(locale);
  return (
    <section id="packages" tabIndex={-1} className="scroll-mt-20 bg-paper-50 py-16 text-ink-900 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} tone="dark" />
        <ul className="grid gap-5 md:grid-cols-3">
          {ORDER.map((key, index) => {
            const price = business.prices[key];
            return (
              <Reveal as="li" key={key} delay={index * 0.06}>
                <article className="flex h-full flex-col gap-5 rounded-2xl border-2 border-cherry-900/10 bg-paper-100 p-6">
                  <h3 className="font-display text-lg font-bold text-cherry-900 uppercase">{dict.names[key]}</h3>
                  {price !== null ? (
                    <p className="font-display text-2xl font-extrabold text-juice-500">
                      {dict.from} {price[locale]}
                    </p>
                  ) : null}
                  <ul className="flex flex-1 flex-col gap-2 text-sm leading-relaxed text-ink-700">
                    {services[index].points.map((point) => (
                      <li key={point}>— {point}</li>
                    ))}
                  </ul>
                  <ContactLink
                    href={primary.href}
                    channel={primary.key}
                    locale={locale}
                    placement="packages"
                    {...(primary.external ? {} : { target: undefined, rel: undefined })}
                    className="inline-flex min-h-11 cursor-pointer items-center self-start rounded-full border-2 border-cherry-900 px-5 font-display text-xs font-bold tracking-wide text-cherry-900 uppercase transition-colors hover:bg-cherry-900 hover:text-paper-50"
                  >
                    {dict.ask}
                  </ContactLink>
                </article>
              </Reveal>
            );
          })}
        </ul>
        <p className="text-sm text-ink-500">{dict.extra}</p>
      </div>
    </section>
  );
}
