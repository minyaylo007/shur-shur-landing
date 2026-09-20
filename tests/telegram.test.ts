import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  escapeHtml,
  formatLeadMessage,
  sendLeadToTelegram,
  TelegramNotConfiguredError,
} from "../src/lib/telegram";

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

  /* «Never configured» is not «Telegram is down»: one is an outage nobody on
     this side can fix, the other is a deployment setting. The API route logs
     them differently, which it can only do if they are different types. */
  it("missing credentials throw TelegramNotConfiguredError, naming both vars", async () => {
    const error = await sendLeadToTelegram({ kind: "audit", igHandle: "@x", locale: "uk" }).catch(
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(TelegramNotConfiguredError);
    expect((error as TelegramNotConfiguredError).missing).toEqual([
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_CHAT_ID",
    ]);
  });

  it("names only the variable that is actually missing", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token-not-real";
    const error = await sendLeadToTelegram({ kind: "audit", igHandle: "@x", locale: "uk" }).catch(
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(TelegramNotConfiguredError);
    expect((error as TelegramNotConfiguredError).missing).toEqual(["TELEGRAM_CHAT_ID"]);
  });

  it("the message carries variable NAMES, never a value or a prefix of one", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "1234567:super-secret-value";
    process.env.TELEGRAM_CHAT_ID = "";
    const error = (await sendLeadToTelegram({ kind: "audit", igHandle: "@x", locale: "uk" }).catch(
      (thrown: unknown) => thrown,
    )) as Error;
    expect(error.message).toContain("TELEGRAM_CHAT_ID");
    expect(error.message).not.toContain("1234567");
    expect(error.message).not.toContain("super-secret-value");
  });
});
