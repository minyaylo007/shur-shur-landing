import type { Db } from "./db.ts";
import type { Market } from "./config.ts";

/* Sales that never were a site lead: a client wrote in Direct, or left a Meta
   instant form, and bought. The ops bot records source, amount and currency
   — the command has no place for a name or a phone, and any extra word is
   refused rather than stored. They count in CAC next to won site leads. */

export const SALE_SOURCES = {
  direct: "Direct / переписка",
  meta_form: "форма Meta",
  other: "другое",
} as const;
export type SaleSource = keyof typeof SALE_SOURCES;

const SOURCE_ALIASES: Record<string, SaleSource> = {
  direct: "direct",
  dm: "direct",
  директ: "direct",
  form: "meta_form",
  meta_form: "meta_form",
  форма: "meta_form",
  other: "other",
  другое: "other",
};

const MARKET_ALIASES: Record<string, Market> = { sv: "suceava", suceava: "suceava", ta: "tel_aviv", tel_aviv: "tel_aviv", other: "other" };

export const SALE_USAGE =
  "Формат: /client <сумма> <валюта> <источник> [рынок]\n" +
  "источник: direct | form | other; рынок (необязательно): sv | ta\n" +
  "Пример: /client 1500 UAH direct\n" +
  "Без имён и телефонов — только сумма и откуда клиент.";

export interface SaleInput {
  source: SaleSource;
  market: Market;
  amount: number;
  currency: string;
}

/** «1500 UAH direct [sv]» → a sale, or null when anything does not fit. */
export function parseSale(text: string): SaleInput | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 4) return null;
  const [amountRaw, currencyRaw, sourceRaw, marketRaw] = words;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(amountRaw)) return null;
  const amount = Number(amountRaw.replace(",", "."));
  if (!(amount > 0) || amount > 10_000_000) return null;
  if (!/^[A-Za-z]{3}$/.test(currencyRaw)) return null;
  const source = SOURCE_ALIASES[sourceRaw.toLowerCase()];
  if (!source) return null;
  const market = marketRaw === undefined ? "other" : MARKET_ALIASES[marketRaw.toLowerCase()];
  if (!market) return null;
  return { source, market, amount, currency: currencyRaw.toUpperCase() };
}

export function recordSale(db: Db, sale: SaleInput, actor: string, now = new Date()): number {
  const r = db
    .prepare("INSERT INTO offline_sales(at, source, market, amount, currency, actor) VALUES(?,?,?,?,?,?)")
    .run(now.toISOString(), sale.source, sale.market, sale.amount, sale.currency, actor);
  return Number(r.lastInsertRowid);
}

export function deleteSale(db: Db, id: number): boolean {
  return db.prepare("DELETE FROM offline_sales WHERE id = ?").run(id).changes === 1;
}

export function listSales(db: Db, limit = 20) {
  return db
    .prepare("SELECT id, at, source, market, amount, currency FROM offline_sales ORDER BY id DESC LIMIT ?")
    .all(limit) as { id: number; at: string; source: SaleSource; market: Market; amount: number; currency: string }[];
}
