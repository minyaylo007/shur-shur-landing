import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketLandings, landingMetadata } from "@/lib/markets";
import { telAvivHe } from "@/content/landings/tel-aviv.he";
import { MarketLandingPage } from "@/components/landing/MarketLandingPage";

/* Only /he/tel-aviv exists — right to left through the locale layout. */
const landing = marketLandings.tel_aviv;

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
  return landingMetadata(landing, telAvivHe.meta);
}

export default async function TelAvivPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== landing.locale) notFound();
  return <MarketLandingPage landing={landing} copy={telAvivHe} />;
}
