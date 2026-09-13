import { describe, it, expect } from "vitest";
import { leadSchema, isSpam, MIN_ELAPSED_MS } from "../src/lib/validation";
import { locales } from "../src/lib/i18n";

const valid = {
  name: "Олександра",
  contact: "@shur_client",
  message: "Хочу співпрацю",
  extra_field: "",
  elapsedMs: 12000,
};

describe("leadSchema", () => {
  it("accepts a valid payload", () => {
    const result = leadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("trims whitespace around name and contact", () => {
    const result = leadSchema.safeParse({ ...valid, name: "  Ірина  ", contact: " ira@example.com " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Ірина");
      expect(result.data.contact).toBe("ira@example.com");
    }
  });

  it("rejects name shorter than 2 chars after trim", () => {
    expect(leadSchema.safeParse({ ...valid, name: " І " }).success).toBe(false);
  });

  it("rejects name longer than 100 chars", () => {
    expect(leadSchema.safeParse({ ...valid, name: "а".repeat(101) }).success).toBe(false);
  });

  it("rejects contact shorter than 3 chars", () => {
    expect(leadSchema.safeParse({ ...valid, contact: "ab" }).success).toBe(false);
  });

  it("rejects message longer than 1000 chars", () => {
    expect(leadSchema.safeParse({ ...valid, message: "м".repeat(1001) }).success).toBe(false);
  });

  it("allows message to be omitted", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.message;
    expect(leadSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects non-numeric elapsedMs", () => {
    expect(leadSchema.safeParse({ ...valid, elapsedMs: "fast" }).success).toBe(false);
  });

  it("still parses when honeypot is filled (spam handled separately, no 400 leak)", () => {
    expect(leadSchema.safeParse({ ...valid, extra_field: "Bot Inc" }).success).toBe(true);
  });

  it("accepts every supported locale (uk/en/he/ro)", () => {
    // Driven by lib/i18n, so a new locale is accepted without touching this test.
    for (const locale of locales) {
      expect(leadSchema.safeParse({ ...valid, locale }).success).toBe(true);
    }
    expect([...locales]).toEqual(["uk", "en", "he", "ro"]);
  });

  it("allows locale to be omitted", () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unsupported locales", () => {
    expect(leadSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });
});

describe("leadSchema — audit requests (kind + igHandle + contact)", () => {
  /* Redesign v2, brief §20: the audit asks for the Instagram nickname AND a
     Telegram handle or phone number, and BOTH are required. v1 collected the
     nickname alone, so a request arrived with no channel to send the review
     back through. The tests below that asserted a handle-only payload was
     valid were rewritten for that rule rather than deleted. */
  const audit = {
    kind: "audit" as const,
    igHandle: "@shur.shur.agency",
    contact: "@shur_client",
    extra_field: "",
    elapsedMs: 9000,
    locale: "uk" as const,
  };

  it('defaults kind to "lead" for classic payloads', () => {
    const result = leadSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("lead");
    }
  });

  it("audit: accepts handle + contact, with no name or message", () => {
    const result = leadSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.igHandle).toBe("@shur.shur.agency");
      expect(result.data.contact).toBe("@shur_client");
    }
  });

  it("audit: rejects when igHandle is missing", () => {
    const rest: Partial<typeof audit> = { ...audit };
    delete rest.igHandle;
    expect(leadSchema.safeParse(rest).success).toBe(false);
  });

  it("audit: rejects when contact is missing — nowhere to send the review", () => {
    const rest: Partial<typeof audit> = { ...audit };
    delete rest.contact;
    const result = leadSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.contact).toBeDefined();
    }
  });

  it("audit: accepts a phone number as the contact, not only a handle", () => {
    expect(leadSchema.safeParse({ ...audit, contact: "+380 97 249 91 07" }).success).toBe(true);
  });

  it("audit: the contact field keeps the shared length rules", () => {
    expect(leadSchema.safeParse({ ...audit, contact: "ab" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...audit, contact: "a".repeat(101) }).success).toBe(false);
  });

  it("audit: trims whitespace and accepts handles without the @", () => {
    const result = leadSchema.safeParse({ ...audit, igHandle: "  shur_shur  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.igHandle).toBe("shur_shur");
    }
  });

  it("audit: rejects handles shorter than 2 chars", () => {
    expect(leadSchema.safeParse({ ...audit, igHandle: "a" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...audit, igHandle: "@a" }).success).toBe(false);
  });

  it("audit: rejects handles longer than 60 chars", () => {
    expect(leadSchema.safeParse({ ...audit, igHandle: "a".repeat(61) }).success).toBe(false);
    expect(leadSchema.safeParse({ ...audit, igHandle: `@${"a".repeat(60)}` }).success).toBe(true);
  });

  it("audit: rejects handles with characters Instagram never allows", () => {
    for (const bad of ["bad handle", "<script>", "ім'я", "x@y"]) {
      expect(leadSchema.safeParse({ ...audit, igHandle: bad }).success).toBe(false);
    }
  });

  it("lead: still requires name and contact (audit rules must not leak)", () => {
    expect(leadSchema.safeParse({ kind: "lead", extra_field: "", elapsedMs: 9000 }).success).toBe(false);
    expect(leadSchema.safeParse({ extra_field: "", elapsedMs: 9000 }).success).toBe(false);
  });

  it("lead: does NOT require igHandle, but tolerates one", () => {
    expect(leadSchema.safeParse({ ...valid, igHandle: "@some_brand" }).success).toBe(true);
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(leadSchema.safeParse({ ...valid, kind: "quiz" }).success).toBe(false);
  });
});

describe("isSpam — per-kind elapsed thresholds (REM-FIX-C4)", () => {
  const lead = { ...valid, kind: "lead" as const };

  it("exposes per-kind thresholds: lead 3000ms, audit 1200ms", () => {
    expect(MIN_ELAPSED_MS.lead).toBe(3000);
    expect(MIN_ELAPSED_MS.audit).toBe(1200);
  });

  it("flags filled honeypot regardless of kind", () => {
    expect(isSpam({ ...lead, extra_field: "Bot Inc" })).toBe(true);
    expect(isSpam({ kind: "audit", extra_field: "Bot Inc", elapsedMs: 9000 })).toBe(true);
  });

  it("treats an omitted honeypot as empty (schema default)", () => {
    const result = leadSchema.safeParse({ name: "Ірина", contact: "ira@example.com", elapsedMs: 9000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(isSpam(result.data)).toBe(false);
    }
  });

  it("lead: flags submissions faster than 3000ms (threshold unchanged)", () => {
    expect(isSpam({ ...lead, elapsedMs: 800 })).toBe(true);
    expect(isSpam({ ...lead, elapsedMs: 2000 })).toBe(true);
  });

  it("audit: the short form keeps the lower 1200ms floor — a 1.5s submit is legit", () => {
    expect(isSpam({ kind: "audit", extra_field: "", elapsedMs: 1500 })).toBe(false);
    expect(isSpam({ kind: "audit", extra_field: "", elapsedMs: 1200 })).toBe(false);
  });

  it("audit: still flags sub-1200ms submissions", () => {
    expect(isSpam({ kind: "audit", extra_field: "", elapsedMs: 800 })).toBe(true);
  });

  it("passes legit submissions of both kinds", () => {
    expect(isSpam(lead)).toBe(false);
    expect(isSpam({ kind: "audit", extra_field: "", elapsedMs: 9000 })).toBe(false);
  });
});
