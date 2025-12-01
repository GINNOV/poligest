import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Point the plugin to the request config used by next-intl
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Allow local images (e.g. uploads) to include cache-busting query strings.
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
