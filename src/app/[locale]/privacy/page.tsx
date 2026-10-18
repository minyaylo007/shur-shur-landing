import type { Metadata } from "next";
import { Fragment } from "react";
import { isLocale, defaultLocale, locales, type Locale } from "@/lib/i18n";
import { site } from "@/lib/site";
import { getPrivacy, privacyIndexable, privacyPath, FILL_MARK } from "@/content/privacy";
import { Logo } from "@/components/ui/Logo";

function resolve(raw: string): Locale {
  return isLocale(raw) ? raw : defaultLocale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = resolve((await params).locale);
  const copy = getPrivacy(locale);
  const path = privacyPath(locale);
  /* The one switch (content/privacy → privacyIndexable): while any
     «[ЗАПОЛНИТЬ: …]» is left, the page is reachable from the form notice but
     never indexed. tests/privacy fails if that ever stops being true. */
  const indexable = privacyIndexable(locale);
  return {
    title: copy.meta.title,
    description: copy.meta.description,
    alternates: {
      canonical: path,
      languages: Object.fromEntries(locales.map((code) => [code, privacyPath(code)])),
    },
    openGraph: {
      type: "website",
      url: path,
      siteName: site.name,
      title: copy.meta.title,
      description: copy.meta.description,
      images: [{ url: "/og-card.jpg", width: 1200, height: 630 }],
    },
    robots: { index: indexable, follow: indexable },
  };
}

/* A placeholder is shown, not hidden: a highlighted «[ЗАПОЛНИТЬ: …]» on a
   noindex draft is honest; a blank where the controller's name should be is not. */
function Marked({ text }: { text: string }) {
  const parts = text.split(/(\[ЗАПОЛНИТЬ:[^\]]*\])/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith(FILL_MARK) ? (
          <mark key={i} className="rounded bg-juice-300/40 px-1 text-cherry-900">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolve((await params).locale);
  const copy = getPrivacy(locale);

  return (
    <>
      <header className="bg-cherry-black text-cream-type">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
          <a href={`/${locale}`} aria-label={copy.back} className="text-xl">
            <Logo className="text-paper-50" />
          </a>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="bg-paper-50 text-ink-900">
        <article className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
          <div className="flex flex-col gap-2">
            <h1 className="display-type text-3xl font-extrabold break-words text-cherry-900 md:text-4xl">
              {copy.heading}
            </h1>
            <p className="text-sm text-ink-500">{copy.updated}</p>
          </div>
          {copy.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold break-words text-cherry-900">
                {section.heading}
              </h2>
              {section.paragraphs.map((p) => (
                <p key={p} className="text-base leading-relaxed break-words text-ink-700">
                  <Marked text={p} />
                </p>
              ))}
              {section.items ? (
                <ul className="flex list-outside list-disc flex-col gap-2 ps-5 text-base leading-relaxed text-ink-700">
                  {section.items.map((item) => (
                    <li key={item} className="break-words">
                      <Marked text={item} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <a href={`/${locale}`} className="text-sm font-semibold text-cherry-900 underline underline-offset-4">
            {copy.back}
          </a>
        </article>
      </main>
    </>
  );
}
