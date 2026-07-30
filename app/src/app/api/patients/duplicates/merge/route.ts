import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { DELETE_CONFIRMATION_TEXT, hasTypedConfirmation } from "@/lib/destructive-action-guard";
import { errorResponse } from "@/lib/error-response";
import {
  mergeAllSafeEmptyShellGroups,
  mergeEmptyDuplicateShells,
} from "@/lib/patients/duplicate-merge";

function statusForMergeCode(code: string): number {
  if (code === "NOT_FOUND") return 404;
  return 400;
}

export async function POST(req: Request) {
  const user = await requireUser([Role.ADMIN]);

  try {
    const body = await req.json().catch(() => null);
    const mode = body?.mode === "safe_all" ? "safe_all" : "single";
    const confirmation = typeof body?.confirmation === "string" ? body.confirmation : "";

    if (!hasTypedConfirmation(confirmation, DELETE_CONFIRMATION_TEXT)) {
      return errorResponse({
        message: `Conferma eliminazione mancante. Digita '${DELETE_CONFIRMATION_TEXT}' per procedere.`,
        status: 400,
        source: "patient_duplicate_merge",
        actor: user,
      });
    }

    if (mode === "safe_all") {
      const result = await mergeAllSafeEmptyShellGroups({
        actor: user,
        trigger: "bulk",
        autoEligibleOnly: false,
      });

      revalidatePath("/pazienti");
      revalidatePath("/pazienti/duplicati");

      return NextResponse.json({ ok: true, ...result });
    }

    const keepPatientId = typeof body?.keepPatientId === "string" ? body.keepPatientId.trim() : "";
    const deletePatientIds: string[] = Array.isArray(body?.deletePatientIds)
      ? body.deletePatientIds
          .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
      : [];

    if (!keepPatientId || deletePatientIds.length === 0) {
      return errorResponse({
        message: "Dati merge non validi",
        status: 400,
        source: "patient_duplicate_merge",
        actor: user,
      });
    }

    const result = await mergeEmptyDuplicateShells({
      keepPatientId,
      deletePatientIds,
      actor: user,
      trigger: "ui",
    });

    if (!result.ok) {
      return errorResponse({
        message: result.error,
        status: statusForMergeCode(result.code),
        source: "patient_duplicate_merge",
        context: { keepPatientId, deletePatientIds, code: result.code },
        actor: user,
      });
    }

    revalidatePath("/pazienti");
    revalidatePath("/pazienti/duplicati");
    revalidatePath(`/pazienti/${result.keepPatientId}`);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse({
      message: "Merge duplicati non riuscito",
      status: 500,
      source: "patient_duplicate_merge",
      error,
      actor: user,
    });
  }
}
