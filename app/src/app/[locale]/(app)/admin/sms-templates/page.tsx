import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SmsTemplateForm } from "@/components/sms-template-form";

async function createTemplate(formData: FormData) {
  "use server";
  await requireUser([Role.ADMIN]);

  const name = (formData.get("name") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  if (!name || !body) throw new Error("Nome o testo mancanti");

  await prisma.smsTemplate.create({
    data: { name, body },
  });

  revalidatePath("/admin/sms-templates");
}

async function deleteTemplate(formData: FormData) {
  "use server";
  await requireUser([Role.ADMIN]);
  const id = formData.get("id") as string;
  if (!id) throw new Error("Template mancante");
  await prisma.smsTemplate.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/sms-templates");
}

export default async function SmsTemplatesPage() {
  await requireUser([Role.ADMIN]);

  const [templates, lastLogs] = await Promise.all([
    prisma.smsTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.smsLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { template: true, patient: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          SMS / Notifiche
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Template SMS</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Gestisci i messaggi predefiniti inviati ai pazienti. I log degli invii recenti sono visibili sotto.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Template disponibili</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {templates.length}
            </span>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-600">Nessun template. Crea il primo qui sotto.</p>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900">{tpl.name}</p>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700">{tpl.body}</p>
                  </div>
                  <form action={deleteTemplate} data-confirm="Eliminare definitivamente questo template SMS?">
                    <input type="hidden" name="id" value={tpl.id} />
                    <FormSubmitButton className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50">
                      Elimina
                    </FormSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Nuovo template</h3>
            <SmsTemplateForm action={createTemplate} />
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Ultimi invii SMS</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {lastLogs.length}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {lastLogs.length === 0 ? (
              <p className="text-sm text-zinc-600">Nessun invio registrato.</p>
            ) : (
              lastLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-900">{log.to}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        log.status === "SENT" || log.status === "SIMULATED"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600">
                    {log.template?.name ? `${log.template.name} · ` : ""}
                    {log.patient ? `${log.patient.lastName} ${log.patient.firstName}` : ""}
                    {" · "}
                    {new Date(log.createdAt).toLocaleString("it-IT")}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-700">{log.body}</p>
                  {log.error ? (
                    <p className="text-[11px] text-rose-600">Errore: {log.error}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
