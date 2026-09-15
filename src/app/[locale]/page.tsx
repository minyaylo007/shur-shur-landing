import { isLocale, defaultLocale, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { SelectedWork } from "@/components/sections/SelectedWork";
import { ProcessResult } from "@/components/sections/ProcessResult";
import { Services } from "@/components/sections/Services";
import { Trust } from "@/components/sections/Trust";
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
 * Scroll rhythm: one dark chapter (hero + work), a torn edge into the cream
 * body (process, services, trust, audit), a torn edge back into the dark
 * footer. Two boundaries instead of seven — the tape was becoming wallpaper.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <>
      <Header locale={locale} nav={dict.nav} langSwitcher={dict.langSwitcher} />
      {/* tabIndex={-1}: the skip-link must be able to MOVE focus here (WCAG 2.4.1). */}
      <main id="main" tabIndex={-1} className="scroll-mt-20">
        <Hero locale={locale} dict={dict.hero} />
        <SelectedWork locale={locale} dict={dict.work} />
        <TapeDivider color="paper1" decor="cherry" />
        <ProcessResult locale={locale} dict={dict.process} />
        <Services dict={dict.services} />
        <Trust dict={dict.trust} />
        <AuditCta locale={locale} dict={dict.audit} ctaLabel={dict.nav.cta} />
      </main>
      <TapeDivider color="black" decor="clip" flip />
      <Footer locale={locale} nav={dict.nav} footer={dict.footer} />
      {/* Brief §19: ONE persistent contact control, scroll-gated past the
          hero so it never covers the hero's own CTA. z-40, under the header. */}
      <ContactBar locale={locale} dict={dict.contactBar} />
    </>
  );
}
