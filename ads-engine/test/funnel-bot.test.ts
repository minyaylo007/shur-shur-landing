import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { ingestLead, parseLead, type LeadInput } from "../src/leads.ts";
import { setStatus, resolveLeadId, FunnelError } from "../src/funnel.ts";
import { stopFile } from "../src/safety.ts";
import { testApp, leadBody, CHAT } from "./helpers.ts";
import type { App } from "../src/app.ts";

/* Воронка и служебный бот на поддельном клиенте Telegram: кнопки двигают
   статус, отказ требует причину, сделка — сумму и валюту, чужой чат не
   слушается, /stop ставит файл-флаг. */

function addLead(app: App, over: Record<string, unknown> = {}): LeadInput {
  const p = parseLead(leadBody(over));
  if (!p.ok) throw new Error(p.field);
  ingestLead(app.db, p.lead);
  return p.lead;
}

function cb(data: string, chat = CHAT, messageId = 7, text = "🆕 Заявка\nСтатус: новая") {
  return { update_id: 1, callback_query: { id: "cq1", data, from: { id: 42 }, message: { message_id: messageId, chat: { id: Number(chat) }, text } } };
}

function status(app: App, id: string) {
  return app.db.prepare("SELECT status, max_stage, lost_reason, deal_amount, deal_currency FROM leads WHERE lead_id = ?").get(id) as {
    status: string;
    max_stage: number;
    lost_reason: string | null;
    deal_amount: number | null;
    deal_currency: string | null;
  };
}

describe("funnel", () => {
  it("moves forward, jumps allowed, never backwards; max_stage remembers the furthest stage", () => {
    const app = testApp();
    const { lead_id } = addLead(app);
    setStatus(app.db, lead_id, { to: "qualified", actor: "t" });
    expect(() => setStatus(app.db, lead_id, { to: "contacted", actor: "t" })).toThrow(/cannot move/);
    setStatus(app.db, lead_id, { to: "lost", actor: "t", reason: "too_expensive" });
    expect(status(app, lead_id)).toMatchObject({ status: "lost", max_stage: 2, lost_reason: "too_expensive" });
  });

  it("lost needs a dictionary reason; won needs a positive amount and an ISO currency", () => {
    const app = testApp();
    const { lead_id } = addLead(app);
    expect(() => setStatus(app.db, lead_id, { to: "lost", actor: "t" })).toThrow(FunnelError);
    expect(() => setStatus(app.db, lead_id, { to: "lost", actor: "t", reason: "meh" as never })).toThrow(/reason/);
    expect(() => setStatus(app.db, lead_id, { to: "won", actor: "t", amount: 0, currency: "EUR" })).toThrow(/amount/);
    expect(() => setStatus(app.db, lead_id, { to: "won", actor: "t", amount: 100, currency: "euro" })).toThrow(/currency/);
    setStatus(app.db, lead_id, { to: "won", actor: "t", amount: 1500, currency: "RON" });
    expect(status(app, lead_id)).toMatchObject({ status: "won", max_stage: 4, deal_amount: 1500, deal_currency: "RON" });
    expect(() => setStatus(app.db, lead_id, { to: "proposal", actor: "t" })).toThrow(/reopen/);
    setStatus(app.db, lead_id, { to: "contacted", actor: "t" }); // reopen
    expect(status(app, lead_id).status).toBe("contacted");
    const events = app.db.prepare("SELECT COUNT(*) AS n FROM lead_events WHERE lead_id = ?").get(lead_id) as { n: number };
    expect(events.n).toBe(3); // ingest + won + reopen
  });

  it("resolves an 8-character prefix, refuses shorter ones", () => {
    const app = testApp();
    const { lead_id } = addLead(app);
    expect(resolveLeadId(app.db, lead_id.slice(0, 8))).toBe(lead_id);
    expect(() => resolveLeadId(app.db, lead_id.slice(0, 5))).toThrow(/8/);
  });
});

describe("ops bot (fake Telegram)", () => {
  it("posts a card with buttons and no personal data", async () => {
    const app = testApp();
    const lead = addLead(app, { name: "Mihai Cardtest", contact: "mihai.card@example.org" });
    await app.bot.notifyNewLead(lead, { ok: true, lead_id: lead.lead_id, market: "suceava", status: "new", duplicate: false, spam: false });
    const [msg] = app.tg.sent();
    expect(msg.chat_id).toBe(CHAT);
    expect(msg.text).toContain(lead.lead_id.slice(0, 8));
    expect(msg.text).toContain("Сучава");
    expect(JSON.stringify(msg)).not.toMatch(/Mihai|Cardtest|mihai\.card/);
    const buttons = (msg.reply_markup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard.flat();
    expect(buttons.map((b) => b.callback_data)).toContain(`s:${lead.lead_id}:qualified`);
    expect(buttons.every((b) => Buffer.byteLength(b.callback_data) <= 64)).toBe(true);
  });

  it("button → status; lost asks for a reason first", async () => {
    const app = testApp();
    const { lead_id } = addLead(app);
    expect(await app.bot.handleUpdate(cb(`s:${lead_id}:qualified`))).toBe("status:qualified");
    expect(status(app, lead_id).status).toBe("qualified");
    expect(await app.bot.handleUpdate(cb(`s:${lead_id}:lost`))).toBe("ask_reason");
    expect(status(app, lead_id).status).toBe("qualified");
    expect(await app.bot.handleUpdate(cb(`l:${lead_id}:chose_other`))).toBe("status:lost:chose_other");
    expect(status(app, lead_id)).toMatchObject({ status: "lost", lost_reason: "chose_other" });
    const actor = app.db.prepare("SELECT actor FROM lead_events WHERE lead_id = ? ORDER BY id DESC LIMIT 1").get(lead_id) as { actor: string };
    expect(actor.actor).toBe("tg:42");
  });

  it("won asks for the amount as a reply and records it", async () => {
    const app = testApp();
    const { lead_id } = addLead(app);
    expect(await app.bot.handleUpdate(cb(`s:${lead_id}:won`))).toBe("ask_amount");
    const prompt = app.tg.calls.filter((c) => c.method === "sendMessage").at(-1)!;
    expect(prompt.params.reply_markup).toMatchObject({ force_reply: true });
    const promptId = 100; // FakeTelegram numbers messages from 100
    const reply = (text: string) => ({ update_id: 2, message: { message_id: 9, chat: { id: Number(CHAT) }, from: { id: 42 }, text, reply_to_message: { message_id: promptId } } });
    expect(await app.bot.handleUpdate(reply("a lot"))).toBe("bad_amount");
    expect(await app.bot.handleUpdate(reply("2500,50 eur"))).toBe("status:won");
    expect(status(app, lead_id)).toMatchObject({ status: "won", deal_amount: 2500.5, deal_currency: "EUR" });
  });

  it("ignores every other chat", async () => {
    const app = testApp();
    const { lead_id } = addLead(app);
    expect(await app.bot.handleUpdate(cb(`s:${lead_id}:qualified`, "-999"))).toBe("ignored");
    expect(status(app, lead_id).status).toBe("new");
  });

  it("/stop and /resume toggle the file flag", async () => {
    const app = testApp();
    const msg = (text: string) => ({ update_id: 3, message: { message_id: 1, chat: { id: Number(CHAT) }, from: { id: 42 }, text } });
    expect(await app.bot.handleUpdate(msg("/stop бюджет горит"))).toBe("stopped");
    expect(existsSync(stopFile(app.config.dataDir))).toBe(true);
    expect(await app.bot.handleUpdate(msg("/resume"))).toBe("resumed");
    expect(existsSync(stopFile(app.config.dataDir))).toBe(false);
  });

  it("long polling persists the offset so a restart does not replay presses", async () => {
    const app = testApp();
    const { lead_id } = addLead(app);
    app.tg.updates = [{ ...cb(`s:${lead_id}:contacted`), update_id: 555 }];
    const ac = new AbortController();
    const p = app.bot.poll(ac.signal);
    await new Promise((r) => setTimeout(r, 20));
    ac.abort();
    await p;
    expect(status(app, lead_id).status).toBe("contacted");
    const polls = app.tg.calls.filter((c) => c.method === "getUpdates");
    expect(polls.at(-1)!.params.offset).toBe(556);
  });
});
