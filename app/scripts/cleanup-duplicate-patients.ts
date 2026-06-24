import { prisma } from "../src/lib/prisma";
import { logAudit } from "../src/lib/audit";
import { findPotentialPatientDuplicates } from "../src/lib/patients/duplicate-detection";
import {
  buildDuplicateCleanupPlan,
  type PatientAttachmentCounts,
} from "../src/lib/patients/duplicate-cleanup";
import { deletePatientWithRelations } from "../src/lib/patients/delete-patient";

const execute = process.argv.includes("--execute");

async function loadAttachmentCounts(patientIds: string[]) {
  const counts = new Map<string, PatientAttachmentCounts>();

  for (const patientId of patientIds) {
    counts.set(patientId, { paymentCount: 0, dentalRecordCount: 0 });
  }

  if (patientIds.length === 0) {
    return counts;
  }

  const [paymentGroups, dentalRecordGroups] = await Promise.all([
    prisma.patientPayment.groupBy({
      by: ["patientId"],
      where: { patientId: { in: patientIds } },
      _count: { _all: true },
    }),
    prisma.dentalRecord.groupBy({
      by: ["patientId"],
      where: { patientId: { in: patientIds } },
      _count: { _all: true },
    }),
  ]);

  for (const group of paymentGroups) {
    const entry = counts.get(group.patientId);
    if (entry) {
      entry.paymentCount = group._count._all;
    }
  }

  for (const group of dentalRecordGroups) {
    const entry = counts.get(group.patientId);
    if (entry) {
      entry.dentalRecordCount = group._count._all;
    }
  }

  return counts;
}

async function main() {
  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
      notes: true,
      createdAt: true,
    },
  });

  const groups = findPotentialPatientDuplicates(patients);
  const duplicatePatientIds = Array.from(
    new Set(groups.flatMap((group) => group.patients.map((patient) => patient.id))),
  );
  const attachmentCountsByPatientId = await loadAttachmentCounts(duplicatePatientIds);
  const plan = buildDuplicateCleanupPlan(groups, attachmentCountsByPatientId);

  if (plan.length === 0) {
    console.log("No duplicate groups found. Nothing to clean up.");
    return;
  }

  const totalDeletes = plan.reduce((sum, action) => sum + action.deletePatientIds.length, 0);

  console.log(
    execute
      ? `Executing duplicate cleanup for ${plan.length} groups (${totalDeletes} deletions)...`
      : `Dry run: ${plan.length} duplicate groups, ${totalDeletes} records would be deleted.`,
  );

  for (const action of plan) {
    console.log(
      `- Group ${action.groupId}: keep ${action.keepPatientId}, delete [${action.deletePatientIds.join(", ")}] (${action.reason})`,
    );
  }

  if (!execute) {
    console.log("Re-run with --execute to apply these deletions.");
    return;
  }

  for (const action of plan) {
    await prisma.$transaction(async (tx) => {
      for (const patientId of action.deletePatientIds) {
        await deletePatientWithRelations(patientId, tx);
      }
    });

    await logAudit(null, {
      action: "patient.duplicates_resolved",
      entity: "Patient",
      entityId: action.keepPatientId,
      metadata: {
        keptPatientId: action.keepPatientId,
        deletedPatientIds: action.deletePatientIds,
        reason: "duplicate_cleanup_script",
        selectionReason: action.reason,
      },
    });

    for (const patientId of action.deletePatientIds) {
      await logAudit(null, {
        action: "patient.deleted",
        entity: "Patient",
        entityId: patientId,
        metadata: {
          keptPatientId: action.keepPatientId,
          reason: "duplicate_cleanup_script",
        },
      });
      await logAudit(null, {
        action: "gdpr.erased",
        entity: "Patient",
        entityId: patientId,
        metadata: {
          keptPatientId: action.keepPatientId,
          reason: "duplicate_cleanup_script",
        },
      });
    }
  }

  console.log(`Deleted ${totalDeletes} duplicate patient records across ${plan.length} groups.`);
}

main()
  .catch((error) => {
    console.error("Duplicate cleanup failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });