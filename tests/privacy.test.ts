import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { locales } from "../src/lib/i18n";
import { getDictionary } from "../src/dictionaries";
import { FILL_MARK, getPrivacy, privacyIndexable, privacyPath } from "../src/content/privacy";
import { generateMetadata } from "../src/app/[locale]/privacy/page";
import sitemap from "../src/app/sitemap";

/* Privacy and cookie policy (task 29.09.2026, item 4). Critical because the
   form collects personal data and ads will run in the EU: a policy that is
   indexed with «[ЗАПОЛНИТЬ: …]» in place of the controller's name is worse
   than none, and a form without the notice is a GDPR art. 13 gap. */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const metaFor = (locale: string) => generateMetadata({ params: Promise.resolve({ locale }) });

describe("a policy with a placeholder is never indexed", () => {
  it.each(locales)("%s: robots follow the placeholder switch", async (locale) => {
    const meta = await metaFor(locale);
    const indexable = privacyIndexable(locale);
    expect(meta.robots).toEqual({ index: indexable, follow: indexable });
    if (indexable) expect(JSON.stringify(getPrivacy(locale))).not.toContain(FILL_MARK);
  });

  it.each(locales)("%s: in the sitemap only when complete", (locale) => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith(privacyPath(locale)))).toBe(privacyIndexable(locale));
  });

  it("today every locale still has placeholders, so none is indexed", () => {
    for (const locale of locales) {
      expect(JSON.stringify(getPrivacy(locale))).toContain(FILL_MARK);
      expect(privacyIndexable(locale)).toBe(false);
    }
  });

  it("canonical is the policy's own path", async () => {
    for (const locale of locales) {
      expect((await metaFor(locale)).alternates?.canonical).toBe(privacyPath(locale));
    }
  });
});

describe("what the policy has to say", () => {
  it.each(locales)("%s: names recipients, authorities and the consent-only pixel", (locale) => {
    const text = JSON.stringify(getPrivacy(locale));
    for (const needle of ["Vercel", "Telegram", "Meta", "ANSPDCP", "dataprotection.ro", "gov.il", "_fbp"]) {
      expect(text).toContain(needle);
    }
  });

  it("every locale has the same sections, so no language loses a right", () => {
    const counts = locales.map((locale) => getPrivacy(locale).sections.length);
    expect(new Set(counts).size).toBe(1);
  });
});

describe("the notice under every form", () => {
  it("the form links to the policy of its own locale", () => {
    const src = read("../src/components/forms/AuditForm.tsx");
    expect(src).toContain("href={privacyPath(locale)}");
    expect(src).toContain("dict.privacyNote");
    expect(src).toContain("dict.privacyLink");
  });

  it("the form bundle does not pull in the policy texts", () => {
    const src = read("../src/components/forms/AuditForm.tsx");
    expect(src).not.toContain("@/content/privacy");
  });

  it.each(locales)("%s: notice, link and footer label are filled", (locale) => {
    const dict = getDictionary(locale);
    expect(dict.audit.form.privacyNote.length).toBeGreaterThan(10);
    expect(dict.audit.form.privacyLink.length).toBeGreaterThan(3);
    expect(dict.footer.privacy.length).toBeGreaterThan(3);
  });

  it("both footers link to the policy", () => {
    for (const file of ["../src/components/layout/Footer.tsx", "../src/components/landing/MarketLandingPage.tsx"]) {
      expect(read(file)).toContain("href={privacyPath(locale)}");
    }
  });
});
