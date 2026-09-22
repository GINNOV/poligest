import { describe, expect, it } from "vitest";
import {
  extractYoutubeVideoId,
  isValidYoutubeUrl,
  normalizeYoutubeUrl,
} from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("extractYoutubeVideoId", () => {
  it("parses common URL shapes", () => {
    expect(extractYoutubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYoutubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(extractYoutubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(extractYoutubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(extractYoutubeVideoId(ID)).toBe(ID);
  });

  it("rejects non-youtube", () => {
    expect(extractYoutubeVideoId("https://vimeo.com/123")).toBeNull();
    expect(extractYoutubeVideoId("not a url")).toBeNull();
  });
});

describe("normalizeYoutubeUrl", () => {
  it("returns null for empty", () => {
    expect(normalizeYoutubeUrl("")).toBeNull();
    expect(normalizeYoutubeUrl("   ")).toBeNull();
    expect(normalizeYoutubeUrl(null)).toBeNull();
  });

  it("canonicalizes to watch URL", () => {
    expect(normalizeYoutubeUrl(`https://youtu.be/${ID}`)).toBe(
      `https://www.youtube.com/watch?v=${ID}`,
    );
  });
});

describe("isValidYoutubeUrl", () => {
  it("allows empty (optional field)", () => {
    expect(isValidYoutubeUrl("")).toBe(true);
  });

  it("validates urls", () => {
    expect(isValidYoutubeUrl(`https://youtu.be/${ID}`)).toBe(true);
    expect(isValidYoutubeUrl("https://example.com")).toBe(false);
  });
});
