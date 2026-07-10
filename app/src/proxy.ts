import { NextRequest, NextResponse } from "next/server";
import { defaultLocale } from "./i18n/config";

const localePathPrefix = `/${defaultLocale}`;

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production" && request.nextUrl.hostname === "127.0.0.1") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "localhost";
    return NextResponse.redirect(redirectUrl);
  }

  if (
    request.nextUrl.pathname === localePathPrefix ||
    request.nextUrl.pathname.startsWith(`${localePathPrefix}/`)
  ) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `${localePathPrefix}${request.nextUrl.pathname}`;
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!api|health|_next|_vercel|.*\\..*).*)"],
};
