import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      // Canonicalize on the apex domain — avoids www/non-www duplicate content.
      // (Belt-and-suspenders: also set essencefits.com as the primary domain
      // in Vercel's Domains settings, which redirects at the edge before this runs.)
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.essencefits.com" }],
        destination: "https://essencefits.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
