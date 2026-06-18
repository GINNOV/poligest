import { NextResponse } from "next/server";
import { getScanIdMeta } from "@/lib/scanid-meta";

// Public metadata for the macOS ScanID companion app (also used in the web UI download link).

export async function GET() {
  return NextResponse.json(getScanIdMeta());
}
