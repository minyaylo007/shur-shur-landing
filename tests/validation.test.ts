import { describe, it, expect } from "vitest";
import { leadSchema, isSpam, MIN_ELAPSED_MS } from "../src/lib/validation";

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

  it("accepts supported locales (uk/en)", () => {
    expect(leadSchema.safeParse({ ...valid, locale: "uk" }).success).toBe(true);
    expect(leadSchema.safeParse({ ...valid, locale: "en" }).success).toBe(true);
  });

  it("allows locale to be omitted", () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unsupported locales", () => {
    expect(leadSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(false);
  });
});

describe("leadSchema — cycle 4 (kind + igHandle)", () => {
  const audit = {
    kind: "audit" as const,
    igHandle: "@shur.shur.agency",
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

  it("audit: accepts a handle-only payload (no name/contact)", () => {
    const result = leadSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.igHandle).toBe("@shur.shur.agency");
    }
  });

  it("audit: rejects when igHandle is missing", () => {
    const rest: Partial<typeof audit> = { ...audit };
    delete rest.igHandle;
    expect(leadSchema.safeParse(rest).success).toBe(false);
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

  it("lead: still requires name and contact (audit relaxation must not leak)", () => {
    expect(leadSchema.safeParse({ kind: "lead", extra_field: "", elapsedMs: 9000 }).success).toBe(false);
    expect(leadSchema.safeParse({ extra_field: "", elapsedMs: 9000 }).success).toBe(false);
  });

  it("lead: tolerates an optional igHandle alongside the classic fields", () => {
    expect(leadSchema.safeParse({ ...valid, igHandle: "@some_brand" }).success).toBe(true);
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

  it("audit: one-field form uses the lower 1200ms floor — a 1.5s submit is legit", () => {
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
