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
    patient: {
      findUnique: vi.fn(),
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
});
