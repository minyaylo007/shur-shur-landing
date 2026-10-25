import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  /* v3 §10. The tiles ship as WebP already; this lets next/image ALSO emit
     AVIF, which is typically another 15–25% smaller at the same quality, and
     fall back to WebP for anything that cannot take it. Order matters — it is
     the content-negotiation preference order, best first. The `sizes` prop on
     every <Image> is what turns this into a real srcset rather than one large
     file scaled down in the browser (anti-CLS, §10). */
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /* The private cabinet: never indexed, never cached by anyone on the way. */
  async headers() {
    const closed = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Cache-Control", value: "private, no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/cabinet", headers: closed },
      { source: "/cabinet/:path*", headers: closed },
      { source: "/api/cabinet/:path*", headers: closed },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/uk",
        permanent: true, // 308
      },
    ];
  },
};

export default nextConfig;
