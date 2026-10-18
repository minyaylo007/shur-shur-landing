import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketLandings, landingMetadata } from "@/lib/markets";
import { suceavaRo } from "@/content/landings/suceava.ro";
import { MarketLandingPage } from "@/components/landing/MarketLandingPage";

/* Only /ro/suceava exists: the other three locales 404 instead of showing
   Romanian copy under a Ukrainian or Hebrew <html lang>. */
const landing = marketLandings.suceava;

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: landing.locale }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== landing.locale) return {};
  return landingMetadata(landing, suceavaRo.meta);
}

export default async function SuceavaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== landing.locale) notFound();
  return <MarketLandingPage landing={landing} copy={suceavaRo} />;
}
