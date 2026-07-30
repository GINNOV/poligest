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
      taxId: true,
      createdAt: true,
    },
  });

  const groups = findPotentialPatientDuplicates(patients);
  const duplicatePatientIds = Array.from(
    new Set(groups.flatMap((group) => group.patients.map((patient) => patient.id))),
  );
  const counts = await loadFullAttachmentCounts(duplicatePatientIds);

  const safeActions = groups
    .map((group) => classifyDuplicateGroup(group, counts))
    .filter((classification) => classification.safe);

  const skipped = groups.length - safeActions.length;

  if (safeActions.length === 0) {
    console.log(
      skipped > 0
        ? `No safe empty-shell merge groups (${skipped} unsafe groups require manual review).`
        : "No duplicate groups found. Nothing to clean up.",
    );
    return;
  }

  const totalDeletes = safeActions.reduce((sum, action) => sum + action.deletePatientIds.length, 0);

  console.log(
    execute
      ? `Merging ${safeActions.length} safe groups (${totalDeletes} empty shells)...`
      : `Dry run: ${safeActions.length} safe groups, ${totalDeletes} empty shells would be merged/deleted (${skipped} unsafe skipped).`,
  );

  for (const action of safeActions) {
    console.log(
      `- Group ${action.groupId}: keep ${action.keepPatientId}, delete empty [${action.deletePatientIds.join(", ")}] (${action.reason})${action.autoEligible ? " [auto-eligible]" : ""}`,
    );
  }

  if (!execute) {
    console.log("Re-run with --execute to apply empty-shell merges only.");
    return;
  }

  let merged = 0;
  let deleted = 0;
  for (const action of safeActions) {
    const result = await mergeEmptyDuplicateShells({
      keepPatientId: action.keepPatientId,
      deletePatientIds: action.deletePatientIds,
      actor: null,
      trigger: "bulk",
    });
    if (result.ok) {
      merged += 1;
      deleted += result.deletedPatientIds.length;
    } else {
      console.warn(`Skipped ${action.groupId}: ${result.error}`);
    }
  }

  console.log(`Merged ${merged} groups, deleted ${deleted} empty shells.`);
}

main()
  .catch((error) => {
    console.error("Duplicate cleanup failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
