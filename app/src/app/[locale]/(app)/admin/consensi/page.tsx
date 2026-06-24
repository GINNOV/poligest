import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";

async function saveConsentModule(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const moduleId = (formData.get("moduleId") as string) ?? "";
  const name = (formData.get("name") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const active = formData.get("active") === "on";
  const required = formData.get("required") === "on";

  if (!name || !content) {
    throw new Error("Nome e contenuto sono obbligatori.");
  }

  const nextSortOrder = async () => {
    const latest = await prisma.consentModule.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return (latest?.sortOrder ?? -1) + 1;
  };

  const saved = moduleId
    ? await prisma.consentModule.update({
        where: { id: moduleId },
        data: { name, content, active, required },
      })
    : await prisma.consentModule.create({
        data: { name, content, active, required, sortOrder: await nextSortOrder() },
      });

  await logAudit(admin, {
    action: "consentModule.saved",
    entity: "ConsentModule",
    entityId: saved.id,
    metadata: { active, required, sortOrder: saved.sortOrder },
  });

  revalidatePath("/[locale]/admin/consensi", "page");
}

async function deleteConsentModule(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const moduleId = (formData.get("moduleId") as string) ?? "";
  if (!moduleId) {
    throw new Error("Modulo non valido.");
  }

  await prisma.$transaction([
    prisma.patientConsent.deleteMany({ where: { moduleId } }),
    prisma.consentModule.delete({ where: { id: moduleId } }),
  ]);

  await logAudit(admin, {
    action: "consentModule.deleted",
    entity: "ConsentModule",
    entityId: moduleId,
  });

  revalidatePath("/[locale]/admin/consensi", "page");
}

export const metadata = createPageMetadata(PAGE_TITLES.moduliConsenso);

export default async function AdminConsentModulesPage() {
  await requireUser([Role.ADMIN]);

  const modules = await prisma.consentModule.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Consensi
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Moduli consenso dinamici</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Gestisci i moduli che appaiono nella scheda paziente. Puoi attivare/disattivare e segnare quelli obbligatori.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Nuovo modulo</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Il contenuto supporta titoli <code className="rounded bg-zinc-100 px-1">#</code>, sottotitoli{" "}
            <code className="rounded bg-zinc-100 px-1">##</code>, liste{" "}
            <code className="rounded bg-zinc-100 px-1">*</code> e grassetto{" "}
            <code className="rounded bg-zinc-100 px-1">**testo**</code>.
          </p>
          <form action={saveConsentModule} className="mt-4 space-y-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Nome modulo
              <input
                name="name"
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Privacy, Trattamento, Marketing..."
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              Contenuto
              <textarea
                name="content"
                rows={10}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Inserisci il testo dell'informativa"
                required
              />
            </label>
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-zinc-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="active" className="h-4 w-4 rounded border-zinc-300" defaultChecked />
                Attivo
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="required" className="h-4 w-4 rounded border-zinc-300" />
                Obbligatorio
              </label>
            </div>
            <Button
              type="submit"
              variant="primary"
            >
              Aggiorna modulo
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          {modules.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Nessun modulo configurato.
            </div>
          ) : (
            modules.map((module) => (
              <div key={module.id} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <form action={saveConsentModule} className="space-y-4">
                  <input type="hidden" name="moduleId" value={module.id} />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-zinc-900">Modulo</p>
                      <p className="text-xs text-zinc-500">Aggiorna nome, testo e stato.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {module.required ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
                          Obbligatorio
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-600">
                          Facoltativo
                        </span>
                      )}
                      {module.active ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                          Attivo
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                          Disattivo
                        </span>
                      )}
                    </div>
                  </div>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                    Nome modulo
                    <input
                      name="name"
                      defaultValue={module.name}
                      className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                    Contenuto
                    <textarea
                      name="content"
                      rows={8}
                      defaultValue={module.content}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      required
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-zinc-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="active"
                        className="h-4 w-4 rounded border-zinc-300"
                        defaultChecked={module.active}
                      />
                      Attivo
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="required"
                        className="h-4 w-4 rounded border-zinc-300"
                        defaultChecked={module.required}
                      />
                      Obbligatorio
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                    >
                      Aggiorna modifiche
                    </Button>
                  </div>
                </form>
                <form
                  action={deleteConsentModule}
                  className="mt-3"
                  data-confirm="Eliminare definitivamente questo modulo di consenso?"
                >
                  <input type="hidden" name="moduleId" value={module.id} />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                  >
                    Elimina modulo
                  </Button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
