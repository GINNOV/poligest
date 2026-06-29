import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentStatus, Gender, Role, StockMovementType } from "@prisma/client";

const mocks = vi.hoisted(() => {
  const requireUser = vi.fn();
  const logAudit = vi.fn();
  const revalidatePath = vi.fn();
  const redirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  const prisma = {
    consentModule: {
      findMany: vi.fn(),
    },
    patient: {
      create: vi.fn(),
      update: vi.fn(),
    },
    patientConsent: {
      create: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  const put = vi.fn();
  const sharp = vi.fn();
  const sendPatientWelcomeEmail = vi.fn();
  const resolveStoredPatientPhotoUrl = vi.fn();

  return {
    requireUser,
    logAudit,
    revalidatePath,
    redirect,
    prisma,
    put,
    sharp,
    sendPatientWelcomeEmail,
    resolveStoredPatientPhotoUrl,
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

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.put,
}));

vi.mock("sharp", () => ({
  default: mocks.sharp,
}));

vi.mock("@/lib/welcome-email", () => ({
  sendPatientWelcomeEmail: mocks.sendPatientWelcomeEmail,
}));

vi.mock("@/lib/stack-app", () => ({
  getStackSignInUrl: () => "/handler/sign-in",
  stackServerApp: {
    urls: {
      signIn: "/handler/sign-in",
    },
  },
}));

vi.mock("@/lib/patient-avatars", () => ({
  resolveStoredPatientPhotoUrl: mocks.resolveStoredPatientPhotoUrl,
}));

import { createPatient } from "@/app/[locale]/(app)/pazienti/actions";
import { addImplantAssociationAction, updateImplantAssociationAction } from "@/lib/patients/actions";

describe("createPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.prisma.patient.create.mockResolvedValue({
      id: "patient-1",
      firstName: "Maria",
      lastName: "Rossi",
    });
    mocks.prisma.patient.update.mockResolvedValue(undefined);
    mocks.prisma.patientConsent.create.mockResolvedValue(undefined);
    mocks.sendPatientWelcomeEmail.mockResolvedValue(undefined);
    mocks.put.mockResolvedValue({ url: "https://blob.test/signature.png" });
    mocks.resolveStoredPatientPhotoUrl.mockReturnValue("https://avatar.test/female.jpg");

    const toBuffer = vi.fn().mockResolvedValue(Buffer.from("resized-image"));
    const jpeg = vi.fn(() => ({ toBuffer }));
    const resize = vi.fn(() => ({ jpeg, toBuffer }));
    mocks.sharp.mockReturnValue({ resize, jpeg, toBuffer });

    vi.stubEnv("NEXTAUTH_URL", "https://patients.poligest.test");
  });

  it("creates a patient with required consent coverage and redirects to the detail page", async () => {
    mocks.prisma.consentModule.findMany
      .mockResolvedValueOnce([{ id: "consent-1", name: "Privacy" }])
      .mockResolvedValueOnce([{ id: "consent-1", name: "Privacy" }]);

    const formData = new FormData();
    formData.set("firstName", "maria");
    formData.set("lastName", "rossi");
    formData.set("email", "MARIA@example.com");
    formData.set("phone", "3331234567");
    formData.set("address", "Via Roma 12");
    formData.set("city", "Milano");
    formData.set("taxId", "RSSMRA80A01H501U");
    formData.set("gender", Gender.FEMALE);
    formData.set("birthDate", "1980-01-01");
    formData.append("conditions", "Diabete");
    formData.set("medications", "Tachipirina");
    formData.set("extraNotes", "Paziente ansiosa");
    formData.set("consentModuleId", "consent-1");
    formData.set("consentPlace", "Milano");
    formData.set("consentDate", "2026-04-08");
    formData.set("patientSignature", "Maria Rossi");
    formData.set("doctorSignature", "Dr. Verdi");
    formData.set("consentSignatureData", "data:image/png;base64,c2lnbmF0dXJl");
    formData.set("consentChannel", "Di persona");
    formData.set("postCreateRedirect", "patient_detail");

    await expect(createPatient(formData)).rejects.toThrow("NEXT_REDIRECT:/pazienti/patient-1");

    expect(mocks.prisma.patient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: "Maria",
        lastName: "Rossi",
        email: "maria@example.com",
        phone: "+393331234567",
        gender: Gender.FEMALE,
        birthDate: new Date("1980-01-01"),
        hasPaperConsentForRequired: false,
      }),
    });
    expect(mocks.prisma.patientConsent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: "patient-1",
        moduleId: "consent-1",
        status: ConsentStatus.GRANTED,
        place: "Milano",
        patientName: "Maria Rossi",
        doctorName: "Dr. Verdi",
      }),
    });
    expect(mocks.resolveStoredPatientPhotoUrl).toHaveBeenCalledWith({
      patientId: "patient-1",
      firstName: "Maria",
      gender: Gender.FEMALE,
      taxId: "RSSMRA80A01H501U",
    });
    expect(mocks.prisma.patient.update).toHaveBeenCalledWith({
      where: { id: "patient-1" },
      data: expect.objectContaining({
        photoUrl: "https://avatar.test/female.jpg",
        notes: expect.stringContaining("Firma digitale (Privacy): https://blob.test/signature.png"),
      }),
    });
    expect(mocks.sendPatientWelcomeEmail).toHaveBeenCalledWith("maria@example.com", {
      patientName: "Maria",
      loginUrl: expect.stringContaining("https://patients.poligest.test/handler/sign-in?audience=patient"),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/nuovo");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects the create flow when required consent modules are missing", async () => {
    mocks.prisma.consentModule.findMany.mockResolvedValue([
      { id: "consent-required", name: "Privacy" },
    ]);

    const formData = new FormData();
    formData.set("firstName", "Mario");
    formData.set("lastName", "Rossi");

    await expect(createPatient(formData)).rejects.toThrow("Mancano consensi obbligatori.");

    expect(mocks.prisma.patient.create).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rejects future birth dates when creating a patient", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00.000Z"));

    const formData = new FormData();
    formData.set("firstName", "Mario");
    formData.set("lastName", "Rossi");
    formData.set("birthDate", "2026-05-12");

    await expect(createPatient(formData)).rejects.toThrow("La data di nascita non può essere futura.");

    expect(mocks.prisma.patient.create).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("allows creating the patient when required consents are marked as present on paper", async () => {
    mocks.prisma.consentModule.findMany.mockResolvedValue([
      { id: "consent-required", name: "Privacy" },
    ]);

    const formData = new FormData();
    formData.set("firstName", "Mario");
    formData.set("lastName", "Rossi");
    formData.set("hasPaperConsentForRequired", "on");

    await expect(createPatient(formData)).rejects.toThrow("NEXT_REDIRECT:/dashboard");

    expect(mocks.prisma.patient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: "Mario",
        lastName: "Rossi",
        hasPaperConsentForRequired: true,
      }),
    });
    expect(mocks.prisma.patientConsent.create).not.toHaveBeenCalled();
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          hasPaperConsentForRequired: true,
        }),
      }),
    );
  });

  it("redirects to patients with a creation toast message when requested", async () => {
    mocks.prisma.consentModule.findMany.mockResolvedValue([]);

    const formData = new FormData();
    formData.set("firstName", "Maria");
    formData.set("lastName", "Rossi");
    formData.set("postCreateRedirect", "patients");

    await expect(createPatient(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/pazienti?patientCreated=Paziente%20Maria%20Rossi%3A%20cartella%20e'%20stata%20creata.",
    );
  });
});

describe("implant association actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "staff-1", role: Role.ADMIN });
    mocks.logAudit.mockResolvedValue(undefined);
    mocks.prisma.stockMovement.create.mockResolvedValue({ id: "implant-1" });
    mocks.prisma.stockMovement.update.mockResolvedValue({ id: "implant-1" });
  });

  it("associates an implant using read-only product data from magazzino", async () => {
    mocks.prisma.product.findUnique.mockResolvedValue({
      id: "product-1",
      name: "Impianto conico",
      brand: "Biomed",
      udiDi: "UDI-DI-DB",
      udiPi: "LOT-DB",
    });

    const formData = new FormData();
    formData.set("patientId", "patient-1");
    formData.set("productId", "product-1");
    formData.set("brand", "Marca manomessa");
    formData.set("udiDi", "UDI-MANOMESSO");
    formData.set("udiPi", "LOT-MANOMESSO");
    formData.set("purchaseDate", "2026-06-01");
    formData.set("interventionDate", "2026-06-05");
    formData.set("interventionSite", "1.1");

    await addImplantAssociationAction(formData);

    expect(mocks.prisma.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: "product-1",
        quantity: 1,
        movement: StockMovementType.OUT,
        patientId: "patient-1",
        udiPi: "LOT-DB",
        note: "Tipo: Impianto conico · Marca: Biomed · UDI-DI: UDI-DI-DB",
        interventionSite: "1.1",
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/patient-1");
  });

  it("updates only editable implant association fields while preserving the product", async () => {
    mocks.prisma.stockMovement.findFirst.mockResolvedValue({
      id: "implant-1",
      patientId: "patient-1",
      productId: "product-1",
      product: {
        id: "product-1",
        name: "Impianto conico",
        brand: "Biomed",
        udiDi: "UDI-DI-DB",
        udiPi: "LOT-DB",
      },
    });

    const formData = new FormData();
    formData.set("implantId", "implant-1");
    formData.set("patientId", "patient-1");
    formData.set("productId", "different-product");
    formData.set("purchaseDate", "2026-06-02");
    formData.set("interventionDate", "2026-06-06");
    formData.set("interventionSite", "2.4");

    await updateImplantAssociationAction(formData);

    expect(mocks.prisma.stockMovement.update).toHaveBeenCalledWith({
      where: { id: "implant-1" },
      data: expect.not.objectContaining({ productId: "different-product" }),
    });
    expect(mocks.prisma.stockMovement.update).toHaveBeenCalledWith({
      where: { id: "implant-1" },
      data: expect.objectContaining({
        udiPi: "LOT-DB",
        note: "Tipo: Impianto conico · Marca: Biomed · UDI-DI: UDI-DI-DB",
        interventionSite: "2.4",
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pazienti/patient-1");
  });
});
