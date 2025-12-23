import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";

type Params = { slug?: string[] };

type DocMeta = {
  slug: string;
  title: string;
};

const DOCS_ROOT = path.join(process.cwd(), "public", "userdocs");

function toTitle(slug: string) {
  return slug
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadDocsIndex(): Promise<DocMeta[]> {
  const entries = await fs.readdir(DOCS_ROOT);
  const docs: DocMeta[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const slug = entry.replace(/\.md$/, "");
    const filePath = path.join(DOCS_ROOT, entry);
    const content = await fs.readFile(filePath, "utf8");
    const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    docs.push({ slug, title: heading || toTitle(slug) });
  }

  return docs.sort((a, b) => {
    if (a.slug === "index") return -1;
    if (b.slug === "index") return 1;
    return a.slug.localeCompare(b.slug);
  });
}

export default async function DocsPage({ params }: { params: Promise<Params> }) {
  const resolvedParams = await params;
  const slugParts = Array.isArray(resolvedParams.slug) ? resolvedParams.slug.filter(Boolean) : [];

  if (slugParts.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    notFound();
  }

  const requestedSlug = slugParts.length ? slugParts.join("/") : "index";
  const filePath = path.join(DOCS_ROOT, `${requestedSlug}.md`);

  if (!filePath.startsWith(DOCS_ROOT)) {
    notFound();
  }

  let markdown: string;
  try {
    markdown = await fs.readFile(filePath, "utf8");
  } catch (error) {
    notFound();
  }

  const docs = await loadDocsIndex();
  const html = marked.parse(markdown) as string;
  const currentTitle = docs.find((doc) => doc.slug === requestedSlug)?.title ?? toTitle(requestedSlug);

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr] md:items-start">
      <aside className="sticky top-24 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-700">Documentazione</h2>
        <div className="space-y-1 text-sm font-semibold text-zinc-800">
          {docs.map((doc) => {
            const href = doc.slug === "index" ? "/docs" : `/docs/${doc.slug}`;
            const isActive = doc.slug === requestedSlug;
            return (
              <Link
                key={doc.slug}
                href={href}
                className={`flex items-center justify-between rounded-xl px-3 py-2 transition ${
                  isActive
                    ? "bg-emerald-50 text-emerald-900"
                    : "text-zinc-800 hover:bg-emerald-50/70 hover:text-emerald-900"
                }`}
              >
                <span className="truncate">{doc.title}</span>
                {isActive ? (
                  <span className="text-xs font-semibold uppercase text-emerald-700">Aperto</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </aside>

      <article className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Guida utente</p>
            <h1 className="text-2xl font-semibold text-zinc-900">{currentTitle}</h1>
          </div>
          <Link
            href="/docs"
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-800"
          >
            Tutti i documenti
          </Link>
        </div>

        <div
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </div>
  );
}
