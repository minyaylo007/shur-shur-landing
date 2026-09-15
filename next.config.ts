import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* `app/global-not-found.tsx` — the only 404 in the App Router that renders
     its own <html>, and therefore the only one that can set `lang`/`dir`.
     Without this flag Next falls back to its stock page: a document with no
     `lang`, no text of ours and no link back to the site. */
  experimental: {
    globalNotFound: true,
  },
  turbopack: {
    root: __dirname,
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
