
import { NextResponse } from "next/server";

/**
 * Validates the cron secret from headers.
 * Supports both standard Vercel 'Authorization: Bearer <secret>' 
 * and custom 'x-cron-secret: <secret>'.
 */
export async function validateCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const customHeader = req.headers.get("x-cron-secret");
  if (customHeader === secret) return true;

  return false;
}

export function unauthorizedCronResponse(...args: unknown[]) {
  void args;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
