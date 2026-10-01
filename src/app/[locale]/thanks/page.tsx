import type { Metadata } from "next";
import Link from "next/link";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/dictionaries";
import { thanksPath } from "@/lib/thanks";
import { Logo } from "@/components/ui/Logo";
import { CherryIcon } from "@/components/ui/icons";
import { ThanksLead } from "@/components/thanks/ThanksLead";

type PageParams = { params: Promise<{ locale: string }> };

/**
 * The thank-you page: where an ACCEPTED audit form lands (lib/thanks).
 * Not indexed, not in the sitemap, not in any menu — it is a step of the
 * form, not a page of the site. The address has no query by design; the
 * lead id arrives through sessionStorage and leaves no trace in the URL.
 */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dict = getDictionary(locale);
  return {
    title: dict.thanks.metaTitle,
    robots: { index: false, follow: false },
    // Replaces the layout's hreflang map: nothing here is to be found by search.
    alternates: { canonical: thanksPath(locale) },
  };
}

export default async function ThanksPage({ params }: PageParams) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dict = getDictionary(locale);
  const form = dict.audit.form;

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-10 px-6 py-16 sm:px-10"
    >
      <Link href={`/${locale}`} className="w-fit text-2xl text-cherry-900 hover:opacity-80">
        <Logo />
      </Link>
      <div role="status" className="flex items-start gap-4">
        <CherryIcon className="size-10 shrink-0 text-juice-500" />
        <div className="flex flex-col gap-3">
          <h1 className="display-type text-3xl font-black text-cherry-900 sm:text-5xl">{form.successTitle}</h1>
          <p className="max-w-xl leading-relaxed text-ink-700 sm:text-lg">{form.successText}</p>
        </div>
      </div>
      <Link
        href={`/${locale}`}
        className="w-fit rounded-full bg-juice-500 px-7 py-3 font-display text-sm font-bold tracking-wide text-paper-50 uppercase hover:bg-cherry-700"
      >
        {dict.thanks.home}
      </Link>
      <ThanksLead />
    </main>
  );
}
