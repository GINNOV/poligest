import { describe, expect, it } from "vitest";
import {
  avatarPools,
  pickSystemAvatar,
  resolvePatientPhotoUrl,
  resolveStoredPatientPhotoUrl,
} from "@/lib/patient-avatars";

describe("pickSystemAvatar", () => {
  it("uses the female pool for female patients", () => {
    const avatar = pickSystemAvatar("patient-1", "FEMALE");
    expect(avatarPools.female).toContain(avatar);
  });

  it("uses the male pool for male patients", () => {
    const avatar = pickSystemAvatar("patient-1", "MALE");
    expect(avatarPools.male).toContain(avatar);
  });
});

describe("resolvePatientPhotoUrl", () => {
  it("keeps custom uploaded photos", () => {
    const customUrl = "https://blob.vercel-storage.com/patients/photo.jpg";
    expect(
      resolvePatientPhotoUrl({
        patientId: "patient-1",
        firstName: "Maria",
        gender: "FEMALE",
        photoUrl: customUrl,
      }),
    ).toBe(customUrl);
  });

  it("recomputes system avatars from gender even when a stale photo is stored", () => {
    const avatar = resolvePatientPhotoUrl({
      patientId: "patient-1",
      firstName: "Maria",
      gender: "FEMALE",
      photoUrl: "/avatars/avatar_4.jpg",
    });

    expect(avatarPools.female).toContain(avatar);
    expect(avatar).not.toBe("/avatars/avatar_4.jpg");
  });

  it("infers gender from first name when gender is not specified", () => {
    const avatar = resolvePatientPhotoUrl({
      patientId: "patient-2",
      firstName: "Giulia",
      gender: "NOT_SPECIFIED",
      photoUrl: "/avatars/avatar_4.jpg",
    });

    expect(avatarPools.female).toContain(avatar);
  });
});

describe("resolveStoredPatientPhotoUrl", () => {
  it("stores a deterministic female avatar for female patients", () => {
    const avatar = resolveStoredPatientPhotoUrl({
      patientId: "patient-3",
      firstName: "Anna",
      gender: "FEMALE",
    });

    expect(avatar).toBe(pickSystemAvatar("patient-3", "FEMALE"));
    expect(avatarPools.female).toContain(avatar);
  });
});