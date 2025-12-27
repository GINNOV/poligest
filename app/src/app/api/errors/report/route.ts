import { NextResponse } from "next/server";
import { reportError } from "@/lib/error-reporting";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      code?: string;
      message?: string;
      source?: string;
      path?: string;
      context?: Prisma.InputJsonValue;
      error?: unknown;
    };

    const code = await reportError({
      code: body?.code,
      message: body?.message ?? "Errore non specificato",
      source: body?.source ?? "client",
      path: body?.path,
      context: body?.context,
      error: body?.error,
    });

    return NextResponse.json(
      { code },
      { headers: { "x-error-code": code } }
    );
  } catch (error) {
    return NextResponse.json({ code: null }, { status: 500 });
  }
}
