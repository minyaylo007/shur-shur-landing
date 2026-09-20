import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/*
 * The link preview card — checked by MEASURING THE FILE, never by naming it.
 *
 * The defect this guards: `/og.png` was a 1080x1350 Instagram post (4:5)
 * served under `card: "summary_large_image"`. A messenger crops such a card
 * to 1.91:1 — and later to 1:1 — around its centre, and the word «shur-shur»
 * lived at the bottom edge of that artwork, so every crop showed a nameless
 * red smear. The same file also weighed 2683 KB: a photograph inside a PNG.
 *
 * Two earlier fixes in this project were returned for tests that listed file
 * names by hand — such a test only finds what somebody remembered to type.
 * So nothing here knows what the asset is called. The URL is taken from the
 * ONE place the page takes it from (the `openGraph.images` descriptor in
 * `src/app/[locale]/layout.tsx`), the file is found on disk by that URL, and
 * the width, height and weight are read out of the file's own bytes. Swap the
 * asset, rename it, or let a branch put a vertical picture back under any
 * name — the assertions below still measure whatever the page now points at.
 *
 * `blockOf`/`ogDescriptor` throw rather than skip when the metadata is
 * restructured: a preview test that silently finds nothing is the failure
 * mode this file exists to prevent.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const publicFile = (webPath: string) =>
  fileURLToPath(new URL(`../public${webPath}`, import.meta.url));

/** Source with comments removed — a `{` inside a comment must not be matched. */
const layoutSource = read("../src/app/[locale]/layout.tsx")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

/** The `key: { ... }` object literal from the layout's metadata, braces matched. */
function blockOf(key: "openGraph" | "twitter"): string {
  const at = layoutSource.indexOf(`${key}: {`);
  if (at < 0) {
    throw new Error(
      `metadata has no \`${key}\` block in src/app/[locale]/layout.tsx — ` +
        `the preview card moved, so this test can no longer measure it`,
    );
  }
  const open = layoutSource.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < layoutSource.length; i += 1) {
    if (layoutSource[i] === "{") depth += 1;
    else if (layoutSource[i] === "}") {
      depth -= 1;
      if (depth === 0) return layoutSource.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced braces in the \`${key}\` metadata block`);
}

/** What the page CLAIMS about its card: the URL and the size it advertises. */
function ogDescriptor(): { url: string; width: number; height: number } {
  const entry = /images:\s*\[\s*\{([^}]*)\}/.exec(blockOf("openGraph"));
  if (!entry) {
    throw new Error(
      "openGraph.images has no `{ url, width, height }` descriptor — " +
        "this test reads the card's address from there and found nothing",
    );
  }
  const url = /\burl:\s*["'`]([^"'`]+)["'`]/.exec(entry[1]);
  const width = /\bwidth:\s*(\d+)/.exec(entry[1]);
  const height = /\bheight:\s*(\d+)/.exec(entry[1]);
  if (!url || !width || !height) {
    throw new Error(
      `openGraph.images declares ${entry[1].trim()} — url, width and height are all required, ` +
        "otherwise the numbers scrapers trust cannot be checked against the file",
    );
  }
  return { url: url[1], width: Number(width[1]), height: Number(height[1]) };
}

/** Real pixel size read out of the file header — no image library, no guessing
 *  from the extension. An unknown container throws: an OG asset in a format
 *  this cannot read is an asset no scraper should be handed either. */
function measure(bytes: Buffer): { format: string; width: number; height: number } {
  const ascii = (from: number, to: number) => bytes.subarray(from, to).toString("latin1");

  if (bytes.length > 24 && ascii(1, 4) === "PNG") {
    return { format: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (ascii(0, 3) === "GIF") {
    return { format: "gif", width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const chunk = ascii(12, 16);
    if (chunk === "VP8X") {
      return {
        format: "webp",
        width: bytes.readUIntLE(24, 3) + 1,
        height: bytes.readUIntLE(27, 3) + 1,
      };
    }
    if (chunk === "VP8 ") {
      return {
        format: "webp",
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const b = bytes.readUInt32LE(21);
      return { format: "webp", width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    /* Walk the segment chain to the frame header: the size lives in SOF0..SOF15,
       and only there — a JPEG's thumbnail or EXIF must not be measured instead. */
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) {
        at += 1;
        continue;
      }
      const marker = bytes[at + 1];
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        at += 2;
        continue;
      }
      const isFrameHeader =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrameHeader) {
        return {
          format: "jpeg",
          height: bytes.readUInt16BE(at + 5),
          width: bytes.readUInt16BE(at + 7),
        };
      }
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }
  throw new Error(
    `unrecognised image container (first bytes: ${bytes.subarray(0, 4).toString("hex")}) — ` +
      "a preview asset must be a format both scrapers and this test can read",
  );
}

/** Facebook/Telegram/Slack all render the wide card at 1.91:1. The window is
 *  deliberately wide enough to allow 1200x628 or 1280x640 and nothing near a
 *  square — a 4:5 post is 0.8 and must never pass. */
const MIN_RATIO = 1.7;
const MAX_RATIO = 2.0;
/** 300 KB. The old card was 2683 KB; the same picture as JPEG is ~210 KB. */
const MAX_BYTES = 300 * 1024;

const declared = ogDescriptor();
const file = publicFile(declared.url);
const bytes = readFileSync(file);
const actual = measure(bytes);
const weight = statSync(file).size;

describe(`open graph card (${declared.url})`, () => {
  it("advertises the size the file actually has", () => {
    expect({ width: actual.width, height: actual.height }).toEqual({
      width: declared.width,
      height: declared.height,
    });
  });

  it("is a wide card, not a vertical post", () => {
    const ratio = actual.width / actual.height;
    expect(
      ratio,
      `${actual.width}x${actual.height} is ${ratio.toFixed(2)}:1 — a messenger crops that ` +
        "to the centre and cuts the logotype out of the card",
    ).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(ratio).toBeLessThanOrEqual(MAX_RATIO);
  });

  it("stays under the weight ceiling", () => {
    expect(
      weight,
      `${Math.round(weight / 1024)} KB — the card must stay under ${MAX_BYTES / 1024} KB`,
    ).toBeLessThanOrEqual(MAX_BYTES);
  });

  it("is a photographic format, not PNG", () => {
    expect(["jpeg", "webp"]).toContain(actual.format);
  });

  it("is the same picture Twitter/X is told to use, under a wide-card tag", () => {
    const twitter = blockOf("twitter");
    expect(twitter).toMatch(/card:\s*["'`]summary_large_image["'`]/);
    const twitterImage = /images:\s*\[\s*["'`]([^"'`]+)["'`]/.exec(twitter);
    expect(twitterImage?.[1]).toBe(declared.url);
  });
});

describe("apple touch icon", () => {
  /* App Router convention: `src/app/apple-icon.png` becomes
     <link rel="apple-touch-icon">. Without it iOS puts a shrunken screenshot
     of the page on the home screen. */
  const iconPath = fileURLToPath(new URL("../src/app/apple-icon.png", import.meta.url));
  const icon = measure(readFileSync(iconPath));

  it("is the 180x180 square iOS asks for", () => {
    expect(icon).toEqual({ format: "png", width: 180, height: 180 });
  });
});
