import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { App } from "./app.ts";
import { HOST } from "./config.ts";
import { verify } from "./hmac.ts";
import { parseLead, ingestLead } from "./leads.ts";
import { isStopped } from "./safety.ts";
import { freshness } from "./meta/insights.ts";
import { log } from "./log.ts";

/* HTTP surface: POST /v1/leads (contract v1) and GET /healthz. Nothing else.
   The body is read raw (≤ 32 KiB) because the signature covers raw bytes. */

const MAX_BODY = 32 * 1024;

function send(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
}

function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        // Stop buffering but keep draining, so the client still reads our 413.
        req.removeAllListeners("data");
        req.resume();
        resolve(null);
        return;
      }
      parts.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", reject);
  });
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

export function handler(app: App, nowSeconds: () => number = () => Math.floor(Date.now() / 1000)) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const path = (req.url ?? "/").split("?")[0];
      if (req.method === "GET" && path === "/healthz") {
        const f = freshness(app.db, "meta");
        return send(res, 200, {
          ok: true,
          modes: app.modes,
          rules_mode: app.engine().mode,
          stopped: isStopped(app.config.dataDir).stopped,
          meta_data_age_hours: f.ageHours === null ? null : Math.round(f.ageHours * 10) / 10,
        });
      }
      if (path !== "/v1/leads") return send(res, 404, { ok: false, error: "not_found" });
      if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });
      if (!app.config.hmacSecret) {
        log("lead.rejected", { reason: "not_configured", missing: "LEDGER_HMAC_SECRET" });
        return send(res, 503, { ok: false, error: "not_configured" });
      }
      if (Number(header(req, "content-length") ?? 0) > MAX_BODY) {
        res.setHeader("connection", "close");
        return send(res, 413, { ok: false, error: "too_large" });
      }
      const raw = await readBody(req);
      if (raw === null) {
        res.setHeader("connection", "close");
        return send(res, 413, { ok: false, error: "too_large" });
      }

      const v = verify(app.config.hmacSecret, header(req, "x-shur-timestamp"), header(req, "x-shur-signature"), raw, nowSeconds());
      if (!v.ok) {
        log("lead.rejected", { reason: v.error });
        return send(res, 401, { ok: false, error: v.error });
      }
      let body: unknown;
      try {
        body = JSON.parse(raw.toString("utf8"));
      } catch {
        log("lead.rejected", { reason: "invalid_json" });
        return send(res, 400, { ok: false, error: "invalid_json" });
      }
      const parsed = parseLead(body);
      if (!parsed.ok) {
        log("lead.rejected", { reason: "invalid_input", field: parsed.field });
        return send(res, 400, { ok: false, error: "invalid_input", field: parsed.field });
      }
      const { result, created } = ingestLead(app.db, parsed.lead);
      log(created ? "lead.accepted" : "lead.replay", {
        lead_id: result.lead_id,
        market: result.market,
        kind: parsed.lead.kind,
        duplicate: result.duplicate,
        spam: result.spam,
        consent_ads: parsed.lead.consent.ads,
      });
      if (created) {
        // Best effort, after the answer: the ops chat must never slow the site down.
        setImmediate(() => {
          app.bot
            .notifyNewLead(parsed.lead, result)
            .catch((e) => log("bot.notify_failed", { lead_id: result.lead_id, error: String(e).slice(0, 200) }));
        });
      }
      return send(res, 200, result);
    } catch (error) {
      log("http.error", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
      if (!res.headersSent) send(res, 500, { ok: false, error: "internal" });
    }
  };
}

export function listen(app: App, port = app.config.port): Promise<Server> {
  const server = createServer(handler(app));
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => resolve(server));
  });
}
