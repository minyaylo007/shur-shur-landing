import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { addAttempts, attemptSchema, fromWire, type Attempt } from "./attempts";
import { parseCsv } from "./results";

/**
 * A client's bot that writes into a Google Sheet instead of pushing to
 * /api/client/ingest (Marina's, owner 26.11.2026). Server-only.
 *
 * The sheet is public («anyone with the link»), so the site reads it without
 * a login through gviz as CSV, turns every row into an attempt of the SAME
 * strict schema the ingest uses and stores it the same way (addAttempts). The
 * cabinet and the .csv then work as for a pushing bot, and a row deleted from
 * the sheet stays on the site.
 *
 * The sheet holds personal data — «telegram id», «username», «ім'я». They do
 * not go past `attemptsFromSheet`: the name and the username are never read,
 * the telegram id only into an HMAC (the attempt's id and the opaque
 * `participant`). Nothing of a row is ever logged — counts and HTTP codes only.
 */

export const sheetSchema = z.object({
  /** The spreadsheet id from its URL (docs.google.com/spreadsheets/d/<id>/…). */
  id: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
  /** The sheet (tab) name, «Відповіді» for Marina's bot. */
  name: z.string().trim().min(1).max(100),
});
export type Sheet = z.infer<typeof sheetSchema>;

/** A read is reused this long — the cabinet may be opened often, the bot writes rarely. */
export const SHEET_CACHE_MS = 5 * 60 * 1000;
/** A failed read is retried after this — not on every page view (each waits up to the timeout). */
export const SHEET_RETRY_MS = 60 * 1000;
export const SHEET_TIMEOUT_MS = 5000;
const MAX_ROWS = 5000;

export const sheetUrl = (sheet: Sheet) =>
  `https://docs.google.com/spreadsheets/d/${sheet.id}/gviz/tq?${new URLSearchParams({ tqx: "out:csv", sheet: sheet.name, headers: "1" })}`;

/* ---------- a row → an attempt ---------- */

const norm = (header: string) => header.trim().toLowerCase().replace(/\s+/g, " ");

/** «2026-11-12 20:18:38» on a Kyiv wall clock → the same moment as ISO with its offset («…+02:00»). */
export function kyivIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s = "00"] = m.slice(1);
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (!Number.isFinite(wall)) return null;
  // The offset Kyiv has at that moment (+2 in winter, +3 in summer); checked twice around a switch.
  const offsetAt = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(ms);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - ms;
  };
  let offset = offsetAt(wall);
  offset = offsetAt(wall - offset);
  const minutes = Math.round(offset / 60000);
  const sign = minutes < 0 ? "-" : "+";
  const hh = String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0");
  const mm = String(Math.abs(minutes) % 60).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${hh}:${mm}`;
}

function hasher(): ((text: string) => string) | null {
  const secret = process.env.CABINET_HMAC_SECRET;
  if (!secret) return null;
  const key = createHash("sha256").update(`client-sheet:${secret}`).digest();
  return (text) => createHmac("sha256", key).update(text).digest("base64url").slice(0, 32);
}

const number = (raw: string | undefined) => {
  const text = (raw ?? "").trim().replace(",", ".");
  const value = text === "" ? NaN : Number(text);
  return Number.isFinite(value) ? value : null;
};

/**
 * The bot's sheet (header row first) → attempts. Null: the columns are not
 * the bot's (no «час (Київ)», «тест» or «бали») or no server secret to hash
 * with. A row that does not make a valid attempt is skipped.
 */
export function attemptsFromSheet(rows: string[][]): Attempt[] | null {
  const hash = hasher();
  if (!hash || rows.length === 0) return null;
  const names = rows[0].map(norm);
  const col = (name: string) => names.indexOf(name);
  const at = { time: col("час (київ)"), tg: col("telegram id"), test: col("тест"), score: col("бали"), max: col("максимум"), range: col("результат (діапазон)") };
  if (at.time < 0 || at.test < 0 || at.score < 0) return null;
  const answers = names.flatMap((name, i) => {
    const m = /^відповідь (\d{1,3})$/.exec(name);
    return m ? [{ i, q: `Питання ${Number(m[1])}` }] : [];
  });
  const cell = (row: string[], i: number) => (i < 0 ? "" : (row[i] ?? "").trim());

  const out: Attempt[] = [];
  for (const row of rows.slice(1)) {
    const time = cell(row, at.time);
    const tg = cell(row, at.tg);
    const test = cell(row, at.test);
    const finished = kyivIso(time);
    const score = number(cell(row, at.score));
    if (!finished || !test || score === null) continue;
    const wire = {
      attempt_id: `sheet-${hash(`${time}|${tg}|${test}`)}`,
      test: test.slice(0, 120),
      score,
      max_score: number(cell(row, at.max)),
      range_label: cell(row, at.range).slice(0, 300) || null,
      finished_at: finished,
      answers: answers.flatMap(({ i, q }) => (cell(row, i) === "" ? [] : [{ q, a: cell(row, i).slice(0, 500) }])),
      participant: tg ? hash(`participant|${tg}`) : null,
    };
    const parsed = attemptSchema.safeParse(wire);
    if (parsed.success) out.push(fromWire(parsed.data));
  }
  return out;
}

/* ---------- read and store ---------- */

type Outcome = "ok" | "unavailable";
const recent = new Map<string, { at: number; outcome: Outcome }>();

/** Tests only: forget the cached reads. */
export function forgetSheetReads(): void {
  recent.clear();
}

/**
 * Reads the client's sheet (at most once in SHEET_CACHE_MS) and stores the
 * attempts not stored yet. Never throws: «unavailable» means the cabinet shows
 * what is already stored, with a quiet line. `force` skips the cache.
 */
export async function syncSheet(clientId: string, sheet: Sheet, { force = false, nowMs = Date.now() } = {}): Promise<{ outcome: Outcome; stored: number; rows: number }> {
  const key = `${clientId}:${sheet.id}:${sheet.name}`;
  const last = recent.get(key);
  if (!force && last && nowMs - last.at < (last.outcome === "ok" ? SHEET_CACHE_MS : SHEET_RETRY_MS)) return { outcome: last.outcome, stored: 0, rows: 0 };
  const done = (outcome: Outcome, stored = 0, rows = 0) => {
    recent.set(key, { at: nowMs, outcome });
    return { outcome, stored, rows };
  };
  let text: string;
  try {
    const response = await fetch(sheetUrl(sheet), { signal: AbortSignal.timeout(SHEET_TIMEOUT_MS), cache: "no-store", redirect: "follow" });
    if (!response.ok) {
      console.error(`[client] sheet read failed: HTTP ${response.status}`);
      return done("unavailable");
    }
    text = await response.text();
  } catch (error) {
    console.error(`[client] sheet read failed: ${error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network"}`);
    return done("unavailable");
  }
  // A sheet that is no longer public answers 200 with Google's login page, not CSV.
  if (/^\s*</.test(text)) {
    console.error("[client] sheet read failed: not csv (sheet not public?)");
    return done("unavailable");
  }
  const attempts = attemptsFromSheet(parseCsv(text, MAX_ROWS));
  if (!attempts) {
    console.error("[client] sheet read failed: columns not recognised");
    return done("unavailable");
  }
  try {
    const { stored } = await addAttempts(clientId, attempts.slice(-MAX_ROWS), nowMs);
    if (stored > 0) console.info(`[client] sheet attempts stored: ${stored} new of ${attempts.length}`);
    return done("ok", stored, attempts.length);
  } catch {
    console.error("[client] sheet read failed: store");
    return done("unavailable");
  }
}
