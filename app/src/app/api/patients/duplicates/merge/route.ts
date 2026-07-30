import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { DELETE_CONFIRMATION_TEXT, hasTypedConfirmation } from "@/lib/destructive-action-guard";
import { errorResponse } from "@/lib/error-response";
import {
  mergeAllSafeEmptyShellGroups,
  mergeEmptyDuplicateShells,
} from "@/lib/patients/duplicate-merge";

export async function POST(req: Request) {
  const user = await requireUser([Role.ADMIN]);

  try {
    const body = await req.json();
    const confirmation = typeof body?.confirmation === "string" ? body.confirmation : "";

    if (!hasTypedConfirmation(confirmation, DELETE_CONFIRMATION_TEXT)) {
      return errorResponse({
        message: `Digita ${DELETE_CONFIRMATION_TEXT} per confermare`,
        status: 400,
        source: "patient_duplicate_merge",
        actor: user,
      });
    }

    if (body?.mode === "safe_all") {
      const result = await mergeAllSafeEmptyShellGroups({
        actor: user,
        trigger: "bulk",
        autoEligibleOnly: false,
      });

      revalidatePath("/pazienti");
      revalidatePath("/pazienti/duplicati");

      return NextResponse.json({ mode: "safe_all", ok: true, ...result });
    }

    const keepPatientId = typeof body?.keepPatientId === "string" ? body.keepPatientId : "";
    const deletePatientIds: string[] = Array.isArray(body?.deletePatientIds)
      ? body.deletePatientIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    const result = await mergeEmptyDuplicateShells({
      keepPatientId,
      deletePatientIds,
      actor: user,
      trigger: "ui",
    });

    if (!result.ok) {
      return errorResponse({
        message: result.error,
        status: result.code === "NOT_FOUND" ? 404 : 400,
        source: "patient_duplicate_merge",
        actor: user,
        context: { keepPatientId, deletePatientIds, code: result.code },
      });
    }

    revalidatePath("/pazienti");
    revalidatePath("/pazienti/duplicati");
    revalidatePath(`/pazienti/${result.keepPatientId}`);

    return NextResponse.json({ mode: "single", ...result });
  } catch (error) {
    console.error("[patient-duplicate-merge]", error);
    return errorResponse({
      message: error instanceof Error ? error.message : "Unione non riuscita",
      status: 500,
      source: "patient_duplicate_merge",
      actor: user,
    });
  }
}
