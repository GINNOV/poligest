import { resolveEffectiveGender } from "@/lib/infer-gender";

export type PatientGender = "MALE" | "FEMALE" | "OTHER" | "NOT_SPECIFIED" | null | undefined;

const femaleAvatars = [
  "/avatars/missing_patient_female.png",
  "/avatars/avatar_1.jpg",
  "/avatars/avatar_2.jpg",
  "/avatars/avatar_3.jpg",
];

const maleAvatars = [
  "/avatars/missing_patient_male.jpg",
  "/avatars/avatar_4.jpg",
  "/avatars/avatar_5.jpg",
  "/avatars/avatar_6.jpg",
  "/avatars/avatar_7.jpg",
];

const allAvatars = [...femaleAvatars, ...maleAvatars];

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const isSystemAvatar = (url?: string | null) =>
  typeof url === "string" && url.startsWith("/avatars/");

export const pickSystemAvatar = (seed: string, gender: PatientGender) => {
  const pool =
    gender === "FEMALE"
      ? femaleAvatars
      : gender === "OTHER" || gender === "NOT_SPECIFIED" || !gender
        ? allAvatars
        : maleAvatars;
  const index = pool.length ? hashSeed(seed) % pool.length : 0;
  return pool[index] ?? "/avatars/missing_patient.jpg";
};

export const pickRandomSystemAvatar = (gender: PatientGender) => {
  const pool =
    gender === "FEMALE"
      ? femaleAvatars
      : gender === "OTHER" || gender === "NOT_SPECIFIED" || !gender
        ? allAvatars
        : maleAvatars;
  const index = pool.length ? Math.floor(Math.random() * pool.length) : 0;
  return pool[index] ?? "/avatars/missing_patient.jpg";
};

export type ResolvePatientPhotoInput = {
  patientId: string;
  firstName?: string | null;
  gender?: PatientGender;
  photoUrl?: string | null;
  taxId?: string | null;
};

export function resolvePatientPhotoUrl(input: ResolvePatientPhotoInput) {
  if (input.photoUrl && !isSystemAvatar(input.photoUrl)) {
    return input.photoUrl;
  }

  const effectiveGender = resolveEffectiveGender(input.gender, input.firstName, input.taxId);
  return pickSystemAvatar(input.patientId, effectiveGender);
}

export function resolveStoredPatientPhotoUrl(input: Omit<ResolvePatientPhotoInput, "photoUrl">) {
  const effectiveGender = resolveEffectiveGender(input.gender, input.firstName, input.taxId);
  return pickSystemAvatar(input.patientId, effectiveGender);
}

export const avatarPools = {
  female: femaleAvatars,
  male: maleAvatars,
  all: allAvatars,
} as const;