import { z } from "zod";
import { cabinetStore } from "@/lib/cabinet/store";
import { readXlsx } from "./xlsx";

/**
 * A table uploaded for one client (.csv/.xlsx) — any columns. Server-only.
 * (A file with the quiz columns, and everything the bot pushes, goes to
 * lib/client/attempts instead.)
 *
 * The cells may hold personal data of the people the bot talked to. So the
 * table lives in its own private document, is rendered only inside that
 * client's cabinet, and NOTHING of its content goes to a log, a URL or an
 * error message — the code around it reports counts and error words only.
 */

export const resultsKey = (id: string) => `cabinet/clients/${id}-data.json`;

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const MAX_COLUMNS = 50;
export const MAX_CELL = 500;
/** What the page prints; the count and the per-day split cover every row. */
export const SHOWN_ROWS = 200;

const cell = z.string().max(MAX_CELL);
export const tableSchema = z.object({
  columns: z.array(cell).min(1).max(MAX_COLUMNS),
  rows: z.array(z.array(cell).max(MAX_COLUMNS)).max(MAX_ROWS),
});
const storedSchema = tableSchema.extend({ updatedAt: z.number(), source: z.enum(["upload", "ingest"]) });
export type Table = z.infer<typeof tableSchema>;
export type Results = z.infer<typeof storedSchema>;

export type ParseError = "empty" | "too_big" | "too_many_rows" | "bad_format";
export type Parsed = { ok: true; table: Table } | { ok: false; error: ParseError };

/* ---------- csv ---------- */

function delimiterOf(firstLine: string): string {
  let best = ",";
  let most = 0;
  for (const d of [",", ";", "\t"]) {
    const n = firstLine.split(d).length;
    if (n > most) [best, most] = [d, n];
  }
  return best;
}

/** RFC 4180 with a detected delimiter (comma, semicolon, tab) and quoted cells. */
export function parseCsv(text: string, maxRows: number): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = delimiterOf(source.slice(0, source.search(/\r|\n|$/)));
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  const endRow = () => {
    row.push(value);
    value = "";
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch !== '"') value += ch;
      else if (source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && value === "") quoted = true;
    else if (ch === delimiter) {
      row.push(value);
      value = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      endRow();
      if (rows.length > maxRows + 1) return rows;
    } else value += ch;
  }
  if (value !== "" || row.length > 0) endRow();
  return rows;
}

/* ---------- table ---------- */

const clip = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, MAX_CELL);

/** First row is the header. Short rows are padded, empty rows dropped. */
export function toTable(raw: string[][]): Parsed {
  const rows = raw.map((r) => r.slice(0, MAX_COLUMNS).map(clip)).filter((r) => r.some((c) => c !== ""));
  if (rows.length === 0) return { ok: false, error: "empty" };
  if (rows.length - 1 > MAX_ROWS) return { ok: false, error: "too_many_rows" };
  const width = Math.max(...rows.map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => rows[0][i] || `${i + 1}`);
  const body = rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  return { ok: true, table: { columns, rows: body } };
}

export function parseUpload(filename: string, bytes: Buffer): Parsed {
  if (bytes.length === 0) return { ok: false, error: "empty" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "too_big" };
  const zip = bytes.length > 4 && bytes.readUInt32LE(0) === 0x04034b50;
  if (zip || /\.xlsx$/i.test(filename)) {
    try {
      return toTable(readXlsx(bytes, MAX_ROWS + 1, MAX_COLUMNS));
    } catch {
      // Not a workbook, or zlib refusing a broken or oversized entry.
      return { ok: false, error: "bad_format" };
    }
  }
  if (bytes.includes(0)) return { ok: false, error: "bad_format" };
  return toTable(parseCsv(bytes.toString("utf8"), MAX_ROWS + 1));
}

/* ---------- per-day split ---------- */

const pad = (n: number | string) => String(n).padStart(2, "0");

/** «2026-11-18…», «18.11.2026…», «18/11/2026…» → «2026-11-18»; anything else → null. */
export function dayOf(value: string): string | null {
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?![\d])/.exec(value);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?![\d])/.exec(value))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export interface DaySplit {
  column: string;
  days: { day: string; count: number }[];
}

/** The first column where at least 80 % of the filled cells read as a date. */
export function splitByDay(table: Table): DaySplit | null {
  for (let c = 0; c < table.columns.length; c++) {
    const counts = new Map<string, number>();
    let filled = 0;
    let dated = 0;
    for (const row of table.rows) {
      const value = row[c] ?? "";
      if (value === "") continue;
      filled++;
      const day = dayOf(value);
      if (!day) continue;
      dated++;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    if (dated === 0 || dated < filled * 0.8) continue;
    const days = [...counts].map(([day, count]) => ({ day, count })).sort((a, b) => (a.day < b.day ? 1 : -1));
    return { column: table.columns[c], days };
  }
  return null;
}

/* ---------- store ---------- */

export async function readResults(id: string): Promise<Results | null> {
  const stored = await cabinetStore().read(resultsKey(id));
  if (!stored) return null;
  const parsed = storedSchema.safeParse(JSON.parse(stored.text));
  return parsed.success ? parsed.data : null;
}

export async function saveResults(id: string, table: Table, source: Results["source"], nowMs = Date.now()): Promise<void> {
  const document: Results = { ...table, updatedAt: nowMs, source };
  await cabinetStore().write(resultsKey(id), JSON.stringify(document));
}
