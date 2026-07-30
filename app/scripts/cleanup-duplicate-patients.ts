import { prisma } from "../src/lib/prisma";
import { findPotentialPatientDuplicates } from "../src/lib/patients/duplicate-detection";
import { loadFullAttachmentCounts } from "../src/lib/patients/duplicate-attachments";
import { classifyDuplicateGroup } from "../src/lib/patients/duplicate-merge-plan";
import { mergeEmptyDuplicateShells } from "../src/lib/patients/duplicate-merge";

const execute = process.argv.includes("--execute");

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
  if (groups.length === 0) {
    console.log("No duplicate groups found. Nothing to clean up.");
    return;
  }

  const duplicatePatientIds = Array.from(
    new Set(groups.flatMap((group) => group.patients.map((patient) => patient.id))),
  );
  const attachmentCountsByPatientId = await loadFullAttachmentCounts(duplicatePatientIds);

  const classified = groups
    .filter((group) => group.patients.length > 1)
    .map((group) => classifyDuplicateGroup(group, attachmentCountsByPatientId));

  const safeActions = classified.filter(
    (action) => action.safe && action.deletePatientIds.length > 0,
  );
  const skipped = classified.filter(
    (action) => !action.safe || action.deletePatientIds.length === 0,
  );
  const totalDeletes = safeActions.reduce(
    (sum, action) => sum + action.deletePatientIds.length,
    0,
  );

  console.log(
    execute
      ? `Executing empty-shell merge for ${safeActions.length} safe groups (${totalDeletes} deletions); skipping ${skipped.length} unsafe/non-actionable groups...`
      : `Dry run: ${classified.length} duplicate groups — ${safeActions.length} safe (${totalDeletes} empty shells would be merged), ${skipped.length} skipped (not safe / no deletes).`,
  );

  for (const action of classified) {
    const deleteList = action.deletePatientIds.join(", ") || "(none)";
    console.log(
      `- Group ${action.groupId}: keep ${action.keepPatientId}, delete [${deleteList}] ` +
        `safe=${action.safe} autoEligible=${action.autoEligible} (${action.reason})`,
    );
    if (!action.safe) {
      console.log(
        `  → skip: one or more losers are not empty shells (will not delete non-empty patients)`,
      );
    }
  }

  if (!execute) {
    console.log(
      "Re-run with --execute to merge only safe empty-shell groups (field-fill + delete empty losers).",
    );
    return;
  }

  let merged = 0;
  let deleted = 0;
  const errors: string[] = [];

  for (const action of safeActions) {
    const result = await mergeEmptyDuplicateShells({
      keepPatientId: action.keepPatientId,
      deletePatientIds: action.deletePatientIds,
      actor: null,
      trigger: "bulk",
      requireStrong: false,
    });

    if (result.ok) {
      merged += 1;
      deleted += result.deletedPatientIds.length;
      console.log(
        `  ✓ merged group ${action.groupId}: deleted ${result.deletedPatientIds.length}` +
          (result.filledFields.length
            ? `, filled [${result.filledFields.join(", ")}]`
            : ""),
      );
    } else {
      errors.push(`${action.groupId}: ${result.error} (${result.code})`);
      console.log(`  ✗ group ${action.groupId}: ${result.error} (${result.code})`);
    }
  }

  console.log(
    `Done. Merged ${merged} groups, deleted ${deleted} empty shells, skipped ${skipped.length}, errors ${errors.length}.`,
  );

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Duplicate cleanup failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
