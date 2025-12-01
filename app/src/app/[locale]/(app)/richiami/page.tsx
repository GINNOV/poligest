import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { RecallStatus, Role } from "@prisma/client";

async function createRecallRule(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const name = (formData.get("name") as string)?.trim();
  const serviceType = (formData.get("serviceType") as string)?.trim();
  const intervalDays = Number(formData.get("intervalDays"));
  const message = (formData.get("message") as string)?.trim() || null;
  if (!name || !serviceType || Number.isNaN(intervalDays) || intervalDays <= 0) {
    throw new Error("Dati regola non validi");
  }

  await prisma.recallRule.create({
    data: { name, serviceType, intervalDays, message },
  });
  revalidatePath("/richiami");
}

async function scheduleRecall(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const patientId = formData.get("patientId") as string;
  const ruleId = formData.get("ruleId") as string;
  const dueAt = formData.get("dueAt") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  if (!patientId || !ruleId || !dueAt) throw new Error("Dati mancanti");

  await prisma.recall.create({
    data: {
      patientId,
      ruleId,
      dueAt: new Date(dueAt),
      status: RecallStatus.PENDING,
      notes,
    },
  });
  revalidatePath("/richiami");
}

async function updateRecallStatus(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const recallId = formData.get("recallId") as string;
  const status = formData.get("status") as RecallStatus;
  if (!recallId || !status) throw new Error("Richiamo non valido");

  await prisma.recall.update({
    where: { id: recallId },
    data: { status, lastContactAt: new Date() },
  });
  revalidatePath("/richiami");
}

export default async function RichiamiPage() {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const [recalls, rules, patients] = await Promise.all([
    prisma.recall.findMany({
      where: { status: RecallStatus.PENDING, dueAt: { lte: soon } },
      orderBy: { dueAt: "asc" },
      include: { patient: true, rule: true },
      take: 50,
    }),
    prisma.recallRule.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.patient.findMany({ orderBy: { lastName: "asc" } }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="col-span-2 space-y-4">
        <div>
          <p className="text-sm text-zinc-600">Richiami</p>
          <h1 className="text-2xl font-semibold text-zinc-900">Da contattare</h1>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="divide-y divide-zinc-100">
            {recalls.length === 0 ? (
              <p className="px-4 py-4 text-sm text-zinc-600">Nessun richiamo imminente.</p>
            ) : (
              recalls.map((recall) => {
                const overdue = recall.dueAt < now;
                return (
                  <div key={recall.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-900">
                        {recall.patient.lastName} {recall.patient.firstName}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {recall.rule.name} ·{" "}
                        {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(recall.dueAt)}
                      </span>
                      {recall.notes ? (
                        <span className="text-xs text-zinc-500">{recall.notes}</span>
                      ) : null}
                    </div>
                    <form action={updateRecallStatus} className="flex items-center gap-2">
                      <input type="hidden" name="recallId" value={recall.id} />
                      <select
                        name="status"
                        defaultValue={RecallStatus.CONTACTED}
                        className={`h-9 rounded-full border px-3 text-xs font-semibold outline-none transition ${
                          overdue
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        <option value={RecallStatus.CONTACTED}>Contattato</option>
                        <option value={RecallStatus.COMPLETED}>Prenotato</option>
                        <option value={RecallStatus.SKIPPED}>Saltato</option>
                      </select>
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
                      >
                        Aggiorna
                      </button>
                    </form>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Nuova regola</h2>
          <form action={createRecallRule} className="mt-3 space-y-3 text-sm">
            <input
              name="name"
              placeholder="Nome regola (es. Igiene semestrale)"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="serviceType"
              placeholder="Tipo servizio"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="intervalDays"
              type="number"
              min="1"
              placeholder="Intervallo (giorni)"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <textarea
              name="message"
              placeholder="Messaggio (opzionale)"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              rows={2}
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Salva regola
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Programma richiamo</h2>
          <form action={scheduleRecall} className="mt-3 space-y-3 text-sm">
            <select
              name="patientId"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona paziente
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}
                </option>
              ))}
            </select>
            <select
              name="ruleId"
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Seleziona regola
              </option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <input
              name="dueAt"
              type="date"
              required
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              name="notes"
              placeholder="Note"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Aggiungi richiamo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
