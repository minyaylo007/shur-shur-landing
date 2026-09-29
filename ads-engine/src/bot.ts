import type { Db } from "./db.ts";
import { kvGet, kvSet, kvDelete } from "./db.ts";
import type { IngestResult, LeadInput } from "./leads.ts";
import {
  setStatus,
  FunnelError,
  STAGES,
  LOST_REASONS,
  STATUS_LABELS,
  stageIndex,
  type Status,
  type LostReason,
} from "./funnel.ts";
import type { TelegramApi, InlineButton } from "./telegram.ts";
import { keyboard, chunks } from "./telegram.ts";
import { decide, type EngineContext, type Proposal } from "./rules.ts";
import { setStop, clearStop, isStopped } from "./safety.ts";
import { log } from "./log.ts";

/* The ops bot: a SEPARATE service bot, not the one that delivers leads.
   It knows a lead by id, market, kind and source — never by name or contact
   (those are in the main lead chat). Only updates from SHUR_OPS_CHAT_ID are
   obeyed; anything else is ignored and logged by chat id only.

   Callback data (≤ 64 bytes):
     s:<lead_id>:<status>      move a lead (won asks for the amount, lost for a reason)
     l:<lead_id>:<reason>      lost with a reason
     a:<action_id>:y|n         approve / reject a rules-engine action */

export const MARKET_LABEL: Record<string, string> = {
  suceava: "🇷🇴 Сучава",
  tel_aviv: "🇮🇱 Тель-Авив",
  other: "🌍 другое",
};

export interface BotDeps {
  db: Db;
  api: TelegramApi;
  chatId: string;
  dataDir: string;
  engine: () => EngineContext;
  /** Called after every successful status change (Conversions API hook). */
  onTransition?: (leadId: string, to: Status) => Promise<unknown>;
  /** /report command. */
  report?: () => Promise<string>;
}

function short(id: string) {
  return id.slice(0, 8);
}

export function leadButtons(leadId: string, status: Status): InlineButton[][] {
  if (status === "won" || status === "lost") {
    return [[{ text: "↺ открыть снова", callback_data: `s:${leadId}:contacted` }]];
  }
  const next = STAGES.filter((s) => stageIndex(s) > stageIndex(status)).map((s) => ({
    text: STATUS_LABELS[s],
    callback_data: `s:${leadId}:${s}`,
  }));
  return [next, [{ text: "✖ отказ", callback_data: `s:${leadId}:lost` }]];
}

function reasonButtons(leadId: string): InlineButton[][] {
  const entries = Object.entries(LOST_REASONS);
  const rows: InlineButton[][] = [];
  for (let i = 0; i < entries.length; i += 3) {
    rows.push(entries.slice(i, i + 3).map(([code, label]) => ({ text: label, callback_data: `l:${leadId}:${code}` })));
  }
  return rows;
}

export function leadCard(lead: Pick<LeadInput, "lead_id" | "market" | "kind" | "locale" | "attribution">, result: IngestResult): string {
  const a = lead.attribution;
  const source = [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(" / ") || (a.referrer_host ? `переход с ${a.referrer_host}` : "прямой / органика");
  const marks = [result.duplicate ? "⚠ повтор контакта за 30 дн." : "", result.spam ? "🚫 похоже на спам" : ""].filter(Boolean);
  return [
    `🆕 Заявка ${short(lead.lead_id)} · ${MARKET_LABEL[lead.market] ?? lead.market} · ${lead.kind} · ${lead.locale ?? "—"}`,
    `Источник: ${source}`,
    ...marks,
    `Статус: ${STATUS_LABELS[result.status as Status] ?? result.status}`,
  ].join("\n");
}

export class OpsBot {
  private readonly d: BotDeps;
  constructor(deps: BotDeps) {
    this.d = deps;
  }

  private send(text: string, extra: Record<string, unknown> = {}) {
    return this.d.api.call("sendMessage", { chat_id: this.d.chatId, text, ...extra }) as Promise<{ message_id: number }>;
  }

  async notifyNewLead(lead: LeadInput, result: IngestResult): Promise<void> {
    await this.send(leadCard(lead, result), { reply_markup: keyboard(leadButtons(lead.lead_id, result.status as Status)) });
  }

  async requestApproval(actionId: number, p: Proposal): Promise<void> {
    await this.send(
      [
        `🛠 Предлагаю изменение #${actionId} · ${MARKET_LABEL[p.market] ?? p.market}`,
        `${p.level} «${p.objectName}»: дневной бюджет ${p.fromDaily} → ${p.toDaily} ${p.currency}`,
        `Причина: ${p.reason}`,
        "Исполнитель — симулятор: в Meta ничего не уйдёт.",
      ].join("\n"),
      {
        reply_markup: keyboard([
          [
            { text: "✅ выполнить", callback_data: `a:${actionId}:y` },
            { text: "✖ отклонить", callback_data: `a:${actionId}:n` },
          ],
        ]),
      },
    );
  }

  async sendText(text: string): Promise<void> {
    for (const part of chunks(text)) await this.send(part);
  }

  private async transition(leadId: string, to: Status, actor: string, extra: { reason?: LostReason; amount?: number; currency?: string } = {}) {
    const t = setStatus(this.d.db, leadId, { to, actor, ...extra });
    log("funnel.transition", { lead_id: leadId, from: t.from, to: t.to, actor });
    if (this.d.onTransition) {
      this.d.onTransition(leadId, to).catch((e) => log("funnel.hook_failed", { lead_id: leadId, error: String(e).slice(0, 200) }));
    }
    return t;
  }

  /** One Telegram update. Returns a short outcome for tests and logs. */
  async handleUpdate(update: Record<string, unknown>): Promise<string> {
    const cq = update.callback_query as
      | { id: string; data?: string; from?: { id: number; username?: string }; message?: { message_id: number; chat: { id: number }; text?: string } }
      | undefined;
    const msg = update.message as
      | { message_id: number; chat: { id: number }; text?: string; from?: { id: number; username?: string }; reply_to_message?: { message_id: number } }
      | undefined;
    const chat = String(cq?.message?.chat.id ?? msg?.chat.id ?? "");
    if (chat !== this.d.chatId) {
      log("bot.foreign_chat", { chat_id: chat });
      if (cq) await this.d.api.call("answerCallbackQuery", { callback_query_id: cq.id });
      return "ignored";
    }
    const actor = `tg:${cq?.from?.id ?? msg?.from?.id ?? "?"}`;
    if (cq) return this.onCallback(cq, actor);
    if (msg?.text) return this.onMessage(msg as Required<Pick<typeof msg, "text">> & typeof msg, actor);
    return "noop";
  }

  private async onCallback(
    cq: { id: string; data?: string; message?: { message_id: number; text?: string } },
    actor: string,
  ): Promise<string> {
    const [kind, id, arg] = (cq.data ?? "").split(":");
    const answer = (text: string) => this.d.api.call("answerCallbackQuery", { callback_query_id: cq.id, text });
    const edit = (text: string, rows?: InlineButton[][]) =>
      cq.message
        ? this.d.api.call("editMessageText", {
            chat_id: this.d.chatId,
            message_id: cq.message.message_id,
            text,
            ...(rows ? { reply_markup: keyboard(rows) } : {}),
          })
        : Promise.resolve();
    const base = (cq.message?.text ?? "").replace(/\nСтатус: .*$/s, "");
    try {
      if (kind === "s" && arg === "lost") {
        await edit(`${base}\nСтатус: выберите причину отказа`, reasonButtons(id));
        await answer("Причина?");
        return "ask_reason";
      }
      if (kind === "s" && arg === "won") {
        const m = await this.send(`💰 Сделка ${short(id)}: ответьте на это сообщение суммой и валютой, например «1500 EUR».`, {
          reply_markup: { force_reply: true, selective: true },
        });
        kvSet(this.d.db, `won:${m.message_id}`, JSON.stringify({ leadId: id, card: cq.message?.message_id ?? null, base }));
        await answer("Жду сумму");
        return "ask_amount";
      }
      if (kind === "s") {
        const t = await this.transition(id, arg as Status, actor);
        await edit(`${base}\nСтатус: ${STATUS_LABELS[t.to]}`, leadButtons(id, t.to));
        await answer(STATUS_LABELS[t.to]);
        return `status:${t.to}`;
      }
      if (kind === "l") {
        const t = await this.transition(id, "lost", actor, { reason: arg as LostReason });
        await edit(`${base}\nСтатус: отказ — ${LOST_REASONS[arg as LostReason]}`, leadButtons(id, t.to));
        await answer("Отказ записан");
        return `status:lost:${arg}`;
      }
      if (kind === "a") {
        const r = await decide(this.d.engine(), Number(id), arg === "y" ? "approve" : "reject", actor);
        await edit(`${cq.message?.text ?? ""}\n→ ${r.status}: ${r.note}`);
        await answer(r.note.slice(0, 190));
        return `action:${r.status}`;
      }
      await answer("?");
      return "unknown";
    } catch (error) {
      const text = error instanceof FunnelError ? error.message : "ошибка";
      await answer(text.slice(0, 190));
      return `error:${error instanceof FunnelError ? error.code : "internal"}`;
    }
  }

  private async onMessage(
    msg: { text: string; reply_to_message?: { message_id: number } },
    actor: string,
  ): Promise<string> {
    const text = msg.text.trim();
    if (msg.reply_to_message) {
      const key = `won:${msg.reply_to_message.message_id}`;
      const pending = kvGet(this.d.db, key);
      if (pending) {
        const { leadId, card, base } = JSON.parse(pending) as { leadId: string; card: number | null; base: string };
        const m = text.replace(",", ".").match(/^(\d+(?:\.\d{1,2})?)\s*([A-Za-z]{3})$/);
        if (!m) {
          await this.send("Не понял сумму. Формат: «1500 EUR». Ответьте ещё раз на сообщение о сделке.");
          return "bad_amount";
        }
        try {
          await this.transition(leadId, "won", actor, { amount: Number(m[1]), currency: m[2].toUpperCase() });
        } catch (error) {
          await this.send(error instanceof FunnelError ? error.message : "ошибка");
          return "error";
        }
        kvDelete(this.d.db, key);
        if (card) {
          await this.d.api.call("editMessageText", {
            chat_id: this.d.chatId,
            message_id: card,
            text: `${base}\nСтатус: сделка — ${m[1]} ${m[2].toUpperCase()}`,
            reply_markup: keyboard(leadButtons(leadId, "won")),
          });
        }
        await this.send(`✅ Сделка ${short(leadId)} записана: ${m[1]} ${m[2].toUpperCase()}`);
        return "status:won";
      }
    }
    if (text.startsWith("/stop")) {
      setStop(this.d.dataDir, text.slice(5).trim() || "команда /stop", actor);
      log("safety.stop", { by: actor });
      await this.send("⛔ Аварийная остановка включена. Правила ничего не выполняют. Снять: /resume");
      return "stopped";
    }
    if (text.startsWith("/resume")) {
      const was = clearStop(this.d.dataDir);
      log("safety.resume", { by: actor, was_stopped: was });
      await this.send(was ? "▶ Остановка снята." : "Остановки не было.");
      return "resumed";
    }
    if (text.startsWith("/status")) {
      const s = isStopped(this.d.dataDir);
      await this.send(s.stopped ? `⛔ Остановлено: ${s.reason}` : "▶ Работает. Режим правил: " + this.d.engine().mode);
      return "status";
    }
    if (text.startsWith("/report") && this.d.report) {
      await this.sendText(await this.d.report());
      return "report";
    }
    return "noop";
  }

  /** Long polling. Offset is persisted, so a restart does not replay button presses. */
  async poll(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const offset = Number(kvGet(this.d.db, "tg_offset") ?? 0);
        const updates = (await this.d.api.call("getUpdates", {
          offset,
          timeout: 50,
          allowed_updates: ["message", "callback_query"],
        })) as { update_id: number }[];
        for (const u of updates) {
          kvSet(this.d.db, "tg_offset", String(u.update_id + 1));
          await this.handleUpdate(u as unknown as Record<string, unknown>);
        }
      } catch (error) {
        log("bot.poll_error", { error: String(error instanceof Error ? error.message : error).slice(0, 200) });
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
}
