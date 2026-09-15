import { readdirSync, existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { workItems, processPair, heroVideo } from "../src/lib/work";

/*
 * Every file in `public/` must be reachable from `src/`, and every path `src/`
 * names must exist in `public/`. Both directions, because each one catches a
 * different accident: the first catches a file that outlived the code that
 * showed it, the second catches a rename that quietly broke a live asset.
 *
 * ── Why this is not a grep ────────────────────────────────────────────────
 *
 * The obvious version of this test — take each basename in `public/`, grep
 * `src/` for it — is not merely weaker, it is dangerous, and it was written
 * first and believed. It declared 28 files dead, `work/video/hero-street.mp4`
 * among them: the video that plays on the first screen of the live site, in
 * every locale. The reason is in `lib/work.ts` — portfolio paths are BUILT,
 * never written:
 *
 *     src:    `/work/photo/${id}.webp`
 *     src:    `/work/video/${id}.mp4`
 *     poster: `/work/poster/${id}.webp`
 *
 * The string `hero-street.mp4` appears nowhere in `src/` — only the bare id
 * `hero-street` does, inside a call — so a substring search over file names is
 * certain to be wrong in the worst possible direction: it recommends deleting
 * exactly the files the site serves.
 *
 * So this test does not search for names. It builds the reachable set the same
 * way the application builds it — by importing the data modules and reading
 * the paths off the real objects — and only then adds the paths that genuinely
 * ARE written out as literals (`/og-card.jpg` in the metadata).
 *
 * ── What is deliberately NOT here ─────────────────────────────────────────
 *
 * App Router convention files — `icon.svg`, `apple-icon.png`, `robots.ts`,
 * `sitemap.ts` — need no exception, because they do not live in `public/` at
 * all: they sit in `src/app/` and Next turns them into routes at build time.
 * The one metadata asset that DOES live in `public/`, the Open Graph card, is
 * reachable the ordinary way — `layout.tsx` names it as a literal string.
 *
 * Hence EXCEPTIONS below is empty, and that is a statement, not an oversight.
 * A file added to `public/` that nothing in `src/` reaches is either wired up
 * or removed; if it is genuinely reached by something this test cannot see
 * (a hand-written `<link>`, a platform convention), it goes in EXCEPTIONS with
 * the reason written next to it.
 */

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/** Public paths reached by something this test cannot follow. See above. */
const EXCEPTIONS: { path: string; why: string }[] = [];

/** Everything under `public/`, as the URL path the browser would request. */
function publicFiles(dir = "../public", prefix = ""): string[] {
  return readdirSync(at(dir), { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    const url = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? publicFiles(child, url) : [url];
  });
}

/** Every `.ts`/`.tsx` file under `src/`, as repo-relative paths. */
function sourceFiles(dir = "../src"): string[] {
  return readdirSync(at(dir), { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.tsx?$/.test(entry.name) ? [child.replace("../", "")] : [];
  });
}

/**
 * Paths the code CONSTRUCTS: read off the real objects the page renders, so a
 * template literal is followed exactly as the browser will follow it.
 */
const constructedPaths = (() => {
  const items = [...workItems, processPair.bts, processPair.result, heroVideo];
  return items.flatMap((item) => (item.kind === "video" ? [item.src, item.poster] : [item.src]));
})();

/** Paths the code WRITES OUT, as string literals in the source. */
const ASSET_LITERAL = /["'`](\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]{2,5})["'`]/g;
const literalPaths = sourceFiles().flatMap((file) => {
  const src = readFileSync(at(`../${file}`), "utf8");
  return [...src.matchAll(ASSET_LITERAL)].map((match) => match[1]);
});

const reachable = new Set([...constructedPaths, ...literalPaths]);

describe("public/ — the scan itself is honest before it judges anything", () => {
  it("is not vacuous: it sees the real tree on both sides", () => {
    expect(publicFiles().length).toBeGreaterThan(20);
    expect(sourceFiles().length).toBeGreaterThan(20);
    expect(constructedPaths.length).toBeGreaterThan(20);
  });

  it("follows BUILT paths — hero-street.mp4 is reachable, and by no literal", () => {
    // The exact case the first, grep-shaped version of this test got wrong.
    // Asserted from both ends: the constructed set has it, and a search for
    // the name in the source would NOT have — so if someone ever replaces the
    // construction with a substring search, this line says what breaks.
    expect(constructedPaths).toContain("/work/video/hero-street.mp4");
    expect(literalPaths).not.toContain("/work/video/hero-street.mp4");
    expect(publicFiles()).toContain("/work/video/hero-street.mp4");
  });

  it("follows WRITTEN paths — the Open Graph card is found as a literal", () => {
    expect(literalPaths).toContain("/og-card.jpg");
  });

  it("no exception has outlived the file it excuses", () => {
    for (const { path, why } of EXCEPTIONS) {
      expect(publicFiles(), `stale exception: ${path}`).toContain(path);
      expect(why.length).toBeGreaterThan(20);
    }
  });
});

describe("public/ — nothing dead, nothing missing", () => {
  it("every file in public/ is reached from src/", () => {
    const excused = new Set(EXCEPTIONS.map((exception) => exception.path));
    const orphans = publicFiles().filter((file) => !reachable.has(file) && !excused.has(file));
    // Named, not counted: a failure has to say which file to look at.
    expect(orphans).toEqual([]);
  });

  it("every path src/ points at exists in public/", () => {
    // The other direction, and the one that protects a visitor: a renamed or
    // deleted asset is a 404 on a live page, which no unit test would notice.
    const missing = [...reachable].filter((path) => !existsSync(at(`../public${path}`)));
    expect(missing).toEqual([]);
  });
});
