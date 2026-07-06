import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PatientPaymentKind, PatientPaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { isAuthorizedMacosAppRequest } from "@/lib/patients/macos-api-auth";

const allowedMethods = new Set<string>(Object.values(PatientPaymentMethod));

export async function POST(req: Request) {
  if (!isAuthorizedMacosAppRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestQuickNotesTransactionId = "";

  try {
    const body = await req.json();
    const patientId = typeof body.patientId === "string" ? body.patientId.trim() : "";
    const quickNotesTransactionId =
      typeof body.quickNotesTransactionId === "string" ? body.quickNotesTransactionId.trim() : "";
    requestQuickNotesTransactionId = quickNotesTransactionId;
    const amount = Number.parseFloat(String(body.amount ?? "").replace(",", "."));
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    const methodRaw = String(body.method || PatientPaymentMethod.ELECTRONIC).toUpperCase();
    const method = allowedMethods.has(methodRaw)
      ? (methodRaw as PatientPaymentMethod)
      : PatientPaymentMethod.ELECTRONIC;
    const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (!patientId || !quickNotesTransactionId || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
    }

    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
    }

    const existingSync = await findExistingQuickNotesSync(quickNotesTransactionId);
    const quickNotesSyncTableAvailable = !existingSync.unavailable;
    if (existingSync.record) {
      return duplicateResponse(existingSync.record.patientPaymentId, existingSync.record.financeEntryId);
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const existingEntry = await prisma.financeEntry.findFirst({
      where: {
        type: "INCOME",
        metadata: {
          path: ["quickNotesTransactionId"],
          equals: quickNotesTransactionId,
        },
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    if (existingEntry) {
      const metadata = existingEntry.metadata;
      const paymentId =
        metadata && typeof metadata === "object" && !Array.isArray(metadata) && "paymentId" in metadata
          ? String(metadata.paymentId)
          : null;
      return NextResponse.json({
        ok: true,
        duplicate: true,
        paymentId,
        financeEntryId: existingEntry.id,
      });
    }

    const patientName = `${patient.lastName ?? ""} ${patient.firstName ?? ""}`.trim() || clientName || "Paziente";
    const description = [
      `Pagamento QuickNotes paziente ${patientName}`,
      clientName && clientName !== patientName ? `Inserito come: ${clientName}` : null,
      note || null,
    ]
      .filter(Boolean)
      .join(" · ");

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.patientPayment.create({
        data: {
          patientId,
          amount: new Prisma.Decimal(amount),
          paidAt,
          method,
          kind: PatientPaymentKind.STANDARD,
          note: note || "Registrato da QuickNotes",
        },
      });

      const financeEntry = await tx.financeEntry.create({
        data: {
          type: "INCOME",
          description,
          amount: new Prisma.Decimal(amount),
          occurredAt: paidAt,
          patientId,
          method,
          metadata: {
            source: "quicknotes",
            quickNotesTransactionId,
            paymentId: p.id,
            clientName,
          },
        },
      });

      if (quickNotesSyncTableAvailable) {
        await tx.quickNotesPaymentSync.create({
          data: {
            quickNotesTransactionId,
            patientId,
            patientPaymentId: p.id,
            financeEntryId: financeEntry.id,
          },
        });
      }

      return { payment: p, financeEntry };
    });

    try {
      await logAudit(null, {
        action: "finance.quicknotes_payment.recorded",
        entity: "PatientPayment",
        entityId: payment.payment.id,
        metadata: {
          actorLabel: "QuickNotes",
          source: "quicknotes",
          patientId,
          amount,
          method,
          quickNotesTransactionId,
          financeEntryId: payment.financeEntry.id,
        },
      });
    } catch (auditError) {
      console.error("QuickNotes payment audit failed:", auditError);
    }

    try {
      revalidatePath("/finanza/pagamenti");
    } catch (revalidateError) {
      console.error("QuickNotes payment cache revalidation failed:", revalidateError);
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      paymentId: payment.payment.id,
      financeEntryId: payment.financeEntry.id,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existingSync = await findExistingQuickNotesSync(requestQuickNotesTransactionId);
      if (existingSync.record) {
        return duplicateResponse(existingSync.record.patientPaymentId, existingSync.record.financeEntryId);
      }
    }

    console.error("QuickNotes payment sync failed:", error);
    const message = error instanceof Error ? error.message : "Failed to record QuickNotes payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type QuickNotesSyncRecord = {
  patientPaymentId: string;
  financeEntryId: string;
};

type QuickNotesSyncLookup = {
  record: QuickNotesSyncRecord | null;
  unavailable: boolean;
};

function duplicateResponse(paymentId: string | null, financeEntryId: string) {
  return NextResponse.json({
    ok: true,
    duplicate: true,
    paymentId,
    financeEntryId,
  });
}

async function findExistingQuickNotesSync(quickNotesTransactionId: string): Promise<QuickNotesSyncLookup> {
  if (!quickNotesTransactionId) {
    return { record: null, unavailable: false };
  }

  try {
    const record = await prisma.quickNotesPaymentSync.findUnique({
      where: { quickNotesTransactionId },
      select: {
        patientPaymentId: true,
        financeEntryId: true,
      },
    });

    return { record, unavailable: false };
  } catch (error) {
    if (isMissingQuickNotesSyncTableError(error)) {
      console.warn("QuickNotes sync table is unavailable; falling back to finance metadata idempotency.");
      return { record: null, unavailable: true };
    }

    throw error;
  }
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isMissingQuickNotesSyncTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022"].includes(error.code);
}
