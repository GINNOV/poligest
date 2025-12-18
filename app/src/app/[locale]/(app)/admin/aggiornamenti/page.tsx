import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";

const updateClient = (prisma as unknown as Record<string, unknown>)["featureUpdate"] as
  | {
      findFirst?: (args: unknown) => Promise<unknown>;
      updateMany?: (args: unknown) => Promise<unknown>;
      create?: (args: unknown) => Promise<unknown>;
      update?: (args: unknown) => Promise<unknown>;
    }
  | undefined;

async function saveFeatureUpdate(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  if (!updateClient?.create || !updateClient?.update || !updateClient?.updateMany) {
    throw new Error("Aggiornamenti non configurati. Esegui migrazioni Prisma e rigenera il client.");
  }

  const id = (formData.get("updateId") as string) || "";
  const title = (formData.get("title") as string)?.trim();
  const bodyMarkdown = (formData.get("bodyMarkdown") as string)?.trim();
  const isActive = formData.get("isActive") === "on";

  if (!title || !bodyMarkdown) {
    throw new Error("Titolo e contenuto sono obbligatori.");
  }

  if (isActive) {
    await updateClient.updateMany({ where: { isActive: true }, data: { isActive: false } });
  }

  const saved =
    id
      ? ((await updateClient.update({
          where: { id },
          data: { title, bodyMarkdown, isActive },
        })) as { id: string })
      : ((await updateClient.create({
          data: { title, bodyMarkdown, isActive },
        })) as { id: string });

  await logAudit(admin, {
    action: "featureUpdate.saved",
    entity: "FeatureUpdate",
    entityId: saved.id,
    metadata: { isActive },
  });

  revalidatePath("/admin/aggiornamenti");
}

export default async function AdminUpdatesPage() {
  await requireUser([Role.ADMIN]);

  const latest = updateClient?.findFirst
    ? ((await updateClient.findFirst({ orderBy: { createdAt: "desc" } })) as
        | { id: string; title: string; bodyMarkdown: string; isActive: boolean; createdAt: Date }
        | null)
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Aggiornamenti
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Popup nuove funzionalità</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Imposta un messaggio in Markdown che verrà mostrato allo staff (non ai pazienti) una sola
          volta per utente.
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Le immagini vanno caricate in <code className="rounded bg-zinc-100 px-1">public/updates</code> e
          referenziate come <code className="rounded bg-zinc-100 px-1">/updates/nome-file.png</code>.
        </p>
      </div>

      {!updateClient?.findFirst ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Questo modulo richiede la migrazione Prisma e la rigenerazione del client (`prisma migrate` + `prisma generate`).
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Contenuto</h2>
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
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <input
                type="checkbox"
                name="isActive"
                className="h-4 w-4 rounded border-zinc-300"
                defaultChecked={latest?.isActive ?? true}
              />
              Mostra popup allo staff
            </label>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Salva
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Stato attuale</h2>
          {latest ? (
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Titolo</span>
                <span className="font-semibold text-zinc-900">{latest.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Attivo</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    latest.isActive ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  {latest.isActive ? "Sì" : "No"}
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                Ultimo aggiornamento:{" "}
                {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(
                  latest.createdAt
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-600">Nessun messaggio configurato.</p>
          )}
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Suggerimento: usa immagini leggere (PNG/JPG) e nomi file semplici (es.{" "}
            <code className="rounded bg-zinc-100 px-1">updates/v1-calendar.png</code>).
          </div>
        </div>
      </div>
    </div>
  );
}
