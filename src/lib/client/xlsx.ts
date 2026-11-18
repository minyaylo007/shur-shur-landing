import { inflateRawSync } from "node:zlib";

/**
 * The first sheet of an .xlsx file as rows of strings. Server-only.
 *
 * Written here instead of pulled from npm on purpose: the file comes from a
 * client, a spreadsheet library is a large parser to trust with it, and all
 * the cabinet needs is cell text. An .xlsx is a ZIP of XML; this reads the
 * central directory, inflates three entries (shared strings, styles, sheet 1)
 * with a hard cap on the inflated size, and takes cell values with regular
 * expressions. Formulas are not evaluated — the cached value is shown.
 * Date-styled numbers become «YYYY-MM-DD» or «YYYY-MM-DD HH:MM».
 */

const MAX_ENTRY_BYTES = 24 * 1024 * 1024;

export class XlsxError extends Error {}

function zipEntries(file: Buffer): Map<string, () => Buffer> {
  // End of central directory: the last 22+ bytes, searched from the end.
  let eocd = -1;
  for (let i = file.length - 22; i >= Math.max(0, file.length - 22 - 65_535); i--) {
    if (file.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxError("not a zip");
  const count = file.readUInt16LE(eocd + 10);
  let at = file.readUInt32LE(eocd + 16);
  const entries = new Map<string, () => Buffer>();
  for (let n = 0; n < count; n++) {
    if (at + 46 > file.length || file.readUInt32LE(at) !== 0x02014b50) throw new XlsxError("bad zip directory");
    const method = file.readUInt16LE(at + 10);
    const packed = file.readUInt32LE(at + 20);
    const nameLength = file.readUInt16LE(at + 28);
    const extraLength = file.readUInt16LE(at + 30);
    const commentLength = file.readUInt16LE(at + 32);
    const local = file.readUInt32LE(at + 42);
    const name = file.toString("utf8", at + 46, at + 46 + nameLength);
    entries.set(name, () => {
      if (local + 30 > file.length || file.readUInt32LE(local) !== 0x04034b50) throw new XlsxError("bad zip entry");
      const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28);
      const data = file.subarray(start, start + packed);
      if (method === 0) return data;
      if (method !== 8) throw new XlsxError("unsupported zip method");
      return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (text: string) =>
  text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, name: string) =>
    name[0] === "#" ? String.fromCodePoint(name[1] === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1))) : ENTITIES[name],
  );

/** All <t> runs of one string item, joined; phonetic runs (<rPh>) are skipped. */
function richText(xml: string): string {
  const plain = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of plain.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescape(out);
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** For each cell style index: does its number format show a date or a time? */
function dateStyles(stylesXml: string | null): boolean[] {
  if (!stylesXml) return [];
  const custom = new Map<number, boolean>();
  for (const m of stylesXml.matchAll(/<numFmt\b[^>]*?numFmtId="(\d+)"[^>]*?formatCode="([^"]*)"/g)) {
    // Quoted literals and [colour]/[locale] blocks are not date letters.
    const code = unescape(m[2]).replace(/"[^"]*"|\[[^\]]*\]/g, "");
    custom.set(Number(m[1]), /[dmyhs]/i.test(code));
  }
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? "";
  return [...xfs.matchAll(/<xf\b[^>]*?numFmtId="(\d+)"/g)].map((m) => {
    const id = Number(m[1]);
    return custom.get(id) ?? BUILTIN_DATE_FORMATS.has(id);
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel serial day (1900 system, with its phantom 29.02.1900) → text. */
function serialToText(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(serial);
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return Number.isInteger(serial) ? day : `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

export function readXlsx(file: Buffer, maxRows: number, maxColumns: number): string[][] {
  const entries = zipEntries(file);
  const text = (name: string) => entries.get(name)?.().toString("utf8") ?? null;

  const sheetName = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(/\d+/.exec(a.slice(18))![0]) - Number(/\d+/.exec(b.slice(18))![0]))[0];
  const sheet = sheetName ? text(sheetName) : null;
  if (!sheet) throw new XlsxError("no sheet");

  const sharedXml = text("xl/sharedStrings.xml");
  const shared = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => richText(m[1])) : [];
  const isDate = dateStyles(text("xl/styles.xml"));

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (rows.length > maxRows) break; // one over the limit: the caller reports «too many»
    const row: string[] = [];
    let next = 0;
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const column = ref ? columnIndex(ref) : next;
      next = column + 1;
      if (column >= maxColumns) continue;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? "n";
      const inner = cell[2] ?? "";
      const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = "";
      if (type === "inlineStr") value = richText(inner);
      else if (raw === undefined) value = "";
      else if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
      else if (type === "n") {
        const style = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? -1);
        value = isDate[style] && raw !== "" && Number.isFinite(Number(raw)) ? serialToText(Number(raw)) : raw;
      } else value = unescape(raw);
      while (row.length < column) row.push("");
      row[column] = value;
    }
    rows.push(row);
  }
  return rows;
}
