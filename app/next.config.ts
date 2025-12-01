import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Point the plugin to the request config used by next-intl
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
