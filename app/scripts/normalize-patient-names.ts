import { prisma } from "../src/lib/prisma";
import { normalizePersonName } from "../src/lib/name";

async function main() {
  const patients = await prisma.patient.findMany({
    select: { id: true, firstName: true, lastName: true },
  });

  let updatedCount = 0;

  for (const patient of patients) {
    const normalizedFirstName = normalizePersonName(patient.firstName);
    const normalizedLastName = normalizePersonName(patient.lastName);

    if (normalizedFirstName === patient.firstName && normalizedLastName === patient.lastName) {
      continue;
    }

    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      },
    });
    updatedCount += 1;
  }

  console.log(`Normalized ${updatedCount} of ${patients.length} patient records.`);
}

main()
  .catch((error) => {
    console.error("Failed to normalize patient names.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
