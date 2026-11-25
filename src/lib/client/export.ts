import type { Attempt } from "./attempts";
import type { Table } from "./results";

/* The cabinet's «Скачати результати (.csv)»: the bot's attempts — one row
   per attempt, one column per question — or, for a cabinet that has only an
   uploaded table, that table as is. UTF-8 with a BOM so Excel reads Cyrillic.
   Nothing of the client (name, phone) goes into the file. */

const BOM = "﻿";
const QUOTE = String.fromCharCode(34);
const APOSTROPHE = String.fromCharCode(39);
/** A cell starting with one of these is a formula to Excel. */
const FORMULA = "=+-@\t\r";
const SPECIAL = QUOTE + ",;\r\n";

/** A cell for Excel: quoted when needed; text that starts like a formula is defused. */
function cell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const text = FORMULA.includes(value.charAt(0)) && value !== "" ? APOSTROPHE + value : value;
  return [...SPECIAL].some((c) => text.includes(c)) ? QUOTE + text.split(QUOTE).join(QUOTE + QUOTE) + QUOTE : text;
}

const line = (cells: (string | number | null)[]) => cells.map(cell).join(",");

const kyiv = (ms: number) => new Date(ms).toLocaleString("sv-SE", { timeZone: "Europe/Kyiv" }).slice(0, 16);

export function attemptsCsv(attempts: Attempt[]): string {
  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  const questions: string[] = [];
  const seen = new Set<string>();
  for (const a of sorted)
    for (const x of a.answers)
      if (!seen.has(x.q)) {
        seen.add(x.q);
        questions.push(x.q);
      }
  const rows = [line(["Дата (Київ)", "Тест", "Бал", "Макс. бал", "Діапазон", ...questions])];
  for (const a of sorted) {
    const answers = new Map(a.answers.map((x) => [x.q, x.a]));
    rows.push(line([kyiv(a.at), a.test, a.score, a.max, a.range, ...questions.map((q) => answers.get(q) ?? null)]));
  }
  return BOM + rows.join("\r\n") + "\r\n";
}

export function tableCsv(table: Table): string {
  return BOM + [line(table.columns), ...table.rows.map(line)].join("\r\n") + "\r\n";
}
