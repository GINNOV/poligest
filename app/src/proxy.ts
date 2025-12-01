import { withAuth } from "next-auth/middleware";
import createMiddleware from "next-intl/middleware";
import { NextFetchEvent, NextRequest } from "next/server";
import { defaultLocale, locales } from "./i18n/config";
import { NextRequestWithAuth } from "next-auth/middleware";

const publicPaths = ["/", "/auth/login"];

const intlMiddleware = createMiddleware({
  defaultLocale,
  locales,
  localePrefix: "as-needed",
});

const authMiddleware = withAuth(
  function middleware(request: NextRequestWithAuth) {
    return intlMiddleware(request);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (publicPaths.includes(pathname)) return true;
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/login",
    },
  },
);

export function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  return authMiddleware(request as NextRequestWithAuth, event);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
