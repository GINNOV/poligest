"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  compareInstructionsByCategoryThenTitle,
  INSTRUCTION_CATEGORIES,
  instructionCategoryLabel,
  normalizeInstructionCategory,
  type InstructionCategoryId,
} from "@/lib/instructions/categories";
import {
  emptyInstructionForm,
  type InstructionFormDefaults,
  type InstructionFormStep,
  type InstructionStaffRole,
} from "@/lib/instructions/form-defaults";
import { deleteInstructionAction, upsertInstructionAction } from "@/lib/instructions/actions";
import { normalizePathPattern } from "@/lib/instructions/match";

type InstructionForm = InstructionFormDefaults;

type InstructionRow = {
  id: string;
  title: string;
  description?: string | null;
  pathPattern: string;
  category?: string | null;
  role: Role | null;
  isActive: boolean;
  steps: Array<{
    id: string;
    title: string;
    content: string;
    youtubeUrl?: string | null;
    sortOrder: number;
  }>;
};

const STAFF_ROLES: InstructionStaffRole[] = ["ADMIN", "MANAGER", "ASSISTANT", "SECRETARY"];

function instructionHasMedia(row: InstructionRow): boolean {
  return row.steps.some((step) => Boolean(step.youtubeUrl?.trim()));
}

function MediaCameraIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function toFormRole(role: string | null): InstructionForm["role"] {
  if (role === "ADMIN" || role === "MANAGER" || role === "ASSISTANT" || role === "SECRETARY") {
    return role;
  }
  return "";
}

export function InstructionManager({
  instructions,
  showAdminBackLink,
}: {
  instructions: InstructionRow[];
  showAdminBackLink: boolean;
}) {
  const t = useTranslations("app");
  const [query, setQuery] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstructionForm>(emptyInstructionForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InstructionRow | null>(null);
  const [pending, setPending] = useState(false);

  const roleLabel = useCallback(
    (role: string | null): string => {
      if (!role) return "Tutti";
      const key = role.toLowerCase();
      if (key === "admin" || key === "manager" || key === "assistant" || key === "secretary") {
        return t(`roleLabels.${key}`);
      }
      return role;
    },
    [t],
  );

  const sortedRows = useMemo(
    () => [...instructions].sort(compareInstructionsByCategoryThenTitle),
    [instructions],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedRows;
    return sortedRows.filter((row) => {
      const hay = [
        row.title,
        row.description,
        row.pathPattern,
        instructionCategoryLabel(row.category),
        row.category,
        roleLabel(row.role),
        row.role,
        row.isActive ? "attiva" : "disattiva",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sortedRows, query, roleLabel]);

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
    setForm(emptyInstructionForm);
    setFormError(null);
  }

  function openCreate() {
    setModalMode("create");
    setEditingId(null);
    setForm(emptyInstructionForm);
    setFormError(null);
  }

  function openEdit(row: InstructionRow) {
    setFormError(null);
    setModalMode("edit");
    setEditingId(row.id);
    setForm({
      title: row.title,
      description: row.description ?? "",
      pathPattern: row.pathPattern,
      category: normalizeInstructionCategory(row.category),
      role: toFormRole(row.role),
      isActive: row.isActive,
      steps:
        row.steps.length > 0
          ? [...row.steps]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((step) => ({
                id: step.id,
                title: step.title,
                content: step.content,
                youtubeUrl: step.youtubeUrl ?? "",
              }))
          : [{ title: "", content: "", youtubeUrl: "" }],
    });
  }

  function updateStep(index: number, patch: Partial<InstructionFormStep>) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    }));
  }

  function addStep() {
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { title: "", content: "", youtubeUrl: "" }],
    }));
  }

  function removeStep(index: number) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.length <= 1 ? prev.steps : prev.steps.filter((_, i) => i !== index),
    }));
  }

  function moveStep(index: number, dir: -1 | 1) {
    setForm((prev) => {
      const next = [...prev.steps];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return { ...prev, steps: next };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!form.title.trim()) {
      setFormError("Titolo obbligatorio.");
      return;
    }
    if (!form.pathPattern.trim()) {
      setFormError("Pattern percorso obbligatorio.");
      return;
    }

    const steps = form.steps
      .map((step) => ({
        id: step.id,
        title: step.title.trim(),
        content: step.content,
        youtubeUrl: step.youtubeUrl.trim(),
      }))
      .filter((step) => step.title.length > 0 || step.content.trim().length > 0 || step.youtubeUrl.length > 0);

    if (form.isActive && steps.some((step) => !step.title)) {
      setFormError("Ogni passaggio attivo deve avere un titolo.");
      return;
    }
    if (form.isActive && steps.length < 1) {
      setFormError("Un'istruzione attiva richiede almeno un passaggio.");
      return;
    }

    const payload = new FormData();
    if (editingId) payload.set("id", editingId);
    payload.set("title", form.title.trim());
    payload.set("description", form.description.trim());
    payload.set("pathPattern", normalizePathPattern(form.pathPattern));
    payload.set("category", form.category);
    payload.set("role", form.role);
    if (form.isActive) payload.set("isActive", "on");
    payload.set(
      "stepsJson",
      JSON.stringify(
        steps.map(({ id, title, content, youtubeUrl }) =>
          id ? { id, title, content, youtubeUrl } : { title, content, youtubeUrl },
        ),
      ),
    );

    setPending(true);
    try {
      const res = await upsertInstructionAction(payload);
      if (res.success) closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Errore salvataggio");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          {showAdminBackLink ? (
            <Link href="/admin" className="text-xs text-zinc-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300">
              ← Amministrazione
            </Link>
          ) : null}
          <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Istruzioni configurate</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Guide contestuali collegate a un percorso. Il pulsante <strong>?</strong> compare nell&apos;header quando la
            pagina corrisponde al pattern e al ruolo.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          + Nuova istruzione
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca per titolo, percorso, ruolo o descrizione…"
          className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          aria-label="Cerca istruzioni"
        />
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {sortedRows.length === 0
            ? "0 istruzioni"
            : query.trim()
              ? `${filteredRows.length} di ${sortedRows.length} istruzioni`
              : `${sortedRows.length} istruzioni`}
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Nessuna istruzione ancora. Crea la prima guida per lo staff.
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Nessuna istruzione corrisponde a «{query.trim()}».
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredRows.map((row, index) => {
            const categoryId = normalizeInstructionCategory(row.category);
            const prevCategory =
              index > 0 ? normalizeInstructionCategory(filteredRows[index - 1]?.category) : null;
            const showCategoryHeader = categoryId !== prevCategory;
            return (
              <li key={row.id} className="space-y-2">
                {showCategoryHeader ? (
                  <div className="sticky top-0 z-[1] bg-zinc-50/95 px-1 py-1.5 backdrop-blur-sm dark:bg-zinc-950/95">
                    <p className="text-[11px] font-bold tracking-[0.14em] text-emerald-800 uppercase dark:text-emerald-300">
                      {instructionCategoryLabel(categoryId)}
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-lg ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                      🧭
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{row.title}</span>
                        {instructionHasMedia(row) ? (
                          <span
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-800 ring-1 ring-emerald-700/15 dark:text-emerald-300"
                            title="Ha video o media allegati"
                          >
                            <MediaCameraIcon className="h-3.5 w-3.5" />
                            <span className="sr-only">Ha video allegati</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <code className="rounded bg-zinc-50 px-1.5 py-0.5 dark:bg-zinc-900">{row.pathPattern}</code>
                        <span className="mx-1.5">·</span>
                        {roleLabel(row.role)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.steps.length} passaggi</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {row.isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        ATTIVA
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        DISATTIVA
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="p-2 text-zinc-400 transition hover:text-emerald-600"
                      aria-label={`Modifica ${row.title}`}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      className="p-2 text-zinc-400 transition hover:text-rose-600"
                      aria-label={`Elimina ${row.title}`}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalMode != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="flex h-[min(90dvh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            role="dialog"
            aria-label={modalMode === "edit" ? "Modifica istruzione" : "Nuova istruzione"}
          >
            <div className="shrink-0 border-b border-zinc-200 px-6 pt-6 pb-4 dark:border-zinc-800">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {modalMode === "edit" ? "Modifica istruzione" : "Nuova istruzione"}
              </h2>
              {formError ? (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                  {formError}
                </p>
              ) : null}
            </div>
            <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Titolo
                    <input
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Area / categoria
                    <select
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          category: event.target.value as InstructionCategoryId,
                        }))
                      }
                      className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                      required
                    >
                      {INSTRUCTION_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Pattern percorso
                    <input
                      value={form.pathPattern}
                      onChange={(event) => setForm((current) => ({ ...current, pathPattern: event.target.value }))}
                      placeholder="/pazienti/*"
                      className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    Ruolo (opzionale)
                    <select
                      value={form.role}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          role: event.target.value as InstructionForm["role"],
                        }))
                      }
                      className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <option value="">Tutti</option>
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-zinc-500 sm:col-span-2 dark:text-zinc-400">
                    L&apos;area ordina la lista (Giornata → … → Generale). Il percorso deve iniziare con{" "}
                    <code className="rounded bg-zinc-50 px-1 dark:bg-zinc-900">/</code>.{" "}
                    <code className="rounded bg-zinc-50 px-1 dark:bg-zinc-900">/pazienti</code> = solo quella pagina;{" "}
                    <code className="rounded bg-zinc-50 px-1 dark:bg-zinc-900">/pazienti/*</code> = lista pazienti e tutte
                    le sottopagine. Senza slash finale.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-100">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Attiva
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Descrizione breve
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className="resize-y rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </label>
                <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold tracking-widest text-zinc-800 dark:text-zinc-100">PASSAGGI</h3>
                    <button
                      type="button"
                      onClick={addStep}
                      className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                    >
                      + Aggiungi passaggio
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.steps.map((step, index) => (
                      <div
                        key={step.id ?? `new-${index}`}
                        className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Passaggio {index + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-white disabled:opacity-40 dark:hover:bg-zinc-950"
                              onClick={() => moveStep(index, -1)}
                              disabled={index === 0}
                              aria-label="Sposta su"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-white disabled:opacity-40 dark:hover:bg-zinc-950"
                              onClick={() => moveStep(index, 1)}
                              disabled={index === form.steps.length - 1}
                              aria-label="Sposta giù"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="rounded px-1.5 py-0.5 text-xs text-rose-600 hover:bg-white dark:hover:bg-zinc-950"
                              onClick={() => removeStep(index)}
                              aria-label="Rimuovi passaggio"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          Titolo passaggio
                          <input
                            value={step.title}
                            onChange={(event) => updateStep(index, { title: event.target.value })}
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
                          />
                        </label>
                        <label className="mt-2 flex flex-col gap-1 text-sm font-medium">
                          Contenuto (Markdown supportato)
                          <textarea
                            rows={3}
                            value={step.content}
                            onChange={(event) => updateStep(index, { content: event.target.value })}
                            className="resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                          />
                        </label>
                        <label className="mt-2 flex flex-col gap-1 text-sm font-medium">
                          Video YouTube (opzionale)
                          <input
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=… oppure youtu.be/…"
                            value={step.youtubeUrl}
                            onChange={(event) => updateStep(index, { youtubeUrl: event.target.value })}
                            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
                          />
                          <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                            Il video compare nel passaggio come supporto aggiuntivo.
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-3 border-t border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
                <Button type="button" variant="outline" className="flex-1" onClick={closeModal} disabled={pending}>
                  Annulla
                </Button>
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? "Salvataggio…" : modalMode === "create" ? "Crea istruzione" : "Salva istruzione"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Elimina istruzione</h2>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Eliminare definitivamente <strong className="text-zinc-900 dark:text-zinc-50">{deleteTarget.title}</strong>?
              L&apos;operazione non può essere annullata.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Annulla
              </Button>
              <form
                action={async (fd) => {
                  await deleteInstructionAction(fd);
                  setDeleteTarget(null);
                }}
              >
                <input type="hidden" name="id" value={deleteTarget.id} />
                <Button type="submit" variant="destructive">
                  Elimina
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
