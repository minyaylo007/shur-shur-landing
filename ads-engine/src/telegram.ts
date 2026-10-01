import { appendFileSync } from "node:fs";
import type { FetchLike } from "./meta/graph.ts";

/* Telegram Bot API behind one tiny interface, three implementations:
   HttpTelegram — the real bot (SHUR_OPS_BOT_TOKEN, long polling, no public URL);
   OutboxTelegram — dry mode: every outgoing call becomes a JSON line in a file;
   FakeTelegram — tests: records calls and feeds scripted updates.
   The token lives in the URL path, so no error message ever includes the URL. */

export interface TelegramApi {
  readonly mode: "live" | "dry" | "fake";
  call(method: string, params: Record<string, unknown>): Promise<unknown>;
}

export class TelegramError extends Error {}

export class HttpTelegram implements TelegramApi {
  readonly mode = "live" as const;
  private readonly token: string;
  private readonly fetchFn: FetchLike;
  constructor(token: string, fetchFn: FetchLike = fetch) {
    this.token = token;
    this.fetchFn = fetchFn;
  }

  async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    const timeoutMs = method === "getUpdates" ? 70_000 : 15_000;
    let res: Response;
    try {
      res = await this.fetchFn(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new TelegramError(`${method}: network ${error instanceof Error ? error.name : "error"}`);
    }
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string };
    if (!body.ok) throw new TelegramError(`${method}: ${res.status} ${body.description ?? ""}`.trim());
    return body.result;
  }
}

export class OutboxTelegram implements TelegramApi {
  readonly mode = "dry" as const;
  private readonly file: string;
  private nextId = 1;
  constructor(file: string) {
    this.file = file;
  }

  async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (method === "getUpdates") return [];
    appendFileSync(this.file, JSON.stringify({ at: new Date().toISOString(), method, ...params }) + "\n", {
      mode: 0o600,
    });
    return { message_id: this.nextId++ };
  }
}

export class FakeTelegram implements TelegramApi {
  readonly mode = "fake" as const;
  readonly calls: { method: string; params: Record<string, unknown> }[] = [];
  updates: unknown[] = [];
  private nextId = 100;

  async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ method, params });
    if (method === "getUpdates") {
      // Yield a macrotask, like a real long poll, so the loop never starves timers.
      await new Promise((r) => setImmediate(r));
      const out = this.updates;
      this.updates = [];
      return out;
    }
    if (method === "sendMessage") return { message_id: this.nextId++ };
    return true;
  }

  sent(method = "sendMessage") {
    return this.calls.filter((c) => c.method === method).map((c) => c.params);
  }
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export function keyboard(rows: InlineButton[][]) {
  return { inline_keyboard: rows };
}

/** Telegram caps a message at 4096 characters. */
export function chunks(text: string, size = 4000): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = rest.lastIndexOf("\n", size);
    const at = cut > size / 2 ? cut : size;
    out.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  out.push(rest);
  return out;
}
