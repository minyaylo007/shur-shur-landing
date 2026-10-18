/**
 * Copy of a market landing (lib/markets). One file per landing, written in
 * the landing's own language only — a landing has no language siblings.
 *
 * Every visible line of a Romanian or Hebrew file carries the comment
 * «ждёт проверки носителем» until a native speaker has read it; the owner
 * flips `approved` in lib/markets only after that. tests/market-landings
 * refuses a line without the comment while the page is not approved.
 */
export interface LandingSegment {
  /** Stable key (hypothesis name), not shown. */
  key: string;
  kicker: string;
  heading: string;
  text: string;
  points: readonly string[];
  /** Portfolio ids from lib/work — real cases only; unknown id = build error. */
  work: readonly string[];
  /** One honest line under the tiles: whose work this is. */
  workNote: string;
}

export interface LandingCopy {
  meta: { title: string; description: string };
  hero: { kicker: string; title: string; sub: string; cta: string };
  /** Who we are — only what is true (see lib/markets). */
  about: { heading: string; text: string };
  segments: readonly LandingSegment[];
  steps: { heading: string; items: readonly string[] };
  audit: { kicker: string; heading: string; sub: string };
  /** Labels of blocks that render ONLY when lib/markets has the value. */
  whenConfigured: { phoneLabel: string; priceFrom: string };
  footer: { home: string };
}
