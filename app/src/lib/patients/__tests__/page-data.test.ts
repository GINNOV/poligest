import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    doctor: { findMany: vi.fn() },
    patient: { findUnique: vi.fn() },
    consentModule: { findMany: vi.fn() },
    smsTemplate: { findUnique: vi.fn(), findMany: vi.fn() },
    user: { findFirst: vi.fn() },
    product: { findMany: vi.fn() },
    stockMovement: { findMany: vi.fn() },
    dentalRecord: { findMany: vi.fn() },
    auditLog: { findFirst: vi.fn() },
    smsLog: { findMany: vi.fn() },
  };
  const getAnamnesisConditions = vi.fn();
  const getOptionalPrismaModel = vi.fn();
  const normalizeItalianPhone = vi.fn();
  const renderWhatsappTemplate = vi.fn();

  return {
    prisma,
    getAnamnesisConditions,
    getOptionalPrismaModel,
    normalizeItalianPhone,
    renderWhatsappTemplate,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/anamnesis", () => ({
  getAnamnesisConditions: mocks.getAnamnesisConditions,
}));

vi.mock("@/lib/prisma-models", () => ({
  getOptionalPrismaModel: mocks.getOptionalPrismaModel,
}));

vi.mock("@/lib/phone", () => ({
  normalizeItalianPhone: mocks.normalizeItalianPhone,
}));

vi.mock("@/lib/whatsapp-template", () => ({
  WHATSAPP_TEMPLATE_NAME: "Whatsapp reminder",
  DEFAULT_WHATSAPP_TEMPLATE: "Default reminder",
  renderWhatsappTemplate: mocks.renderWhatsappTemplate,
}));

import { getPatientDetailPageData } from "@/lib/patients/page-data";

describe("patient page data", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAnamnesisConditions.mockResolvedValue(["Diabete", "Ipertensione"]);
    mocks.normalizeItalianPhone.mockReturnValue("+393331234567");
    mocks.renderWhatsappTemplate.mockReturnValue("Messaggio pronto");
    mocks.getOptionalPrismaModel.mockReturnValue({
      findMany: vi.fn().mockResolvedValue([{ id: "service-1", name: "Igiene", costBasis: 80 }]),
    });
  });

  it("returns an early null payload when the patient does not exist", async () => {
    mocks.prisma.doctor.findMany.mockResolvedValue([{ id: "doctor-1", fullName: "Dr. Bianchi" }]);
    mocks.prisma.patient.findUnique.mockResolvedValue(null);
    mocks.prisma.consentModule.findMany.mockResolvedValue([]);
    mocks.prisma.smsTemplate.findUnique.mockResolvedValue(null);

    const result = await getPatientDetailPageData("missing-patient");

    expect(result).toEqual({
      doctors: [{ id: "doctor-1", fullName: "Dr. Bianchi" }],
      patient: null,
      consentModules: [],
      whatsappTemplate: null,
      conditionsList: ["Diabete", "Ipertensione"],
    });
  });

  it("builds the patient detail payload from related records", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    const futureAppointment = {
      startsAt: new Date("2026-05-10T09:00:00.000Z"),
      serviceType: "Igiene",
      notes: "Portare radiografie",
      doctor: { fullName: "Dr. Verdi", specialty: "Igienista" },
    };
    const pastAppointment = {
      startsAt: new Date("2026-03-10T09:00:00.000Z"),
      serviceType: "Controllo",
      notes: null,
      doctor: { fullName: "Dr. Verdi", specialty: "Igienista" },
    };

    mocks.prisma.doctor.findMany.mockResolvedValue([{ id: "doctor-1", fullName: "Dr. Verdi" }]);
    mocks.prisma.patient.findUnique.mockResolvedValue({
      id: "patient-1",
      firstName: "Mario",
      lastName: "Rossi",
      email: "mario@example.com",
      phone: "3331234567",
      notes: [
        "Indirizzo: Via Roma 12, Milano",
        "Codice Fiscale: RSSMRA80A01H501U",
        "Anamnesi: Diabete, Ipertensione",
        "Farmaci: Tachipirina",
        "Note aggiuntive: Paziente ansioso",
      ].join("\n"),
      consents: [
        { moduleId: "consent-1", status: "GRANTED", module: { id: "consent-1", required: true } },
      ],
      appointments: [futureAppointment, pastAppointment],
    });
    mocks.prisma.consentModule.findMany.mockResolvedValue([
      { id: "consent-1", active: true, required: true, name: "Privacy" },
      { id: "consent-2", active: true, required: true, name: "Marketing" },
    ]);
    mocks.prisma.smsTemplate.findUnique.mockResolvedValue({
      name: "Whatsapp reminder",
      body: "Template body",
    });
    mocks.prisma.user.findFirst.mockResolvedValue({ personalPin: "1234" });
    mocks.prisma.product.findMany.mockResolvedValue([{ id: "product-1", name: "Impianto" }]);
    mocks.prisma.stockMovement.findMany.mockResolvedValue([{ id: "movement-1", product: { id: "product-1" } }]);
    mocks.prisma.dentalRecord.findMany.mockResolvedValue([
      {
        id: "record-1",
        performedAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-06T10:00:00.000Z"),
        updatedBy: { name: "Staff User", email: "staff@example.com" },
        treated: true,
      },
    ]);
    mocks.prisma.auditLog.findFirst
      .mockResolvedValueOnce({ id: "audit-access" })
      .mockResolvedValueOnce({ id: "audit-whatsapp" })
      .mockResolvedValueOnce({ id: "audit-created", user: { name: "Admin", email: "admin@example.com" } })
      .mockResolvedValueOnce({
        id: "audit-dental-record-updated",
        action: "patient.dental_record_note_updated",
        user: { name: "Manager", email: "manager@example.com" },
      });
    mocks.prisma.smsTemplate.findMany.mockResolvedValue([
      { id: "tpl-1", name: "Whatsapp reminder" },
      { id: "tpl-2", name: "Promemoria visita" },
    ]);
    mocks.prisma.smsLog.findMany.mockResolvedValue([{ id: "sms-1" }]);

    const result = await getPatientDetailPageData("patient-1");

    expect(mocks.renderWhatsappTemplate).toHaveBeenCalledWith("Template body", {
      firstName: "Mario",
      lastName: "Rossi",
      doctorName: "Dr. Verdi",
      appointmentDate: expect.any(String),
      serviceType: "Igiene",
      notes: "Portare radiografie",
    });
    expect(result.patientPin).toBe("1234");
    expect(result.patientPhone).toBe("+393331234567");
    expect(result.whatsappHref).toContain("whatsapp://send?phone=393331234567");
    expect(result.parsedAddress).toBe("Via Roma 12");
    expect(result.parsedCity).toBe("Milano");
    expect(result.parsedTaxId).toBe("RSSMRA80A01H501U");
    expect(result.parsedConditions).toEqual(["Diabete", "Ipertensione"]);
    expect(result.parsedMedications).toBe("Tachipirina");
    expect(result.parsedExtra).toBe("Paziente ansioso");
    expect(result.hasConsents).toBe(true);
    expect(result.missingRequired).toEqual([{ id: "consent-2", active: true, required: true, name: "Marketing" }]);
    expect(result.visibleSmsTemplates).toEqual([{ id: "tpl-2", name: "Promemoria visita" }]);
    expect(result.pastAppointments).toHaveLength(1);
    expect(mocks.prisma.auditLog.findFirst).toHaveBeenLastCalledWith({
      where: {
        entity: "Patient",
        entityId: "patient-1",
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
        user: { select: { name: true, email: true } },
      },
    });
    expect(result.dentalRecordsSerialized).toEqual([
      expect.objectContaining({
        id: "record-1",
        performedAt: "2026-04-05T10:00:00.000Z",
        updatedAt: "2026-04-06T10:00:00.000Z",
        updatedByName: "Staff User",
        treated: true,
      }),
    ]);
  });
});
