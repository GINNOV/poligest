"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  update: { id: string; title: string; bodyMarkdown: string };
};

const renderInline = (text: string) =>
  text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((segment, idx) => {
      if (segment.startsWith("**") && segment.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold text-zinc-900">
            {segment.slice(2, -2)}
          </strong>
        );
      }
      return <span key={idx}>{segment}</span>;
    });

const normalizeUpdateImageSrc = (src: string) => {
  const trimmed = src.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/updates/${trimmed.replace(/^updates\//, "")}`;
};

const renderMarkdown = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];

  const flushList = () => {
    if (list.length > 0) {
      nodes.push(
        <ul key={`list-${nodes.length}`} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-800">
          {list}
        </ul>
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }

    const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line);
    if (imageMatch) {
      flushList();
      const alt = imageMatch[1] || "Aggiornamento";
      const src = normalizeUpdateImageSrc(imageMatch[2]);
      nodes.push(
        <figure key={`img-${idx}`} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="h-auto w-full" />
          {alt ? (
            <figcaption className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              {alt}
            </figcaption>
          ) : null}
        </figure>
      );
      return;
    }

    if (line.startsWith("# ")) {
      flushList();
      nodes.push(
        <h3 key={`h1-${idx}`} className="text-base font-semibold text-zinc-900">
          {line.replace(/^#\s+/, "")}
        </h3>
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h4 key={`h2-${idx}`} className="text-sm font-semibold text-zinc-900">
          {line.replace(/^##\s+/, "")}
        </h4>
      );
      return;
    }

    if (line.startsWith("* ")) {
      list.push(
        <li key={`li-${idx}`} className="text-sm leading-relaxed text-zinc-800">
          {renderInline(line.replace(/^\*\s+/, ""))}
        </li>
      );
      return;
    }

    flushList();
    nodes.push(
      <p key={`p-${idx}`} className="text-sm leading-relaxed text-zinc-800">
        {renderInline(line)}
      </p>
    );
  });

  flushList();
  return nodes;
};

export function StaffFeatureUpdateDialog({ update }: Props) {
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const content = useMemo(() => renderMarkdown(update.bodyMarkdown), [update.bodyMarkdown]);
  const dismiss = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/feature-updates/dismiss", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ updateId: update.id }),
      });
    } catch (error) {
      console.error("Failed to dismiss feature update", error);
    } finally {
      setSubmitting(false);
      setOpen(false);
    }
  }, [submitting, update.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-white p-5">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Novità
            </div>
            <h2 className="mt-1 truncate text-lg font-semibold text-zinc-900">{update.title}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Questo messaggio verrà mostrato una sola volta.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            Chiudi
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">{content}</div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 p-4">
          <button
            type="button"
            onClick={dismiss}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Salvataggio..." : "Ho capito"}
          </button>
        </div>
      </div>
    </div>
  );
}
