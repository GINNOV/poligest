/* eslint-disable @typescript-eslint/no-require-imports */

const { hash } = require("bcryptjs");
const { PrismaClient, Role, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD || "SORRIDI!123"; // Cambia in produzione
  const hashedPassword = await hash(password, 12);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@poligest.local";
  const managerEmail =
    process.env.SEED_MANAGER_EMAIL || "manager@poligest.local";
  const secretaryEmail =
    process.env.SEED_SECRETARY_EMAIL || "segreteria@poligest.local";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      hashedPassword,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: "Amministratore",
      role: Role.ADMIN,
      locale: "it",
      hashedPassword,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {
      hashedPassword,
      isActive: true,
    },
    create: {
      email: managerEmail,
      name: "Responsabile Clinica",
      role: Role.MANAGER,
      locale: "it",
      hashedPassword,
    },
  });

  await prisma.user.upsert({
    where: { email: secretaryEmail },
    update: {
      hashedPassword,
      isActive: true,
    },
    create: {
      email: secretaryEmail,
      name: "Segreteria",
      role: Role.SECRETARY,
      locale: "it",
      hashedPassword,
    },
  });

  const doctor =
    (await prisma.doctor.findFirst({
      where: { userId: manager.id },
    })) ||
    (await prisma.doctor.create({
      data: {
        userId: manager.id,
        fullName: "Dr. Responsabile",
        specialty: "Odontoiatria",
        color: "#059669",
      },
    }));

  const patient =
    (await prisma.patient.findFirst({
      where: { email: "paziente.demo@poligest.local" },
    })) ||
    (await prisma.patient.create({
      data: {
        firstName: "Paziente",
        lastName: "Demo",
        email: "paziente.demo@poligest.local",
        phone: "+3900000000",
        notes: "Anagrafica di esempio per test agenda.",
      },
    }));

  await prisma.consent.upsert({
    where: {
      patientId_type: {
        patientId: patient.id,
        type: "PRIVACY",
      },
    },
    update: {},
    create: {
      patientId: patient.id,
      type: "PRIVACY",
      status: "GRANTED",
      channel: "firmato",
    },
  });

  await prisma.appointment.create({
    data: {
      title: "Visita di controllo",
      status: "CONFIRMED",
      serviceType: "Controllo",
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      patientId: patient.id,
      doctorId: doctor.id,
      notes: "Appuntamento di esempio per agenda.",
    },
  });

  const supplier =
    (await prisma.supplier.findFirst()) ||
    (await prisma.supplier.create({
      data: {
        name: "Fornitore Medicale",
        email: "fornitore@poligest.local",
        phone: "+39000000001",
        notes: "Fornitore demo per materiali.",
      },
    }));

  const product =
    (await prisma.product.findFirst()) ||
    (await prisma.product.create({
      data: {
        name: "Mascherine chirurgiche",
        sku: "MASK-001",
        unitCost: new Prisma.Decimal("0.25"),
        minThreshold: 100,
        supplierId: supplier.id,
      },
    }));

  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      quantity: 500,
      movement: "IN",
      note: "Carico iniziale magazzino",
      userId: admin.id,
    },
  });

  await prisma.financeEntry.create({
    data: {
      type: "EXPENSE",
      description: "Materiale di consumo",
      amount: new Prisma.Decimal("125.00"),
      occurredAt: new Date(),
      doctorId: doctor.id,
      userId: manager.id,
    },
  });

  await prisma.cashAdvance.create({
    data: {
      doctorId: doctor.id,
      amount: new Prisma.Decimal("300.00"),
      issuedAt: new Date(),
      note: "Anticipo su compensi",
      userId: admin.id,
    },
  });

  const recallRule =
    (await prisma.recallRule.findFirst()) ||
    (await prisma.recallRule.create({
      data: {
        name: "Igiene semestrale",
        serviceType: "Igiene",
        intervalDays: 180,
        message: "Promemoria visita di igiene programmata.",
      },
    }));

  const dueAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  const existingRecall = await prisma.recall.findFirst({
    where: { patientId: patient.id, ruleId: recallRule.id, dueAt },
  });
  if (!existingRecall) {
    await prisma.recall.create({
      data: {
        patientId: patient.id,
        ruleId: recallRule.id,
        dueAt,
        status: "PENDING",
        notes: "Promemoria demo",
      },
    });
  }

  console.log("Seed completato. Admin:", admin.email);
}

main()
  .catch((error) => {
    console.error("Seed fallito:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
