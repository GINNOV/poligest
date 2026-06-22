import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { getWacomLicenseConfig } from "@/lib/wacom-config";
import { errorResponse } from "@/lib/error-response";

export async function GET() {
  try {
    await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
    const config = await getWacomLicenseConfig();

    if (!config) {
      return NextResponse.json({ configured: false });
    }

    return NextResponse.json({
      configured: true,
      licenseKey: config.licenseKey,
      licenseSecret: config.licenseSecret,
      source: config.source,
    });
  } catch (error) {
    return errorResponse({
      message: "Errore nel recupero della licenza Wacom.",
      status: 401,
      source: "api/wacom/license",
      error,
    });
  }
}