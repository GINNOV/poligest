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
      findUnique: vi.fn(),
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
      findMany: vi.fn(),
    },
    patientPayment: {
      findMany: vi.fn(),
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
  getStackSignInUrl: () => "/handler/sign-in",
  stackServerApp: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
  Prisma: {
    Decimal: class {
      constructor(public v: number | string) {}
      toString() {
        return String(this.v);
      }
    },
  },
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
    mocks.prisma.service.findFirst.mockResolvedValue({ id: "s-1", name: "S", costBasis: "100" });
    
    mocks.prisma.dentalRecord.findMany.mockResolvedValue([]);
    mocks.prisma.dentalRecord.findFirst.mockResolvedValue(null);
    
    mocks.prisma.quote.create.mockResolvedValue({ id: "quote-created" });
    mocks.prisma.quote.findFirst.mockResolvedValue(null);
    mocks.prisma.quote.findUnique.mockResolvedValue(null);
    mocks.prisma.quote.findUniqueOrThrow.mockResolvedValue({ id: "quote-created" });
    mocks.prisma.quote.update.mockResolvedValue(undefined);
    
    mocks.prisma.quoteItem.create.mockResolvedValue({ id: "qi-new" });
    mocks.prisma.quoteItem.delete.mockResolvedValue(undefined);
    mocks.prisma.quoteItem.update.mockResolvedValue(undefined);
    mocks.prisma.quoteItem.findMany.mockResolvedValue([]);
    
    mocks.prisma.patientPayment.findMany.mockResolvedValue([]);

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
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/patient-9");
  });

  it("updates structured patient fields and redirects back to the contact panel", async () => {
    mocks.prisma.patient.findUnique.mockResolvedValue({
      notes: "Promemoria\nIndirizzo: Via vecchia 1, Roma",
      photoUrl: null,
      gender: Gender.MALE,
    });

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("firstName", "maria");
    formData.set("lastName", "rossi");
    formData.set("gender", Gender.FEMALE);
    formData.set("birthDate", "1980-01-01");

    await expect(updatePatientAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: expect.objectContaining({
        firstName: "Maria",
        lastName: "Rossi",
        gender: Gender.FEMALE,
      }),
    });
  });

  it("rejects future birth dates when updating a patient", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00.000Z"));

    mocks.prisma.patient.findUnique.mockResolvedValue({
      notes: "",
      photoUrl: null,
      gender: Gender.NOT_SPECIFIED,
    });

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("firstName", "Mario");
    formData.set("lastName", "Rossi");
    formData.set("birthDate", "2026-05-12");

    await expect(updatePatientAction(formData)).rejects.toThrow("La data di nascita non può essere futura.");

    expect(mocks.prisma.patient.update).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("adds dental procedures from the diary when creating a quote", async () => {
    mocks.prisma.service.findMany.mockResolvedValue([{ id: "service-manual", name: "Prima visita" }]);
    
    // syncAllDentalRecordsIntoQuote first bulk fetches
    mocks.prisma.service.findMany.mockResolvedValue([{ id: "service-auto", name: "Otturazione", costBasis: "80.00" }]);
    
    mocks.prisma.dentalRecord.findMany.mockResolvedValue([{
      id: "record-1",
      treated: false,
      tooth: 47,
      procedure: "Otturazione",
      performedAt: new Date("2026-04-10T10:00:00.000Z"),
    }]);
    
    // First time it's called for quote summary refresh after creation
    mocks.prisma.quote.findUnique.mockResolvedValue({
      id: "quote-created",
      items: [
        {
          id: "qi-manual",
          dentalRecordId: null,
          serviceId: "service-manual",
          serviceName: "Prima visita",
          quantity: 1,
          price: "120.00",
          total: "120.00",
          payments: []
        }
      ],
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

    await savePreventivoAction({ savedAt: 0 }, formData);

    expect(mocks.prisma.quoteItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        dentalRecordId: "record-1",
        serviceName: "Otturazione",
      })
    }));
  });

  it("updates existing quote items and syncs diary", async () => {
    const existingItems = [
      {
        id: "qi-1",
        serviceId: "s-1",
        serviceName: "S1",
        total: "100.00",
        price: "100.00",
        quantity: 1,
        saldato: false,
      }
    ];

    mocks.prisma.quote.findFirst.mockResolvedValue({
      id: "quote-1",
      patientId: "patient-1",
      items: existingItems,
    });

    // In syncAllDentalRecordsIntoQuote
    mocks.prisma.quote.findUnique.mockResolvedValue({
      id: "quote-1",
      items: existingItems.map(it => ({ ...it, payments: [] })),
    });

    mocks.prisma.service.findMany.mockResolvedValue([{ id: "s-1", name: "S1", costBasis: "100.00" }]);
    mocks.prisma.dentalRecord.findMany.mockResolvedValue([]);

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("quoteId", "quote-1");
    formData.set("itemsJson", JSON.stringify([
      {
        id: "qi-1",
        serviceId: "s-1",
        serviceDate: "2026-04-10",
        quantity: 1,
        price: 150, // Adjustment
      },
    ]));
    formData.set("existingQuoteSignatureUrl", "https://blob.test/signature.png");

    await savePreventivoAction({ savedAt: 0 }, formData);

    expect(mocks.prisma.quoteItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "qi-1" },
      data: expect.objectContaining({
        serviceId: "s-1",
        serviceName: "S1",
      })
    }));
  });
});
