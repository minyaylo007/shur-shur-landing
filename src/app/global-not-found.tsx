import { NotFoundDocument } from "@/components/layout/NotFoundDocument";
import { hebrewFontClass, latinFontClass } from "./fonts";
import "./globals.css";

/**
 * The page Next serves for every address that matches no route — at the ROOT,
 * above `[locale]`, because half of those addresses (`/fr`, `/ukk`) never
 * reach a locale at all. It renders its own <html>, so it is the only kind of
 * 404 in this app that can carry a `lang`.
 *
 * Nothing in next.config.ts switches this on. Measured on 16.2.9, not read in
 * the docs: `next build` and `next dev` (both Turbopack, which is what this
 * project and Vercel run) pick the file up by its name alone — `/uk/tsiny`
 * and `/fr` answered 404 with this document and with `lang` set, with and
 * without `experimental.globalNotFound`, identically. The flag is only read
 * by the webpack path: `next build --webpack` without it prints `/_not-found`
 * as a static route and serves Next's stock «404: This page could not be
 * found» — with the flag the same build serves this page again. So the flag
 * was carried and removed; if this project ever goes back to `--webpack`, it
 * has to come back too.
 *
 * Rendered per request: the language comes from the address asked for, and a
 * copy prerendered at build time would freeze one of them for everybody.
 */
export const dynamic = "force-dynamic";

export default function GlobalNotFound() {
  return <NotFoundDocument latinFontClass={latinFontClass} hebrewFontClass={hebrewFontClass} />;
}
