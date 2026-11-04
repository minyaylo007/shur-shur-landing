import type { Locale } from "./i18n";
import { processPair, workItems, type WorkItem } from "./work";

/**
 * Cases (redesign v4, brief B1.2).
 *
 * Until Sasha names the clients, a case is built from work that is already on
 * the page: the niche and «what we made» come from the portfolio's own alt
 * texts, the media are the same files. Brand, task and result are slots:
 * `null` means the card does not draw the row. No client name, no figure,
 * no «+X%» is written anywhere until it exists with a screenshot behind it.
 */
export type CaseKey = "bridal" | "restaurant" | "bodycare" | "leisure" | "wellness";

export interface Case {
  key: CaseKey;
  /** Ids from lib/work — the first is the cover. */
  media: string[];
  /** Client name as they agreed to be named. */
  brand: string | null;
  /** What the client asked for. */
  task: Record<Locale, string> | null;
  /** What changed — in words, or a figure only with a screenshot behind it. */
  result: Record<Locale, string> | null;
}

const empty = { brand: null, task: null, result: null };

export const cases: Case[] = [
  { key: "bridal", media: ["reel-bride", "bridal-atelier", "reel-atelier"], ...empty },
  { key: "restaurant", media: ["reel-kitchen", "story-estate", "story-pasta"], ...empty },
  { key: "bodycare", media: ["bts-cosmetics", "result-underwater"], ...empty },
  { key: "leisure", media: ["story-kodra", "story-kodra-dates"], ...empty },
  { key: "wellness", media: ["reel-massage", "story-massage"], ...empty },
];

const all: WorkItem[] = [...workItems, processPair.bts, processPair.result];

/** The media of a case, resolved; an unknown id is a build-time error. */
export function caseMedia(c: Case): WorkItem[] {
  return c.media.map((id) => {
    const item = all.find((w) => w.id === id);
    if (!item) throw new Error(`case ${c.key}: unknown media id ${id}`);
    return item;
  });
}
