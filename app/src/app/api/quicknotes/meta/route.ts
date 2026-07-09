import { NextResponse } from "next/server";
import { getQuickNotesMeta } from "@/lib/quicknotes-meta";

// Public metadata for the macOS QuickNotes companion app (also used in the web UI download link).

export async function GET() {
  return NextResponse.json(getQuickNotesMeta());
}