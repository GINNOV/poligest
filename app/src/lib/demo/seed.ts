import { Prisma, Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { demoPrisma, livePrisma } from "@/lib/prisma-client";
import { forgetDemoMirror } from "@/lib/demo/realm";

const ODD: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};
const EVEN: Record<string, number> = {};
"0123456789".split("").forEach((char, index) => {
  EVEN[char] = index;
});
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((char, index) => {
  EVEN[char] = index;
});
const MONTHS = "ABCDEHLMPRST";

export function codiceFiscaleChecksum(first15: string) {
  let sum = 0;
  for (let index = 0; index < 15; index += 1) {
    const char = first15[index] ?? "";
    sum += index % 2 === 0 ? ODD[char] ?? 0 : EVEN[char] ?? 0;
  }
  return String.fromCharCode(65 + (sum % 26));
}

function nameCode(value: string, isFirstName: boolean) {
  const letters = value.toUpperCase().replace(/[^A-Z]/g, "");
  const consonants = [...letters].filter((char) => !"AEIOU".includes(char));
  const vowels = [...letters].filter((char) => "AEIOU".includes(char));
  if (isFirstName && consonants.length >= 4) {
    return consonants[0] + consonants[2] + consonants[3];
  }
  return (consonants.join("") + vowels.join("") + "XXX").slice(0, 3);
}

export function demoCodiceFiscale(input: {
  lastName: string;
  firstName: string;
  year: number;
  month: number;
  day: number;
  female?: boolean;
}) {
  const day = String(input.day + (input.female ? 40 : 0)).padStart(2, "0");
  const base =
    nameCode(input.lastName, false) +
    nameCode(input.firstName, true) +
    String(input.year).slice(-2) +
    MONTHS[input.month - 1] +
    day +
    "H501";
  return base + codiceFiscaleChecksum(base);
}

export const DEMO_ACCOUNTS = [
  {
    id: "demo_admin",
    email: "admin.demo@example.com",
    name: "Admin Dimostrativo",
    role: Role.ADMIN,
  },
  {
    id: "demo_secretary",
    email: "segreteria.demo@example.com",
    name: "Segreteria Dimostrativa",
    role: Role.SECRETARY,
  },
  {
    id: "demo_patient",
    email: "paziente.demo@example.com",
    name: "Elena Conti",
    role: Role.PATIENT,
  },
] as const;

export function generateDemoPassword() {
  return `Demo-${randomBytes(6).toString("base64url")}`;
}

const DOCTORS = [
  { id: "demo_doctor_giulia", fullName: "Dott.ssa Giulia Bianchi", specialty: "Odontoiatria" },
  { id: "demo_doctor_marco", fullName: "Dott. Marco Ferri", specialty: "Igiene dentale" },
] as const;

const PATIENTS = [
  { id: "demo_patient_elena", firstName: "Elena", lastName: "Conti", year: 1985, month: 3, day: 12, female: true, phone: "3330000001" },
  { id: "demo_patient_luca", firstName: "Luca", lastName: "Greco", year: 1979, month: 11, day: 4, female: false, phone: "3330000002" },
  { id: "demo_patient_sara", firstName: "Sara", lastName: "Fontana", year: 1992, month: 7, day: 23, female: true, phone: "3330000003" },
  { id: "demo_patient_matteo", firstName: "Matteo", lastName: "Riva", year: 1988, month: 1, day: 9, female: false, phone: "3330000004" },
  { id: "demo_patient_chiara", firstName: "Chiara", lastName: "Lombardi", year: 1996, month: 5, day: 30, female: true, phone: "3330000005" },
  { id: "demo_patient_davide", firstName: "Davide", lastName: "Greco", year: 1974, month: 9, day: 2, female: false, phone: "3330000006" },
  { id: "demo_patient_anna", firstName: "Anna", lastName: "Villa", year: 2001, month: 12, day: 15, female: true, phone: "3330000007" },
  { id: "demo_patient_paolo", firstName: "Paolo", lastName: "Serra", year: 1968, month: 6, day: 8, female: false, phone: "3330000008" },
] as const;

function atRome(dayOffset: number, hour: number, minute = 0) {
  const romeNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
  romeNow.setDate(romeNow.getDate() + dayOffset);
  romeNow.setHours(hour, minute, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(romeNow);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const guess = new Date(Date.UTC(read("year"), read("month") - 1, read("day"), read("hour") % 24, read("minute"), read("second")));
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const asUtc = Date.UTC(
    Number(formatted.find((part) => part.type === "year")?.value),
    Number(formatted.find((part) => part.type === "month")?.value) - 1,
    Number(formatted.find((part) => part.type === "day")?.value),
    Number(formatted.find((part) => part.type === "hour")?.value) % 24,
    Number(formatted.find((part) => part.type === "minute")?.value),
    Number(formatted.find((part) => part.type === "second")?.value),
  );
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

async function sharedPassword() {
  const existing = await livePrisma.user.findFirst({
    where: { isDemo: true, demoPassword: { not: null } },
    select: { demoPassword: true },
  });
  return existing?.demoPassword || process.env.DEMO_ACCOUNT_PASSWORD || generateDemoPassword();
}

export async function mirrorDemoAccount(userId: string) {
  const user = await livePrisma.user.findUnique({ where: { id: userId } });
  if (!user?.isDemo) return;
  const data = {
    email: user.email,
    name: user.name,
    hashedPassword: user.hashedPassword,
    role: user.role,
    locale: user.locale,
    isActive: user.isActive,
    avatarUrl: user.avatarUrl,
    personalPin: user.personalPin,
    gender: user.gender,
    isDemo: true,
    demoPassword: user.demoPassword,
    lastLoginAt: user.lastLoginAt,
  };
  await demoPrisma.user.upsert({
    where: { id: user.id },
    create: { id: user.id, ...data },
    update: data,
  });
  forgetDemoMirror(user.id);
}

export async function ensureDemoAccounts() {
  const password = await sharedPassword();
  for (const account of DEMO_ACCOUNTS) {
    const existing = await livePrisma.user.findUnique({ where: { email: account.email }, select: { id: true, isDemo: true } });
    if (existing && !existing.isDemo) {
      throw new Error(`${account.email} appartiene allo studio vero e non può diventare un account dimostrativo.`);
    }
    if (existing && existing.id !== account.id) {
      throw new Error(`${account.email} esiste già con un identificativo diverso.`);
    }
    await livePrisma.user.upsert({
      where: { email: account.email },
      create: {
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
        hashedPassword: "",
        isDemo: true,
        demoPassword: password,
        locale: "it",
      },
      update: {
        name: account.name,
        role: account.role,
        isDemo: true,
        isActive: true,
        demoPassword: password,
      },
    });
  }
  const accounts = await livePrisma.user.findMany({ where: { isDemo: true } });
  for (const account of accounts) {
    await mirrorDemoAccount(account.id);
  }
  return password;
}

export async function seedDemoClinic() {
  await livePrisma.$executeRawUnsafe("SELECT sync_demo_schema()");
  const password = await ensureDemoAccounts();
  await livePrisma.$executeRawUnsafe(`
    DO $$
    DECLARE rec RECORD;
    BEGIN
      FOR rec IN SELECT tablename FROM pg_tables WHERE schemaname = 'demo' AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE demo.%I CASCADE', rec.tablename);
      END LOOP;
    END $$;
  `);
  for (const account of await livePrisma.user.findMany({ where: { isDemo: true } })) {
    forgetDemoMirror(account.id);
    await mirrorDemoAccount(account.id);
  }

  const db = demoPrisma;
  await db.practiceSetting.upsert({
    where: { id: "default" },
    create: { id: "default", timeZone: "Europe/Rome" },
    update: { timeZone: "Europe/Rome" },
  });
  await db.consentModule.create({
    data: {
      id: "demo_consent",
      name: "Consenso informato dimostrativo",
      content: "Testo di esempio per lo studio dimostrativo. Non ha valore per pazienti reali.",
      required: true,
      sortOrder: 1,
    },
  });
  await db.anamnesisCondition.createMany({
    data: [
      { id: "demo_anam_1", label: "Ipertensione" },
      { id: "demo_anam_2", label: "Diabete" },
      { id: "demo_anam_3", label: "Allergie a farmaci" },
    ],
  });
  await db.service.createMany({
    data: [
      { id: "demo_service_visit", name: "Visita di controllo", description: "Controllo periodico", costBasis: new Prisma.Decimal("60.00") },
      { id: "demo_service_hygiene", name: "Igiene dentale", description: "Pulizia professionale", costBasis: new Prisma.Decimal("80.00") },
      { id: "demo_service_filling", name: "Otturazione", description: "Otturazione in composito", costBasis: new Prisma.Decimal("120.00") },
    ],
  });
  await db.emailTemplate.create({
    data: {
      id: "demo_email_reminder",
      name: "appointment-reminder",
      subject: "Promemoria appuntamento {{appointmentDate}}",
      body: "Ciao {{patientName}}, questo è un promemoria dimostrativo.",
      category: "Promemoria",
      description: "Template dimostrativo",
    },
  });
  await db.smsTemplate.create({
    data: {
      id: "demo_sms_reminder",
      name: "promemoria-demo",
      body: "Promemoria dimostrativo per {{patientName}}. Nessun messaggio reale viene inviato.",
    },
  });
  await db.dailyReminderConfig.upsert({
    where: { id: "default" },
    create: { id: "default", enabled: false, bccEmail: "segreteria.demo@example.com" },
    update: { enabled: false, bccEmail: "segreteria.demo@example.com" },
  });
  await db.practiceWeeklyReportConfig.upsert({
    where: { id: "default" },
    create: { id: "default", enabled: false, recipientEmails: "admin.demo@example.com" },
    update: { enabled: false, recipientEmails: "admin.demo@example.com" },
  });

  for (const doctor of DOCTORS) {
    await db.doctor.create({ data: doctor });
    await db.doctorAvailabilityWindow.createMany({
      data: [1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
        { doctorId: doctor.id, dayOfWeek, startMinute: 9 * 60, endMinute: 13 * 60 },
        { doctorId: doctor.id, dayOfWeek, startMinute: 14 * 60, endMinute: 18 * 60 },
      ]),
    });
  }

  for (const patient of PATIENTS) {
    await db.patient.create({
      data: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.id === "demo_patient_elena" ? "paziente.demo@example.com" : `${patient.firstName}.${patient.lastName}@example.com`.toLowerCase(),
        phone: patient.phone,
        gender: patient.female ? "FEMALE" : "MALE",
        birthDate: new Date(Date.UTC(patient.year, patient.month - 1, patient.day)),
        taxId: demoCodiceFiscale(patient),
        notes: "Paziente dimostrativo. Dati inventati.",
      },
    });
  }

  const visits: Array<{ id: string; patientId: string; doctorId: string; dayOffset: number; hour: number; service: string; status: "CONFIRMED" | "COMPLETED" | "TO_CONFIRM" }> = [
    { id: "demo_appt_1", patientId: "demo_patient_elena", doctorId: "demo_doctor_giulia", dayOffset: 0, hour: 9, service: "Visita di controllo", status: "CONFIRMED" },
    { id: "demo_appt_2", patientId: "demo_patient_luca", doctorId: "demo_doctor_marco", dayOffset: 0, hour: 10, service: "Igiene dentale", status: "CONFIRMED" },
    { id: "demo_appt_3", patientId: "demo_patient_sara", doctorId: "demo_doctor_giulia", dayOffset: 1, hour: 11, service: "Otturazione", status: "TO_CONFIRM" },
    { id: "demo_appt_4", patientId: "demo_patient_matteo", doctorId: "demo_doctor_marco", dayOffset: 1, hour: 15, service: "Igiene dentale", status: "CONFIRMED" },
    { id: "demo_appt_5", patientId: "demo_patient_chiara", doctorId: "demo_doctor_giulia", dayOffset: -7, hour: 9, service: "Visita di controllo", status: "COMPLETED" },
  ];
  for (const visit of visits) {
    const startsAt = atRome(visit.dayOffset, visit.hour);
    await db.appointment.create({
      data: {
        id: visit.id,
        title: visit.service,
        serviceType: visit.service,
        status: visit.status,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        notes: "Appuntamento dimostrativo.",
      },
    });
  }

  await db.clinicalNote.create({
    data: {
      id: "demo_note_1",
      patientId: "demo_patient_elena",
      doctorId: "demo_doctor_giulia",
      content: "Controllo dimostrativo: igiene buona, prossimo richiamo tra sei mesi.",
    },
  });

  const signedAt = atRome(-7, 9, 30);
  await db.quote.create({
    data: {
      id: "demo_quote_1",
      patientId: "demo_patient_elena",
      serviceId: "demo_service_filling",
      serviceName: "Otturazione",
      serviceDate: signedAt,
      quantity: 1,
      price: new Prisma.Decimal("120.00"),
      total: new Prisma.Decimal("120.00"),
      signatureUrl: "firma-dimostrativa",
      signedAt,
      items: {
        create: {
          id: "demo_quote_item_1",
          serviceId: "demo_service_filling",
          serviceName: "Otturazione",
          serviceDate: signedAt,
          quantity: 1,
          price: new Prisma.Decimal("120.00"),
          total: new Prisma.Decimal("120.00"),
        },
      },
    },
  });
  await db.patientPayment.create({
    data: {
      id: "demo_payment_1",
      patientId: "demo_patient_elena",
      quoteId: "demo_quote_1",
      quoteItemId: "demo_quote_item_1",
      amount: new Prisma.Decimal("50.00"),
      paidAt: atRome(-6, 10),
      method: "ELECTRONIC",
      note: "Acconto dimostrativo",
      userId: "demo_secretary",
    },
  });

  await db.recallRule.create({
    data: {
      id: "demo_recall_rule",
      name: "Controllo semestrale",
      serviceType: "Visita di controllo",
      intervalDays: 180,
      channel: "EMAIL",
      message: "È il momento del controllo dimostrativo.",
      emailSubject: "Richiamo dimostrativo",
    },
  });
  await db.recall.createMany({
    data: [
      { id: "demo_recall_1", patientId: "demo_patient_elena", ruleId: "demo_recall_rule", dueAt: atRome(14, 9), status: "PENDING" },
      { id: "demo_recall_2", patientId: "demo_patient_chiara", ruleId: "demo_recall_rule", dueAt: atRome(21, 9), status: "PENDING" },
    ],
  });

  await db.supplier.create({
    data: { id: "demo_supplier", name: "Forniture Dimostrative", email: "forniture@example.com", phone: "3330000099" },
  });
  await db.product.create({
    data: {
      id: "demo_product_gloves",
      name: "Guanti in nitrile",
      sku: "DEMO-GUANTI",
      unitCost: new Prisma.Decimal("8.50"),
      minThreshold: 2,
      supplierId: "demo_supplier",
    },
  });
  await db.stockMovement.create({
    data: {
      id: "demo_stock_1",
      productId: "demo_product_gloves",
      quantity: 10,
      movement: "IN",
      note: "Carico dimostrativo",
      userId: "demo_secretary",
    },
  });
  await db.auditLog.create({
    data: {
      id: "demo_audit_1",
      action: "demo.seed",
      entity: "System",
      entityId: "demo",
      userId: "demo_admin",
      role: Role.ADMIN,
      metadata: { note: "Studio dimostrativo pronto" },
    },
  });

  return { password };
}

export async function resetDemoClinic() {
  return seedDemoClinic();
}
