import { isLocale, defaultLocale, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Marquee } from "@/components/sections/Marquee";
import { Pain } from "@/components/sections/Pain";
import { Services } from "@/components/sections/Services";
import { Cases } from "@/components/sections/Cases";
import { Numbers } from "@/components/sections/Numbers";
import { About } from "@/components/sections/About";
import { Team } from "@/components/sections/Team";
import { Socials } from "@/components/sections/Socials";
import { Contact } from "@/components/sections/Contact";
import { TapeDivider } from "@/components/ui/TapeDivider";
import { CherryCursor } from "@/components/motion/CherryCursor";
import { MessengerFab } from "@/components/conversion/MessengerFab";
import { StickyCta } from "@/components/conversion/StickyCta";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <>
      <Header locale={locale} nav={dict.nav} langSwitcher={dict.langSwitcher} />
      {/* tabIndex={-1}: the skip-link must be able to MOVE focus here (WCAG 2.4.1). */}
      {/* Section rhythm (brief §2, cycle 3): dark hero → cream services →
          photographic dark cases + deep numbers (one dark "proof" chapter) →
          cream about/team breath → photographic dark socials → juice CTA →
          near-black footer. Torn edges stitch every dark↔cream transition;
          collage decor overlaps the boundary in two places. */}
      <main id="main" tabIndex={-1} className="scroll-mt-20">
        <Hero locale={locale} dict={dict.hero} marquee={dict.marquee} />
        <Marquee dict={dict.marquee} />
        {/* Pain block (cycle 4, brief §7): same dark field as the hero —
            one chapter visually, the torn edge below still does the flip. */}
        <Pain dict={dict.pain} />
        <TapeDivider color="paper" decor="cherry" />
        <Services dict={dict.services} />
        <TapeDivider color="deep" flip />
        <Cases dict={dict.cases} />
        <Numbers dict={dict.numbers} />
        <TapeDivider color="paper" />
        <About dict={dict.about} />
        <TapeDivider color="paper2" />
        <Team dict={dict.team} />
        <TapeDivider color="deep" decor="clip" />
        <Socials locale={locale} dict={dict.socials} />
        <TapeDivider color="cherry" />
        <Contact locale={locale} dict={dict.contact} />
      </main>
      <Footer nav={dict.nav} footer={dict.footer} />
      {/* Cycle-4 conversion layer (brief §7): messenger FAB + mobile sticky
          CTA — both scroll-gated past the hero, z-40 (under header/grain). */}
      <MessengerFab locale={locale} dict={dict.fab} />
      <StickyCta dict={dict.stickyCta} />
      {/* Trailing cherry cursor companion — desktop fine pointers only. */}
      <CherryCursor />
    </>
  );
}
