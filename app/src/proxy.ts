import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales } from "./i18n/config";

const intlMiddleware = createMiddleware({
  defaultLocale,
  locales,
  localePrefix: "as-needed",
});

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production" && request.nextUrl.hostname === "127.0.0.1") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "localhost";
    return NextResponse.redirect(redirectUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
