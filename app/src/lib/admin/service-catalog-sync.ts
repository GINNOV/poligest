import { prisma } from "@/lib/prisma";
import { formatServiceName } from "@/lib/service-name";

export async function syncServiceCatalogFormatting() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const updates = services.flatMap((service) => {
    const formattedName = formatServiceName(service.name);
    return formattedName !== service.name ? [{ id: service.id, formattedName }] : [];
  });

  if (updates.length === 0) {
    return { updatedCount: 0 };
  }

  await prisma.$transaction(
    updates.map((entry) =>
      prisma.service.update({
        where: { id: entry.id },
        data: { name: entry.formattedName },
      }),
    ),
  );

  return { updatedCount: updates.length };
}