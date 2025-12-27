import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { errorResponse } from "@/lib/error-response";

type RouteParams = { params: Promise<{ patientId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const { patientId } = await params;

  if (!patientId) {
    return errorResponse({
      message: "Patient mancante",
      status: 400,
      source: "dental_record_save",
      actor: user,
    });
  }

  try {
    const body = await req.json();
    const tooth = Number.parseInt(body?.tooth);
    const procedure = (body?.procedure as string | undefined)?.trim();
    const notes = (body?.notes as string | undefined)?.trim() || null;

    if (!Number.isInteger(tooth) || !procedure) {
      return errorResponse({
        message: "Dati non validi",
        status: 400,
        source: "dental_record_save",
        context: { patientId },
        actor: user,
      });
    }

    const existing = await prisma.dentalRecord.findFirst({
      where: { patientId, tooth },
      select: { id: true },
    });

    const record = existing
      ? await prisma.dentalRecord.update({
          where: { id: existing.id },
          data: { procedure, notes, performedAt: new Date() },
        })
      : await prisma.dentalRecord.create({
          data: { patientId, tooth, procedure, notes },
        });

    await logAudit(user, {
      action: "patient.dental_record_saved",
      entity: "Patient",
      entityId: patientId,
      metadata: { tooth, procedure },
    });

    revalidatePath(`/pazienti/${patientId}`);

    return NextResponse.json({ record });
  } catch (error) {
    return errorResponse({
      message: "Errore salvataggio record",
      status: 500,
      source: "dental_record_save",
      context: { patientId },
      error,
      actor: user,
    });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const { patientId } = await params;

  if (!patientId) {
    return errorResponse({
      message: "Patient mancante",
      status: 400,
      source: "dental_record_delete",
      actor: user,
    });
  }

  let recordId = "";
  try {
    const body = await req.json();
    recordId = (body?.recordId as string | undefined) ?? "";
  } catch (err) {
    // Allow DELETE without body (some proxies strip it) and fallback to querystring
    const url = new URL(req.url);
    recordId = url.searchParams.get("recordId") ?? "";
  }

  if (!recordId) {
    return errorResponse({
      message: "ID record mancante",
      status: 400,
      source: "dental_record_delete",
      context: { patientId },
      actor: user,
    });
  }

  try {
    const record = await prisma.dentalRecord.findUnique({ where: { id: recordId } });
    if (!record || record.patientId !== patientId) {
      return errorResponse({
        message: "Record non trovato",
        status: 404,
        source: "dental_record_delete",
        context: { patientId, recordId },
        actor: user,
      });
    }

    await prisma.dentalRecord.delete({ where: { id: recordId } });

    await logAudit(user, {
      action: "patient.dental_record_deleted",
      entity: "Patient",
      entityId: patientId,
      metadata: { tooth: record.tooth },
    });

    revalidatePath(`/pazienti/${patientId}`);

    return NextResponse.json({ ok: true, recordId });
  } catch (error) {
    return errorResponse({
      message: "Errore eliminazione record",
      status: 500,
      source: "dental_record_delete",
      context: { patientId, recordId },
      error,
      actor: user,
    });
  }
}
