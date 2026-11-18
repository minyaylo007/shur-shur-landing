import { createHash } from "node:crypto";
import { z } from "zod";
import { cabinetStore, StoreConflictError } from "@/lib/cabinet/store";
import type { Table } from "./results";

/**
 * Quiz attempts pushed by a client's bot (/api/client/ingest) — what the
 * cabinet turns into statistics. Server-only. Wire format: docs/client-ingest.md.
 *
 * NO personal data by construction: the schema is strict (an unknown field —
 * a name, a username, a telegram id — refuses the whole batch) and the only
 * thing that tells two people apart is `participant`, an opaque hash the bot
 * makes itself. Even so, answers are free text: nothing of an attempt is ever
 * logged — counts only.
 */

export const attemptsKey = (id: string) => `cabinet/clients/${id}-attempts.json`;

export const MAX_BATCH = 500;
/** The newest this many are kept; older ones fall off. */
export const MAX_ATTEMPTS = 5000;

const answerSchema = z.strictObject({
  q: z.string().min(1).max(500),
  a: z.string().max(500),
  points: z.number().finite().nullable().optional(),
});

export const attemptSchema = z.strictObject({
  attempt_id: z.string().min(1).max(100),
  test: z.string().min(1).max(120),
  score: z.number().finite(),
  max_score: z.number().finite().nullable().optional(),
  range_label: z.string().max(300).nullable().optional(),
  finished_at: z.string().max(40).refine((value) => Number.isFinite(Date.parse(value))),
  answers: z.array(answerSchema).max(100).default([]),
  /** Opaque: letters, digits, «-» and «_» only — a name or an @username does not pass. */
  participant: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,128}$/)
    .nullable()
    .optional(),
});

export const batchSchema = z.strictObject({ attempts: z.array(attemptSchema).min(1).max(MAX_BATCH) });
export type WireAttempt = z.infer<typeof attemptSchema>;

export interface Attempt {
  id: string;
  test: string;
  score: number;
  max: number | null;
  range: string | null;
  at: number;
  participant: string | null;
  answers: { q: string; a: string; points: number | null }[];
}

export const fromWire = (w: WireAttempt): Attempt => ({
  id: w.attempt_id,
  test: w.test.trim(),
  score: w.score,
  max: w.max_score ?? null,
  range: w.range_label?.trim() || null,
  at: Date.parse(w.finished_at),
  participant: w.participant ?? null,
  answers: w.answers.map((x) => ({ q: x.q.trim(), a: x.a.trim(), points: x.points ?? null })),
});

/* ---------- store ----------
   Questions and answers repeat in every attempt, so the document keeps each
   distinct string once and the attempts as rows of indexes. */

type Row = [id: string, test: number, score: number, max: number | null, range: number, at: number, participant: string | null, answers: [number, number, number | null][]];
interface Stored {
  v: 1;
  updatedAt: number;
  strings: string[];
  attempts: Row[];
}

function encode(attempts: Attempt[], updatedAt: number): Stored {
  const strings: string[] = [];
  const index = new Map<string, number>();
  const ref = (text: string) => {
    let i = index.get(text);
    if (i === undefined) {
      i = strings.push(text) - 1;
      index.set(text, i);
    }
    return i;
  };
  return {
    v: 1,
    updatedAt,
    strings,
    attempts: attempts.map((a) => [a.id, ref(a.test), a.score, a.max, a.range === null ? -1 : ref(a.range), a.at, a.participant, a.answers.map((x) => [ref(x.q), ref(x.a), x.points])]),
  };
}

function decode(stored: Stored): Attempt[] {
  const s = (i: number) => stored.strings[i] ?? "";
  return stored.attempts.map(([id, test, score, max, range, at, participant, answers]) => ({
    id,
    test: s(test),
    score,
    max,
    range: range < 0 ? null : s(range),
    at,
    participant,
    answers: answers.map(([q, a, points]) => ({ q: s(q), a: s(a), points })),
  }));
}

async function load(id: string): Promise<{ attempts: Attempt[]; updatedAt: number; etag: string } | null> {
  const stored = await cabinetStore().read(attemptsKey(id));
  if (!stored) return null;
  const json = JSON.parse(stored.text) as Stored;
  if (json?.v !== 1 || !Array.isArray(json.strings) || !Array.isArray(json.attempts)) throw new Error("attempts document is malformed");
  return { attempts: decode(json), updatedAt: json.updatedAt, etag: stored.etag };
}

export async function readAttempts(id: string): Promise<{ attempts: Attempt[]; updatedAt: number } | null> {
  return load(id);
}

/**
 * Adds attempts; one already stored (same attempt_id) is skipped, so the bot
 * may resend a batch as often as it likes. The write is conditional on what
 * was read and retried, so two pushes at once lose nothing.
 */
export async function addAttempts(id: string, incoming: Attempt[], nowMs = Date.now()): Promise<{ stored: number; duplicates: number }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await load(id);
    const known = new Set(current?.attempts.map((a) => a.id));
    const fresh: Attempt[] = [];
    for (const item of incoming) {
      if (known.has(item.id)) continue;
      known.add(item.id);
      fresh.push(item);
    }
    if (fresh.length === 0) return { stored: 0, duplicates: incoming.length };
    const all = [...(current?.attempts ?? []), ...fresh].sort((a, b) => a.at - b.at).slice(-MAX_ATTEMPTS);
    try {
      await cabinetStore().write(attemptsKey(id), JSON.stringify(encode(all, nowMs)), current?.etag);
      return { stored: fresh.length, duplicates: incoming.length - fresh.length };
    } catch (error) {
      if (!(error instanceof StoreConflictError)) throw error;
    }
  }
  throw new StoreConflictError();
}

/* ---------- a spreadsheet with the same columns ----------
   An uploaded .csv/.xlsx whose header has `test`, `score` and `finished_at`
   is read as attempts: the named columns are the fields, every other column
   is a question (its header) with the cell as the answer. Columns that name
   a person (the bot's own sheet has them) are dropped, not stored. */

const PERSONAL = /^(telegram[ _]?id|tg[ _]?id|user[ _]?id|username|user|name|имя|ім[\u0027’ʼ]?я|телефон|phone|e-?mail|пошта|почта)$/i;
const FIELDS = ["attempt_id", "test", "score", "max_score", "range_label", "finished_at", "participant"] as const;

export function attemptsFromTable(table: Table): Attempt[] | null {
  const names = table.columns.map((c) => c.trim().toLowerCase());
  const at = Object.fromEntries(FIELDS.map((f) => [f, names.indexOf(f)])) as Record<(typeof FIELDS)[number], number>;
  if (at.test < 0 || at.score < 0 || at.finished_at < 0) return null;
  const questions = names.flatMap((name, i) => ((FIELDS as readonly string[]).includes(name) || PERSONAL.test(name) ? [] : [i]));
  const cell = (row: string[], i: number) => (i < 0 ? "" : (row[i] ?? ""));
  const out: Attempt[] = [];
  for (const row of table.rows) {
    const when = Date.parse(cell(row, at.finished_at).replace(" ", "T"));
    const score = Number(cell(row, at.score).replace(",", "."));
    const test = cell(row, at.test);
    if (!test || !Number.isFinite(when) || !Number.isFinite(score)) continue;
    const max = Number(cell(row, at.max_score).replace(",", "."));
    const participant = cell(row, at.participant);
    out.push({
      // No id in the file: the row is its own id, so the same file twice adds nothing.
      id: cell(row, at.attempt_id) || `row-${createHash("sha256").update(row.join("\u0001")).digest("hex").slice(0, 24)}`,
      test,
      score,
      max: cell(row, at.max_score) !== "" && Number.isFinite(max) ? max : null,
      range: cell(row, at.range_label) || null,
      at: when,
      participant: /^[A-Za-z0-9_-]{8,128}$/.test(participant) ? participant : null,
      answers: questions.flatMap((i) => (cell(row, i) === "" ? [] : [{ q: table.columns[i], a: cell(row, i), points: null }])),
    });
  }
  return out;
}

/* ---------- statistics ---------- */

export interface TestSummary {
  test: string;
  count: number;
  average: number;
  max: number | null;
  /** Distinct `participant` hashes; null when the bot sends none. */
  people: number | null;
  ranges: { label: string; count: number }[];
  days: { day: string; count: number }[];
  questions: { q: string; answers: { a: string; count: number }[] }[];
}

const kyivDay = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
const tally = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
const ranked = (map: Map<string, number>) => [...map].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));

export function summarize(attempts: Attempt[]): TestSummary[] {
  const byTest = new Map<string, Attempt[]>();
  for (const a of attempts) byTest.set(a.test, [...(byTest.get(a.test) ?? []), a]);
  return [...byTest]
    .map(([test, list]) => {
      const ranges = new Map<string, number>();
      const days = new Map<string, number>();
      const people = new Set<string>();
      const questions = new Map<string, Map<string, number>>();
      let total = 0;
      let max: number | null = null;
      for (const a of list) {
        total += a.score;
        if (a.max !== null) max = Math.max(max ?? a.max, a.max);
        if (a.range) tally(ranges, a.range);
        tally(days, kyivDay(a.at));
        if (a.participant) people.add(a.participant);
        for (const { q, a: answer } of a.answers) {
          if (!questions.has(q)) questions.set(q, new Map());
          tally(questions.get(q)!, answer);
        }
      }
      return {
        test,
        count: list.length,
        average: total / list.length,
        max,
        people: people.size > 0 ? people.size : null,
        ranges: ranked(ranges).map(([label, count]) => ({ label, count })),
        days: [...days].sort((x, y) => (x[0] < y[0] ? 1 : -1)).map(([day, count]) => ({ day, count })),
        questions: [...questions].map(([q, answers]) => ({ q, answers: ranked(answers).map(([a, count]) => ({ a, count })) })),
      };
    })
    .sort((x, y) => y.count - x.count || x.test.localeCompare(y.test));
}
