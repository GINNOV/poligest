import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getOptionalPrismaModel } from "@/lib/prisma-models";
import { Role } from "@prisma/client";
import { FeatureUpdateMarkdownPreview } from "@/components/feature-update-markdown";

const updateClient = getOptionalPrismaModel<
  | {
      findFirst?: (args: unknown) => Promise<unknown>;
      updateMany?: (args: unknown) => Promise<unknown>;
      create?: (args: unknown) => Promise<unknown>;
      update?: (args: unknown) => Promise<unknown>;
    }
>("featureUpdate");

async function saveFeatureUpdate(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!updateClient?.create || !updateClient?.update || !updateClient?.updateMany) {
    throw new Error("Aggiornamenti non configurati. Esegui migrazioni Prisma e rigenera il client.");
  }

  const dismissalClient = getOptionalPrismaModel<{
    deleteMany?: (args: unknown) => Promise<unknown>;
  }>("featureUpdateDismissal");

  const id = (formData.get("updateId") as string) || "";
  const title = (formData.get("title") as string)?.trim();
  const bodyMarkdown = (formData.get("bodyMarkdown") as string)?.trim();
  const isActive = formData.get("isActive") === "on";
  const forceNew = formData.get("forceNew") === "on";

  if (!title || !bodyMarkdown) {
    throw new Error("Titolo e contenuto sono obbligatori.");
  }

  if (isActive) {
    await updateClient.updateMany({ where: { isActive: true }, data: { isActive: false } });
  }

  // If forceNew is checked or no ID exists, we create a new record
  const shouldCreateNew = forceNew || !id;

  const saved =
    shouldCreateNew
      ? ((await updateClient.create({
          data: { title, bodyMarkdown, isActive },
        })) as { id: string })
      : ((await updateClient.update({
          where: { id },
          data: { title, bodyMarkdown, isActive },
        })) as { id: string });

  // If we created a new one or forced a reset, we don't need to do anything else 
  // because new ID = no existing dismissals for it.
  // If we just UPDATED an existing one, and forceNew was checked (though redundant logic-wise above)
  // we would clear. But our logic above creates a new ID which is better for tracking history.

  await logAudit(admin, {
    action: shouldCreateNew ? "featureUpdate.created" : "featureUpdate.updated",
    entity: "FeatureUpdate",
    entityId: saved.id,
    metadata: { isActive, forceNew },
  });

  revalidatePath("/admin/aggiornamenti");
}

export default async function AdminUpdatesPage() {
  await requireUser([Role.ADMIN]);

  const latest = updateClient?.findFirst
    ? ((await updateClient.findFirst({ orderBy: { createdAt: "desc" } })) as
        | { id: string; title: string; bodyMarkdown: string; isActive: boolean; createdAt: Date; updatedAt: Date }
        | null)
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Aggiornamenti
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Popup nuove funzionalità</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Imposta un messaggio in Markdown che verrà mostrato allo staff (non ai pazienti) una sola
          volta per utente.
        </p>
      </div>

      {!updateClient?.findFirst ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Questo modulo richiede la migrazione Prisma e la rigenerazione del client (`prisma migrate` + `prisma generate`).
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Contenuto</h2>
          <p className="text-sm text-zinc-600">
            Supportati: titoli <code className="rounded bg-zinc-100 px-1">#</code>, sottotitoli{" "}
            <code className="rounded bg-zinc-100 px-1">##</code>, liste{" "}
            <code className="rounded bg-zinc-100 px-1">*</code>, grassetto{" "}
            <code className="rounded bg-zinc-100 px-1">**testo**</code> e immagini{" "}
            <code className="rounded bg-zinc-100 px-1">![alt](/updates/img.png)</code>.
          </p>
          <form action={saveFeatureUpdate} className="mt-4 space-y-4">
            <input type="hidden" name="updateId" value={latest?.id ?? ""} />
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Titolo
              <input
                name="title"
                defaultValue={latest?.title ?? "Novità"}
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Markdown
              <textarea
                name="bodyMarkdown"
                rows={12}
                defaultValue={
                  latest?.bodyMarkdown ??
                  "# Nuove funzionalità\n\n* Punto 1\n* Punto 2\n\n![Screenshot](/updates/example.png)\n"
                }
                className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>
            <div className="flex flex-col gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
                <input
                  type="checkbox"
                  name="isActive"
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
                  defaultChecked={latest?.isActive ?? true}
                />
                Mostra popup allo staff
              </label>

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
                <input
                  type="checkbox"
                  name="forceNew"
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
                />
                Crea come nuovo popup (resetta le visualizzazioni dello staff)
              </label>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 sm:w-auto"
                >
                  Salva configurazione
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Stato attuale</h2>
          {latest ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Stato:</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      latest.isActive ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {latest.isActive ? "Attivo" : "Disattivo"}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  Ultima modifica:{" "}
                  <span className="font-medium text-zinc-900">
                    {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(
                      latest.updatedAt
                    )}
                  </span>
                </div>
              </div>
              
              <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 border border-zinc-100">
                <p>
                  <span className="font-semibold">Titolo:</span> {latest.title}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">ID unico:</span> <code className="text-[10px]">{latest.id}</code>
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">Nessun messaggio configurato.</p>
          )}
          {latest ? (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-100 pb-2 mb-3">Anteprima messaggio</h3>
              <div>
                <FeatureUpdateMarkdownPreview markdown={latest.bodyMarkdown} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
