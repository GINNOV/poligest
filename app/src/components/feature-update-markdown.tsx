type UpdateMarkdownProps = {
  markdown: string;
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

export function renderUpdateMarkdown(markdown: string) {
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
          <img src={src} alt={alt} className="mx-auto h-auto w-2/5 max-w-sm" />
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
}

export function FeatureUpdateMarkdownPreview({ markdown }: UpdateMarkdownProps) {
  return <div className="space-y-3">{renderUpdateMarkdown(markdown)}</div>;
}
