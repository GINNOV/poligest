import { Prisma, Role } from "@prisma/client";
import { getAnamnesisConditions } from "@/lib/anamnesis";
import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { prisma } from "@/lib/prisma";
import { normalizeItalianPhone } from "@/lib/phone";
import { DEFAULT_WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_NAME, renderWhatsappTemplate } from "@/lib/whatsapp-template";
type ServiceOptionRecord = {
  id: string;
  name: string;
  costBasis: Prisma.Decimal | number;
};

export async function getPatientDetailPageData(patientId: string) {
  const [doctors, patient, consentModules, whatsappTemplate] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        consents: {
          include: { module: true },
          orderBy: { givenAt: "desc" },
        },
        appointments: {
          orderBy: { startsAt: "desc" },
          take: 5,
          include: {
            doctor: { select: { fullName: true, specialty: true } },
          },
        },
      },
    }),
    prisma.consentModule.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.smsTemplate.findUnique({
      where: { name: WHATSAPP_TEMPLATE_NAME },
    }),
  ]);
  const conditionsList = await getAnamnesisConditions();

  if (!patient) {
    return { doctors, patient: null, consentModules, whatsappTemplate, conditionsList } as const;
  }

  const patientUser = patient.email
    ? await prisma.user.findFirst({
        where: { email: patient.email, role: Role.PATIENT },
        select: { personalPin: true },
      })
    : null;
  const patientPin = patientUser?.personalPin ?? "—";
  const patientPhone = normalizeItalianPhone(patient.phone);
  const whatsappPhone = patientPhone ? patientPhone.replace(/^\+/, "") : null;
  const upcomingAppointment =
    patient.appointments.find((appt) => appt.startsAt > new Date()) ?? patient.appointments[0];
  const appointmentDoctor = upcomingAppointment?.doctor?.fullName ?? "da definire";
  const whatsappAppointmentDate = upcomingAppointment
    ? new Intl.DateTimeFormat("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(upcomingAppointment.startsAt)
    : "da definire";
  const whatsappMessage = renderWhatsappTemplate(
    whatsappTemplate?.body ?? DEFAULT_WHATSAPP_TEMPLATE,
    {
      firstName: patient.firstName ?? "",
      lastName: patient.lastName ?? "",
      doctorName: appointmentDoctor,
      appointmentDate: whatsappAppointmentDate,
      serviceType: upcomingAppointment?.serviceType ?? "",
      notes: upcomingAppointment?.notes ?? "",
    }
  );
  const whatsappHref = whatsappPhone
    ? `whatsapp://send?phone=${whatsappPhone}&text=${encodeURIComponent(whatsappMessage)}`
    : null;

  const {
    parsedAddress,
    parsedCity,
    parsedTaxId,
    parsedConditions,
    parsedMedications,
    parsedExtra,
  } = parsePatientStructuredNotes(patient.notes);

  const serviceClient = getOptionalPrismaModel<{
    findMany?: (args?: { orderBy?: { createdAt?: "asc" | "desc" } }) => Promise<ServiceOptionRecord[]>;
  }>("service");
  const [products, implants, dentalRecords, services, lastAccessEmailLog, lastWhatsappLog, smsTemplates, smsLogs, createdLog, updatedLog] =
    await Promise.all([
      prisma.product.findMany({
        orderBy: { name: "asc" },
        include: { supplier: true },
      }),
      prisma.stockMovement.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        include: { product: { include: { supplier: true } } },
        take: 50,
      }),
      prisma.dentalRecord.findMany({
        where: { patientId },
        orderBy: { performedAt: "desc" },
        include: { updatedBy: { select: { name: true, email: true } } },
      }),
      serviceClient?.findMany ? serviceClient.findMany({ orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
      prisma.auditLog.findFirst({
        where: { action: "patient.access_email_sent", entity: "Patient", entityId: patientId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.findFirst({
        where: { action: "patient.whatsapp_reminder_sent", entity: "Patient", entityId: patientId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.smsTemplate.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.smsLog.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { template: true },
      }),
      prisma.auditLog.findFirst({
        where: { action: "patient.created", entity: "Patient", entityId: patientId },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
          role: true,
          metadata: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.findFirst({
        where: {
          entity: "Patient",
          entityId: patientId,
          action: {
            notIn: [
              "patient.created",
              "patient.access_email_sent",
              "patient.whatsapp_reminder_sent",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          role: true,
          metadata: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

  const pastAppointments = patient.appointments
    .filter((appt) => appt.startsAt < new Date())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const dentalRecordsSerialized = dentalRecords.map((record) => ({
    ...record,
    performedAt: record.performedAt.toISOString(),
    updatedAt: record.updatedAt?.toISOString?.() ?? null,
    updatedByName: record.updatedBy?.name ?? record.updatedBy?.email ?? null,
    treated: record.treated ?? false,
  }));
  const requiredModules = consentModules.filter((module) => module.active && module.required);
  const missingRequired = requiredModules.filter(
    (module) => !patient.consents.some((consent) => consent.moduleId === module.id),
  );
  const visibleSmsTemplates = smsTemplates.filter((template) => template.name !== WHATSAPP_TEMPLATE_NAME);

  return {
    doctors,
    patient,
    consentModules,
    whatsappTemplate,
    conditionsList,
    patientPin,
    patientPhone,
    whatsappHref,
    hasConsents: patient.consents.length > 0,
    parsedAddress,
    parsedCity,
    parsedTaxId,
    parsedConditions,
    parsedMedications,
    parsedExtra,
    products,
    implants,
    dentalRecordsSerialized,
    services,
    pastAppointments,
    missingRequired,
    smsTemplates,
    smsLogs,
    visibleSmsTemplates,
    lastAccessEmailLog,
    lastWhatsappLog,
    createdLog,
    updatedLog,
  };
}
