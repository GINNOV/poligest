/**
 * Parse YouTube URLs (watch, youtu.be, embed, shorts) → 11-char video id.
 */
export function extractYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[\w-]{11}$/.test(raw)) return raw;

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;

      const parts = url.pathname.split("/").filter(Boolean);
      if (
        parts.length >= 2 &&
        ["embed", "shorts", "live", "v"].includes(parts[0]!)
      ) {
        const id = parts[1]!;
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeYoutubeUrl(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const id = extractYoutubeVideoId(trimmed);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function isValidYoutubeUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return true;
  return extractYoutubeVideoId(trimmed) != null;
}
