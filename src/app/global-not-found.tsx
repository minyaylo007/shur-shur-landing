import { NotFoundDocument } from "@/components/layout/NotFoundDocument";
import { hebrewFontClass, latinFontClass } from "./fonts";
import "./globals.css";

/**
 * The page Next serves for every address that matches no route — at the ROOT,
 * above `[locale]`, because half of those addresses (`/fr`, `/ukk`) never
 * reach a locale at all. Enabled by `experimental.globalNotFound` in
 * next.config.ts; it renders its own <html>, so it is the only kind of 404 in
 * this app that can carry a `lang`.
 *
 * Rendered per request: the language comes from the address asked for, and a
 * copy prerendered at build time would freeze one of them for everybody.
 */
export const dynamic = "force-dynamic";

export default function GlobalNotFound() {
  return <NotFoundDocument latinFontClass={latinFontClass} hebrewFontClass={hebrewFontClass} />;
}
