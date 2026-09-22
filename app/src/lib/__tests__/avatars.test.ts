import { describe, expect, it } from "vitest";
import { resolveProfileAvatarUrl, UNKNOWN_GENDER_AVATAR } from "@/lib/avatars";

describe("resolveProfileAvatarUrl", () => {
  it("uses a question mark when gender is not set and there is no custom photo", () => {
    expect(resolveProfileAvatarUrl({ avatarUrl: null, gender: "NOT_SPECIFIED" })).toBe(UNKNOWN_GENDER_AVATAR);
    expect(resolveProfileAvatarUrl({ avatarUrl: "/avatars/avatar_1.jpg", gender: null })).toBe(
      UNKNOWN_GENDER_AVATAR,
    );
    expect(resolveProfileAvatarUrl({ avatarUrl: null, gender: undefined })).toBe(UNKNOWN_GENDER_AVATAR);
  });

  it("keeps an uploaded photo even when gender is not set", () => {
    const uploaded = "https://blob.vercel-storage.com/avatars/user.jpg";
    expect(resolveProfileAvatarUrl({ avatarUrl: uploaded, gender: "NOT_SPECIFIED" })).toBe(uploaded);
  });

  it("keeps the stored avatar once gender is set", () => {
    expect(resolveProfileAvatarUrl({ avatarUrl: "/avatars/avatar_2.jpg", gender: "FEMALE" })).toBe(
      "/avatars/avatar_2.jpg",
    );
    expect(resolveProfileAvatarUrl({ avatarUrl: null, gender: "MALE" })).toBeNull();
  });
});
