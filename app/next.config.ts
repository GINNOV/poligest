import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Point the plugin to the request config used by next-intl
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // Allow local images (e.g. uploads) to include cache-busting query strings.
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/stack/v1/:path*',
      },
    ];
  },
};

export default withNextIntl(nextConfig);
