import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { reportError } from "@/lib/error-reporting";

type Actor = {
  id: string;
  role: Role;
};

type ErrorResponseOptions = {
  message: string;
  status?: number;
  source?: string;
  path?: string;
  context?: Prisma.InputJsonValue;
  error?: unknown;
  actor?: Actor | null;
};

export async function errorResponse({
  message,
  status = 500,
  source,
  path,
  context,
  error,
  actor,
}: ErrorResponseOptions) {
  const code = await reportError({
    message,
    source,
    path,
    context,
    error,
    actor: actor ?? null,
  });

  return NextResponse.json(
    { error: message, code },
    {
      status,
      headers: { "x-error-code": code },
    },
  );
}
