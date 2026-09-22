import type { ReactNode } from "react";

/**
 * Minimal safe markdown for instruction steps.
 * Supports: paragraphs, **bold**, *italic*, `code`, links, lists, # headings.
 * No raw HTML.
 */

function renderInlinePlain(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    if (m[2] != null) {
      nodes.push(
        <strong key={key++} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {m[2]}
        </strong>,
      );
    } else if (m[3] != null) {
      nodes.push(
        <em key={key++} className="italic text-zinc-800 dark:text-zinc-100">
          {m[3]}
        </em>,
      );
    } else if (m[4] != null) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-zinc-50 px-1 py-0.5 text-[0.9em] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {m[4]}
        </code>,
      );
    } else if (m[5] != null && m[6] != null) {
      nodes.push(
        <a
          key={key++}
          href={m[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-700 underline decoration-emerald-600 underline-offset-2 hover:text-emerald-600 dark:text-emerald-300"
        >
          {m[5]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

export function StepMarkdown({ content }: { readonly content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const text = heading[2]!;
      const className =
        level === 1
          ? "mt-2 mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-50"
          : level === 2
            ? "mt-2 mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            : "mt-1.5 mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-100";
      blocks.push(
        <p key={key++} className={className}>
          {renderInlinePlain(text)}
        </p>,
      );
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul
          key={key++}
          className="my-1.5 list-disc space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-100"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInlinePlain(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol
          key={key++}
          className="my-1.5 list-decimal space-y-1 pl-5 text-sm text-zinc-800 dark:text-zinc-100"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInlinePlain(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,3})\s+/.test(lines[i] ?? "") &&
      !/^[-*]\s+/.test(lines[i] ?? "") &&
      !/^\d+\.\s+/.test(lines[i] ?? "")
    ) {
      para.push(lines[i] ?? "");
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
        {renderInlinePlain(para.join(" "))}
      </p>,
    );
  }

  if (blocks.length === 0) {
    return <p className="text-sm italic text-zinc-500 dark:text-zinc-400">Nessun contenuto.</p>;
  }

  return <div className="instruction-md text-zinc-800 dark:text-zinc-100">{blocks}</div>;
}
