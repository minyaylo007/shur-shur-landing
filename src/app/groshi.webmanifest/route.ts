/* The «Гроші» page as a home-screen app: standalone, opens on /groshi. No
   service worker — offline and push are not needed. Served from code so the
   icons it names are visible to the public/ reachability check. */

export const dynamic = "force-static";

const manifest = {
  name: "Гроші",
  short_name: "Гроші",
  description: "Прийшло, пішло, залишилось — одним поглядом.",
  lang: "uk",
  id: "/groshi",
  start_url: "/groshi",
  scope: "/groshi",
  display: "standalone",
  orientation: "portrait",
  background_color: "#faf7f0",
  theme_color: "#4a0d14",
  icons: [
    { src: "/money/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/money/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/money/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json; charset=utf-8" } });
}
