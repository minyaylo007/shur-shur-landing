import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
