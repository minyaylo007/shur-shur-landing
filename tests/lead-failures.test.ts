import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { uk } from "../src/dictionaries/uk";
import { en } from "../src/dictionaries/en";
import { he } from "../src/dictionaries/he";
import { ro } from "../src/dictionaries/ro";
import { locales } from "../src/lib/i18n";
import { getDictionary } from "../src/dictionaries";
import { LEAD_FAILURES, failureOf, type LeadFailure } from "../src/lib/lead-failure";

/*
 * The form must tell four different failures apart — DERIVED FROM THE ROUTE.
 *
 * `/api/lead` has always answered four things: 429 `rate_limited`, 400
 * `invalid_json`, 400 `invalid_input`, 502 `delivery_failed`. The form read
 * `response.ok` alone and printed one sentence for all four — «Не
 * надіслалося. Спробуйте ще раз…» — which is false after a 429 (the previous
 * five requests arrived) and a dead end after `invalid_input` (the same
 * payload will be rejected identically, forever).
 *
 * A test that listed the four cases by hand would only guard the four
 * somebody remembered to type. So the list is READ OUT OF THE ROUTE: every
 * `error` value the route can answer with has to have its own state in
 * `lib/lead-failure`, its own copy in all four dictionaries, and copy that no
 * other state shares. Add a fifth code to the route and this file fails and
 * names it.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const routeSrc = read("../src/app/api/lead/route.ts");
const formSrc = read("../src/components/forms/AuditForm.tsx");

/**
 * Comments stripped before scanning, so a code merely DISCUSSED in a comment
 * is not mistaken for one the route can answer with. Quote-aware: the file is
 * full of `https://`, and a naive cut at `//` would slice URLs in half.
 * (tests/conversion.test.ts keeps its own copy for the same reason — a shared
 * helper would have to live in a non-test module of its own.)
 */
function stripComments(src: string): string {
  let out = "";
  let quote: string | null = null;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (quote !== null) {
      if (ch === "\\") { out += ch + (next ?? ""); i += 2; continue; }
      if (ch === quote) quote = null;
      out += ch; i += 1; continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; out += ch; i += 1; continue; }
    if (ch === "/" && next === "/") { while (i < src.length && src[i] !== "\n") i += 1; continue; }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2; continue;
    }
    out += ch; i += 1;
  }
  return out;
}

const routeCode = stripComments(routeSrc);

/** Every `error: "…"` the route hands back, in source order. */
const routeErrors = [...routeCode.matchAll(/\berror:\s*"([a-z_]+)"/g)].map((m) => m[1]);

/** Every failure state the form knows, minus the ones the route never sends. */
const clientOnly: LeadFailure[] = ["network", "unknown"];
const serverFailures = (Object.keys(LEAD_FAILURES) as LeadFailure[]).filter(
  (key) => LEAD_FAILURES[key].fromServer,
);

const CYRILLIC = /[Ѐ-ӿ]/;
const HEBREW = /[֐-׿]/;

describe("the scan of the route is honest", () => {
  it("finds an error code for every failing answer the route writes", () => {
    // If the scanner ever silently matched nothing, every assertion below
    // would pass vacuously. Every `ok: false` body carries exactly one code.
    const failingAnswers = routeCode.match(/ok:\s*false/g) ?? [];
    expect(routeErrors.length).toBe(failingAnswers.length);
    expect(routeErrors.length).toBeGreaterThanOrEqual(4);
    expect(new Set(routeErrors).size).toBe(routeErrors.length);
  });
});

describe("every failure the route can answer with is a state of its own", () => {
  it("the route's codes and the form's server states are the SAME set", () => {
    // Both directions on purpose: a new code in the route must appear here,
    // and a state left behind by a deleted code must not linger with copy
    // nobody can ever see.
    expect([...routeErrors].sort()).toEqual([...serverFailures].sort());
  });

  it.each(routeErrors)("%s is recognised and kept apart from the rest", (code) => {
    // The body names the cause, so the status is irrelevant to this mapping.
    expect(failureOf(0, code)).toBe(code);
  });

  it("an unfamiliar code degrades to «unknown», never to a wrong-but-specific one", () => {
    expect(failureOf(400, "quota_exceeded")).toBe("unknown");
    expect(failureOf(418, undefined)).toBe("unknown");
    // No body at all: only what HTTP itself defines is read off the status.
    expect(failureOf(429, null)).toBe("rate_limited");
    expect(failureOf(502, null)).toBe("delivery_failed");
    expect(failureOf(400, null)).toBe("unknown");
  });

  it("the form actually asks — it reads the code and the status, not just ok", () => {
    expect(formSrc).toContain("failureOf(response.status, data?.error)");
    expect(formSrc).toContain("dict.failures[failure]");
    expect(formSrc).toContain("LEAD_FAILURES[failure]");
  });
});

describe("every state has its own copy, in all four languages", () => {
  const states = Object.keys(LEAD_FAILURES) as LeadFailure[];

  it("no state is missing from any dictionary, and none is a stub", () => {
    for (const locale of locales) {
      const failures = getDictionary(locale).audit.form.failures;
      expect(Object.keys(failures).sort()).toEqual([...states].sort());
      for (const state of states) {
        expect(failures[state].title.trim().length, `${locale}.${state}.title`).toBeGreaterThan(5);
        expect(failures[state].text.trim().length, `${locale}.${state}.text`).toBeGreaterThan(40);
      }
    }
  });

  it("no two states say the same thing — «distinguishes» must be real", () => {
    for (const locale of locales) {
      const failures = getDictionary(locale).audit.form.failures;
      const titles = states.map((state) => failures[state].title);
      const texts = states.map((state) => failures[state].text);
      expect(new Set(titles).size, `${locale}: duplicate titles`).toBe(states.length);
      expect(new Set(texts).size, `${locale}: duplicate texts`).toBe(states.length);
    }
  });

  it("each language writes in its own script — no English left in uk or he", () => {
    for (const state of states) {
      expect(uk.audit.form.failures[state].title, `uk.${state}`).toMatch(CYRILLIC);
      expect(uk.audit.form.failures[state].text, `uk.${state}`).toMatch(CYRILLIC);
      expect(he.audit.form.failures[state].title, `he.${state}`).toMatch(HEBREW);
      expect(he.audit.form.failures[state].text, `he.${state}`).toMatch(HEBREW);
      for (const dict of [en, ro]) {
        expect(dict.audit.form.failures[state].title, `${state}`).not.toMatch(CYRILLIC);
        expect(dict.audit.form.failures[state].text, `${state}`).not.toMatch(CYRILLIC);
      }
    }
  });

  it("copy that ends in a colon is followed by channels, and only that copy", () => {
    // «…або напишіть нам напряму:» with nothing under it is exactly the dead
    // end PR #11 removed. A promise of a channel and the channels themselves
    // are now the same decision.
    for (const locale of locales) {
      const failures = getDictionary(locale).audit.form.failures;
      for (const state of states) {
        expect(failures[state].text.trim().endsWith(":"), `${locale}.${state}`).toBe(
          LEAD_FAILURES[state].channels,
        );
      }
    }
  });
});

describe("the advice each state gives is the advice that can work", () => {
  it("429 offers no «try again» — the next ten minutes are refused anyway", () => {
    expect(LEAD_FAILURES.rate_limited.retry).toBe("none");
    expect(LEAD_FAILURES.rate_limited.channels).toBe(true);
    // The wait named in the copy is the window the limiter actually enforces.
    const limiter = read("../src/lib/rate-limit.ts");
    const minutes = Number(limiter.match(/const WINDOW_MS = (\d+) \* 60 \* 1000/)?.[1]);
    expect(minutes).toBeGreaterThan(0);
    for (const locale of locales) {
      expect(
        getDictionary(locale).audit.form.failures.rate_limited.text,
        `${locale}: the wait must match WINDOW_MS`,
      ).toContain(String(minutes));
    }
  });

  it("400 invalid_input sends the visitor back to a field, not into a loop", () => {
    expect(LEAD_FAILURES.invalid_input.retry).toBe("edit");
    expect(LEAD_FAILURES.invalid_input.focusField).toBe(true);
    expect(formSrc).toContain("if (LEAD_FAILURES[kind].focusField)");
    expect(formSrc).toContain("igRef.current?.focus()");
  });

  it("502 makes the direct channel the main exit and the retry a footnote", () => {
    expect(LEAD_FAILURES.delivery_failed.retry).toBe("secondary");
    expect(LEAD_FAILURES.delivery_failed.channels).toBe(true);
  });

  it("a dropped connection is the one case where «try again» is honest", () => {
    expect(clientOnly).toContain("network");
    expect(LEAD_FAILURES.network.retry).toBe("primary");
    expect(LEAD_FAILURES.network.fromServer).toBe(false);
    expect(formSrc).toContain('setFailure("network")');
  });

  it("the a11y of the error state is unchanged: one alert, focus into the field", () => {
    expect(formSrc).toContain('role="alert"');
    expect(formSrc).toMatch(/\(errors\.igHandle \? igRef : contactRef\)\.current\?\.focus\(\)/);
    expect(formSrc).toContain("aria-invalid");
  });

  it("the channels come only through the readiness gate — no bare messenger link", () => {
    expect(formSrc).toContain("localeChannels(locale)");
    expect(formSrc).not.toContain("t.me/");
    expect(formSrc).not.toContain("site.socials");
  });
});
