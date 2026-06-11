import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { escapeHtml, formatLeadMessage, sendLeadToTelegram } from "../src/lib/telegram";

describe("escapeHtml", () => {
  it("escapes & < > for Telegram HTML parse_mode", () => {
    expect(escapeHtml('<b onclick="x">R&D</b>')).toBe('&lt;b onclick="x"&gt;R&amp;D&lt;/b&gt;');
  });

  it("escapes & first so entities are not double-broken", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});

describe("formatLeadMessage — cycle 4 (kind)", () => {
  it("lead: keeps the classic header with name + contact", () => {
    const msg = formatLeadMessage({ kind: "lead", name: "Ірина", contact: "@ira", locale: "uk" });
    expect(msg).toContain("Нова заявка з сайту SHUR-SHUR");
    expect(msg).toContain("Ірина");
    expect(msg).toContain("@ira");
  });

  it("defaults to the lead format when kind is omitted (back-compat)", () => {
    const msg = formatLeadMessage({ name: "Test", contact: "@t", locale: "uk" });
    expect(msg).toContain("Нова заявка з сайту SHUR-SHUR");
  });

  it("audit: labels the request type and normalizes the handle to a single @", () => {
    const msg = formatLeadMessage({ kind: "audit", igHandle: "shur.shur.agency", locale: "uk" });
    expect(msg).toContain("Запит на аудит IG");
    expect(msg).toContain("@shur.shur.agency");
    expect(msg).not.toContain("@@");
    const withAt = formatLeadMessage({ kind: "audit", igHandle: "@shur.shur.agency", locale: "en" });
    expect(withAt).toContain("@shur.shur.agency");
    expect(withAt).not.toContain("@@");
  });

  it("audit: HTML-escapes the handle (defense in depth below the schema regex)", () => {
    const msg = formatLeadMessage({ kind: "audit", igHandle: "<b>&x", locale: "uk" });
    expect(msg).toContain("&lt;b&gt;&amp;x");
  });
});

describe("sendLeadToTelegram", () => {
  beforeEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("throws when TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are missing", async () => {
    await expect(
      sendLeadToTelegram({ name: "Test", contact: "@t", message: "", locale: "uk" }),
    ).rejects.toThrow(/TELEGRAM/);
  });
});
