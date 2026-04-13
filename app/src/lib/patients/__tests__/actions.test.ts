import { beforeEach, describe, expect, it, vi } from "vitest";
import { Gender, Role } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const logAudit = vi.fn();
  const revalidatePath = vi.fn();
  const redirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  const put = vi.fn();
  const sharp = vi.fn();
  const prisma = {
    $transaction: vi.fn(),
    patient: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    dentalRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    quote: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    quoteItem: {
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  };
  const pickRandomSystemAvatar = vi.fn();
  const pickSystemAvatar = vi.fn();
  const isSystemAvatar = vi.fn();

  return {
    requireUser,
    logAudit,
    revalidatePath,
    redirect,
    put,
    sharp,
    prisma,
    pickRandomSystemAvatar,
    pickSystemAvatar,
    isSystemAvatar,
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.put,
}));

vi.mock("sharp", () => ({
  default: mocks.sharp,
}));

vi.mock("@/lib/patient-avatars", () => ({
  isSystemAvatar: mocks.isSystemAvatar,
  pickRandomSystemAvatar: mocks.pickRandomSystemAvatar,
  pickSystemAvatar: mocks.pickSystemAvatar,
}));

vi.mock("@/lib/email", () => ({
  sendEmailWithHtml: vi.fn(),
}));

vi.mock("@/lib/sms", () => ({
  sendSms: vi.fn(),
}));

vi.mock("@/lib/stack-app", () => ({
  stackServerApp: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

import { resetPhotoAction, updatePatientAction, uploadPhotoAction } from "@/lib/patients/actions";
import { savePreventivoAction } from "@/lib/patients/actions";

describe("patient actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      role: Role.ADMIN,
    });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.revalidatePath.mockReturnValue(undefined);
    mocks.put.mockResolvedValue({ url: "https://blob.test/patient-photo.jpg" });
    mocks.pickRandomSystemAvatar.mockReturnValue("https://avatar.test/random.jpg");
    mocks.pickSystemAvatar.mockReturnValue("https://avatar.test/female.jpg");
    mocks.isSystemAvatar.mockReturnValue(false);
    mocks.prisma.patient.findUnique.mockResolvedValue(null);
    mocks.prisma.patient.update.mockResolvedValue(undefined);
    mocks.prisma.service.findMany.mockResolvedValue([]);
    mocks.prisma.service.findFirst.mockResolvedValue(null);
    mocks.prisma.dentalRecord.findMany.mockResolvedValue([]);
    mocks.prisma.dentalRecord.findFirst.mockResolvedValue(null);
    mocks.prisma.quote.create.mockResolvedValue({ id: "quote-created" });
    mocks.prisma.quote.findFirst.mockResolvedValue(null);
    mocks.prisma.quote.findUnique.mockResolvedValue(null);
    mocks.prisma.quote.findUniqueOrThrow.mockResolvedValue({ id: "quote-created" });
    mocks.prisma.quote.update.mockResolvedValue(undefined);
    mocks.prisma.quoteItem.create.mockResolvedValue(undefined);
    mocks.prisma.quoteItem.delete.mockResolvedValue(undefined);
    mocks.prisma.quoteItem.update.mockResolvedValue(undefined);
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.prisma) => unknown) => callback(mocks.prisma));

    const toBuffer = vi.fn().mockResolvedValue(Buffer.from("resized-image"));
    const jpeg = vi.fn(() => ({ toBuffer }));
    const resize = vi.fn(() => ({ jpeg, toBuffer }));
    mocks.sharp.mockReturnValue({ resize, jpeg, toBuffer });
  });

  it("uploads and stores a resized patient photo", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("photo", new File([Buffer.from("raw-image")], "photo.png", { type: "image/png" }));

    await uploadPhotoAction(formData);

    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: { photoUrl: "https://blob.test/patient-photo.jpg" },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
      expect.objectContaining({
        action: "patient.photo_uploaded",
        entityId: "patient-1",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/patient-1");
  });

  it("resets the stored patient photo", async () => {
    const formData = new FormData();
    formData.set("patientId", "patient-9");

    await resetPhotoAction(formData);

    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-9" },
      data: { photoUrl: null },
    });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "patient.photo_reset",
        entityId: "patient-9",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/patient-9");
  });

  it("updates structured patient fields and redirects back to the contact panel", async () => {
    mocks.prisma.patient.findUnique.mockResolvedValue({
      notes: [
        "Promemoria personalizzato",
        "Indirizzo: Via vecchia 1, Roma",
        "Note: Da rimuovere",
      ].join("\n"),
      photoUrl: null,
      gender: Gender.MALE,
    });

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("firstName", "maria");
    formData.set("lastName", "rossi");
    formData.set("email", "MARIA@example.com");
    formData.set("phone", "333 123 4567");
    formData.set("address", "Via Roma 12");
    formData.set("city", "Milano");
    formData.set("taxId", "RSSMRA80A01H501U");
    formData.set("gender", Gender.FEMALE);
    formData.append("conditions", "Diabete");
    formData.append("conditions", "Ipertensione");
    formData.set("medications", "Tachipirina");
    formData.set("extraNotes", "Paziente ansiosa");
    formData.set("birthDate", "1980-01-01");

    await expect(updatePatientAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/pazienti/patient-1?openContact=1",
    );

    expect(mocks.pickSystemAvatar).toHaveBeenCalledWith("patient-1", Gender.FEMALE);
    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: expect.objectContaining({
        firstName: "Maria",
        lastName: "Rossi",
        email: "maria@example.com",
        phone: "+393331234567",
        gender: Gender.FEMALE,
        photoUrl: "https://avatar.test/female.jpg",
        birthDate: new Date("1980-01-01"),
        notes: [
          "Promemoria personalizzato",
          "Indirizzo: Via Roma 12, Milano",
          "Codice Fiscale: RSSMRA80A01H501U",
          "Anamnesi: Diabete, Ipertensione",
          "Farmaci: Tachipirina",
          "Note aggiuntive: Paziente ansiosa",
        ].join("\n"),
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/pazienti/patient-1");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/pazienti");
    expect(mocks.redirect).toHaveBeenCalledWith("/pazienti/patient-1?openContact=1");
  });

  it("adds dental procedures from the diary when creating a quote after the mouth view was already updated", async () => {
    mocks.prisma.service.findMany.mockResolvedValue([{ id: "service-manual", name: "Prima visita" }]);
    mocks.prisma.quote.create.mockResolvedValue({ id: "quote-created" });
    mocks.prisma.quote.findFirst
      .mockResolvedValueOnce({
        id: "quote-created",
        patientId: "patient-1",
        items: [],
      })
      .mockResolvedValueOnce({
        id: "quote-created",
        patientId: "patient-1",
        items: [
          {
            id: "qi-auto",
            dentalRecordId: "record-1",
            serviceId: "service-auto",
            serviceName: "Otturazione",
            quantity: 1,
            price: { toString: () => "80.00" },
            total: { toString: () => "80.00" },
            saldato: false,
            payments: [],
          },
          {
            id: "qi-manual",
            dentalRecordId: null,
            serviceId: "service-manual",
            serviceName: "Prima visita",
            quantity: 1,
            price: { toString: () => "120.00" },
            total: { toString: () => "120.00" },
            saldato: false,
            payments: [],
          },
        ],
      });
    mocks.prisma.quote.findUnique.mockResolvedValue({
      id: "quote-created",
      items: [
        {
          id: "qi-manual",
          serviceId: "service-manual",
          serviceName: "Prima visita",
          serviceDate: new Date("2026-04-10T12:00:00.000Z"),
          quantity: 1,
          price: { toString: () => "120.00" },
          total: { toString: () => "120.00" },
        },
        {
          id: "qi-auto",
          serviceId: "service-auto",
          serviceName: "Otturazione",
          serviceDate: new Date("2026-04-10T10:00:00.000Z"),
          quantity: 1,
          price: { toString: () => "80.00" },
          total: { toString: () => "80.00" },
        },
      ],
    });
    mocks.prisma.dentalRecord.findMany.mockResolvedValue([{ id: "record-1" }]);
    mocks.prisma.dentalRecord.findFirst = vi.fn().mockResolvedValue({
      id: "record-1",
      treated: false,
      procedure: "Otturazione",
      performedAt: new Date("2026-04-10T10:00:00.000Z"),
    });
    mocks.prisma.service.findFirst = vi.fn().mockResolvedValue({
      id: "service-auto",
      name: "Otturazione",
      costBasis: { toString: () => "80.00" },
    });

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("itemsJson", JSON.stringify([
      {
        serviceId: "service-manual",
        serviceDate: "2026-04-10",
        quantity: 1,
        price: 120,
      },
    ]));
    formData.set("existingQuoteSignatureUrl", "https://blob.test/signature.png");

    const result = await savePreventivoAction({ savedAt: 0 }, formData);

    expect(result.savedAt).toEqual(expect.any(Number));
    expect(mocks.prisma.quoteItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quoteId: "quote-created",
        dentalRecordId: "record-1",
        serviceId: "service-auto",
        serviceName: "Otturazione",
      }),
    });
    expect(mocks.prisma.quote.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "quote-created" },
    });
  });

  it("re-adds diary dental procedures when an older accounting form saves a stale quote", async () => {
    mocks.prisma.service.findMany.mockResolvedValue([{ id: "service-manual", name: "Prima visita" }]);
    mocks.prisma.quote.findFirst
      .mockResolvedValueOnce({
        id: "quote-1",
        patientId: "patient-1",
        items: [
          {
            id: "qi-manual",
            dentalRecordId: null,
            serviceId: "service-manual",
            serviceName: "Prima visita",
            quantity: 1,
            price: { toString: () => "120.00" },
            total: { toString: () => "120.00" },
            saldato: false,
          },
          {
            id: "qi-linked",
            dentalRecordId: "record-1",
            serviceId: "service-auto",
            serviceName: "Otturazione",
            quantity: 1,
            price: { toString: () => "80.00" },
            total: { toString: () => "80.00" },
            saldato: false,
            payments: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "quote-1",
        patientId: "patient-1",
        items: [
          {
            id: "qi-manual",
            dentalRecordId: null,
            serviceId: "service-manual",
            serviceName: "Prima visita",
            quantity: 1,
            price: { toString: () => "120.00" },
            total: { toString: () => "120.00" },
            saldato: false,
            payments: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "quote-1",
        patientId: "patient-1",
        items: [
          {
            id: "qi-manual",
            dentalRecordId: null,
            serviceId: "service-manual",
            serviceName: "Prima visita",
            quantity: 1,
            price: { toString: () => "120.00" },
            total: { toString: () => "120.00" },
            saldato: false,
            payments: [],
          },
          {
            id: "qi-recreated",
            dentalRecordId: "record-1",
            serviceId: "service-auto",
            serviceName: "Otturazione",
            quantity: 1,
            price: { toString: () => "80.00" },
            total: { toString: () => "80.00" },
            saldato: false,
            payments: [],
          },
        ],
      });
    mocks.prisma.dentalRecord.findMany.mockResolvedValue([{ id: "record-1" }]);
    mocks.prisma.quote.findUnique.mockResolvedValue({
      id: "quote-1",
      items: [
        {
          id: "qi-manual",
          serviceId: "service-manual",
          serviceName: "Prima visita",
          serviceDate: new Date("2026-04-10T12:00:00.000Z"),
          quantity: 1,
          price: { toString: () => "120.00" },
          total: { toString: () => "120.00" },
        },
        {
          id: "qi-recreated",
          serviceId: "service-auto",
          serviceName: "Otturazione",
          serviceDate: new Date("2026-04-10T10:00:00.000Z"),
          quantity: 1,
          price: { toString: () => "80.00" },
          total: { toString: () => "80.00" },
        },
      ],
    });
    mocks.prisma.dentalRecord.findFirst = vi.fn().mockResolvedValue({
      id: "record-1",
      treated: false,
      procedure: "Otturazione",
      performedAt: new Date("2026-04-10T10:00:00.000Z"),
    });
    mocks.prisma.service.findFirst = vi.fn().mockResolvedValue({
      id: "service-auto",
      name: "Otturazione",
      costBasis: { toString: () => "80.00" },
    });

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("itemsJson", JSON.stringify([
      {
        id: "qi-manual",
        serviceId: "service-manual",
        serviceDate: "2026-04-10",
        quantity: 1,
        price: 120,
      },
    ]));
    formData.set("existingQuoteSignatureUrl", "https://blob.test/signature.png");

    const result = await savePreventivoAction({ savedAt: 0 }, formData);

    expect(result.savedAt).toEqual(expect.any(Number));
    expect(mocks.prisma.quoteItem.delete).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.dentalRecord.findMany).toHaveBeenCalledWith({
      where: { patientId: "patient-1" },
      select: { id: true },
      orderBy: [{ performedAt: "asc" }, { id: "asc" }],
    });
    expect(
      mocks.prisma.quoteItem.create.mock.calls.length + mocks.prisma.quoteItem.update.mock.calls.length
    ).toBeGreaterThan(0);
  });
});
