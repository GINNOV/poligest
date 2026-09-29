export const avatarPool = [
  "/avatars/avatar_1.jpg",
  "/avatars/avatar_2.jpg",
  "/avatars/avatar_3.jpg",
  "/avatars/avatar_4.jpg",
  "/avatars/avatar_5.jpg",
  "/avatars/avatar_6.jpg",
  "/avatars/avatar_7.jpg",
];

export function getRandomAvatarUrl() {
  return avatarPool[Math.floor(Math.random() * avatarPool.length)];
}

export const UNKNOWN_GENDER_AVATAR = "/avatars/unknown-gender.svg";

export function isBundledAvatar(url?: string | null) {
  return typeof url === "string" && url.startsWith("/avatars/");
}

export function resolveProfileAvatarUrl(input: {
  avatarUrl?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "NOT_SPECIFIED" | null;
}) {
  const genderUnset = !input.gender || input.gender === "NOT_SPECIFIED";
  if (genderUnset && (!input.avatarUrl || isBundledAvatar(input.avatarUrl))) {
    return UNKNOWN_GENDER_AVATAR;
  }
  return input.avatarUrl ?? null;
}
