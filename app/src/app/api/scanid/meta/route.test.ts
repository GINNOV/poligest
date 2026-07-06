import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/scanid/meta", () => {
  it("returns 200 with version and downloadUrl (using defaults)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(typeof json.version).toBe("string");
    expect(json.version.length).toBeGreaterThan(0);
    expect(typeof json.downloadUrl).toBe("string");
    expect(json.downloadUrl.length).toBeGreaterThan(0);
    // notes is optional
    if ("notes" in json) {
      expect(typeof json.notes === "string" || json.notes === undefined).toBe(true);
    }
  });

  it("honors SCANID_* env overrides", async () => {
    const originalVersion = process.env.SCANID_LATEST_VERSION;
    const originalUrl = process.env.SCANID_DOWNLOAD_URL;
    const originalNotes = process.env.SCANID_RELEASE_NOTES;

    process.env.SCANID_LATEST_VERSION = "9.9.9-test";
    process.env.SCANID_DOWNLOAD_URL = "https://example.com/ScanID-test.zip";
    process.env.SCANID_RELEASE_NOTES = "Test notes";

    try {
      const res = await GET();
      const json = await res.json();
      expect(json.version).toBe("9.9.9-test");
      expect(json.downloadUrl).toBe("https://example.com/ScanID-test.zip");
      expect(json.notes).toBe("Test notes");
    } finally {
      // restore
      if (originalVersion === undefined) delete process.env.SCANID_LATEST_VERSION;
      else process.env.SCANID_LATEST_VERSION = originalVersion;

      if (originalUrl === undefined) delete process.env.SCANID_DOWNLOAD_URL;
      else process.env.SCANID_DOWNLOAD_URL = originalUrl;

      if (originalNotes === undefined) delete process.env.SCANID_RELEASE_NOTES;
      else process.env.SCANID_RELEASE_NOTES = originalNotes;
    }
  });
});
