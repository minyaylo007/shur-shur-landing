import { isLocale, defaultLocale, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { Cases } from "@/components/sections/Cases";
import { Packages } from "@/components/sections/Packages";
import { HowWeWork } from "@/components/sections/HowWeWork";
import { Team, Reviews } from "@/components/sections/TeamAndReviews";
import { Faq } from "@/components/sections/Faq";
import { AuditCta } from "@/components/sections/AuditCta";
import { TapeDivider } from "@/components/ui/TapeDivider";
import { ContactBar } from "@/components/conversion/ContactBar";

/**
 * Redesign v2 information architecture (brief §4).
 *
 * v1 ran thirteen blocks — hero, marquee, pain, services, cases, numbers,
 * about, team, socials, contact, plus a FAB, a sticky bar and a cursor
 * companion. The problem the brief names is cognitive overload, not the
 * visual language, so this is a consolidation, not a repaint:
 *
 *   hero            → hero, minus the audit form and the stats strip
 *   marquee + pain  → removed (both told; the work now shows)
 *   —               → SELECTED WORK, moved directly under the hero (§7)
 *   —               → PROCESS → RESULT, the backstage/final pair (§8)
 *   services        → kept, flattened from a pinned scroll track to cards
 *   cases + numbers → removed: unverified figures (§16, see Trust.tsx)
 *   about + team + wall of love → TRUST, one compact proof section (§17–18)
 *   socials         → folded into SELECTED WORK's "stories" cluster
 *   contact         → AUDIT + CONTACT, one conversion destination (§19–20)
 *   FAB + sticky CTA → ContactBar, one control instead of five (§19)
 *   cherry cursor   → removed (§14: no excessive cursor effects)
 *
 * Redesign v4 (brief B1, 04.11.2026) — 332 ad visits gave one lead, so the
 * page now answers a buyer's questions in the order they ask them:
 *
 *   hero            → showreel, a headline per market, one proof line
 *   —               → CASES: niche + what we made, from the archive (B1.2)
 *   selected work   → kept, now the «all work» behind the cases
 *   process+services → PACKAGES: three ways in, price slot (B1.3)
 *   trust           → its two facts became the hero's proof line; the rest
 *                     is HOW WE WORK WITH YOUR CITY (B1.4)
 *   —               → TEAM, REVIEWS: slots, render only with real data
 *   —               → FAQ for a foreign client (B1.7)
 *   audit + contact → unchanged; footer gets email/requisites slots
 *
 * Scroll rhythm: one dark chapter (hero + work), a torn edge into the cream
 * body (process, services, trust, audit), a torn edge back into the dark
 * footer. Two boundaries instead of seven — the tape was becoming wallpaper.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dict = getDictionary(locale);
  /* People on the team · countries already worked in — the two of the three
     self-reported facts that speak to a buyer; «7 directions» is the
     packages section itself. */
  const [people, , countries] = dict.trust.facts;
  const proof = `${people.value} ${people.label} · ${countries.value} ${countries.label}`;

  return (
    <>
      <Header locale={locale} nav={dict.nav} langSwitcher={dict.langSwitcher} />
      {/* tabIndex={-1}: the skip-link must be able to MOVE focus here (WCAG 2.4.1). */}
      <main id="main" tabIndex={-1} className="scroll-mt-20">
        <Hero locale={locale} dict={dict.hero} proof={proof} />
        <Cases locale={locale} dict={dict.cases} />
        <SelectedWork locale={locale} dict={dict.work} />
        <TapeDivider color="paper1" decor="cherry" />
        <Packages locale={locale} dict={dict.packages} services={dict.services.items} />
        <HowWeWork dict={dict.how} />
        <Team locale={locale} dict={dict.team} />
        <Reviews dict={dict.reviews} />
        <Faq dict={dict.faq} />
        {/* `ctaLabel` is v3: the one primary action is worded identically in
            the header, the hero and here. `channelLabels`/`callLabel` are
            production's: the form's failure state needs names for the
            channels and the phone it offers when a lead does not send. */}
        <AuditCta
          locale={locale}
          dict={dict.audit}
          ctaLabel={dict.nav.cta}
          channelLabels={dict.contactBar.channels}
          callLabel={dict.nav.callLabel}
        />
      </main>
      <TapeDivider color="black" decor="clip" flip />
      <Footer
        locale={locale}
        nav={dict.nav}
        footer={dict.footer}
        consentSettings={dict.consent.settings}
      />
      {/* Brief §19: ONE persistent contact control, scroll-gated past the
          hero so it never covers the hero's own CTA. z-40, under the header. */}
      <ContactBar locale={locale} dict={dict.contactBar} />
    </>
  );
}
