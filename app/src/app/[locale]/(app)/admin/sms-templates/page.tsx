import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SmsTemplateForm } from "@/components/sms-template-form";
import { DEFAULT_WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_NAME } from "@/lib/whatsapp-template";

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

async function upsertWhatsappTemplate(formData: FormData) {
  "use server";
  await requireUser([Role.ADMIN]);
  const body = (formData.get("body") as string)?.trim();
  if (!body) throw new Error("Testo mancante");
  await prisma.smsTemplate.upsert({
    where: { name: WHATSAPP_TEMPLATE_NAME },
    update: { body },
    create: { name: WHATSAPP_TEMPLATE_NAME, body },
  });
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
  const whatsappTemplate = templates.find((tpl) => tpl.name === WHATSAPP_TEMPLATE_NAME) ?? null;
  const visibleTemplates = templates.filter((tpl) => tpl.name !== WHATSAPP_TEMPLATE_NAME);

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
          <details className="group rounded-xl border border-emerald-100 bg-emerald-50/60 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-900">
              <span>Promemoria WhatsApp</span>
              <svg
                className="h-4 w-4 text-emerald-700 transition-transform duration-200 group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-emerald-100 px-4 pb-4 pt-3">
              <p className="text-xs text-emerald-700">
                Messaggio usato per il pulsante Promemoria negli appuntamenti.
              </p>
              <form action={upsertWhatsappTemplate} className="mt-3 space-y-3 text-sm">
                <label className="flex flex-col gap-1">
                  Testo messaggio
                  <textarea
                    name="body"
                    defaultValue={whatsappTemplate?.body ?? DEFAULT_WHATSAPP_TEMPLATE}
                    className="h-28 rounded-lg border border-emerald-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </label>
                <p className="text-xs text-emerald-700">
                Segnaposto supportati: {"{{nome}}, {{cognome}}, {{dottore}}, {{data_appuntamento}}, {{motivo_visita}}, {{note}}"}.
                </p>
                <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
                  Aggiorna messaggio
                </FormSubmitButton>
              </form>
            </div>
          </details>

          <details className="group rounded-xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>Template SMS</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                  {visibleTemplates.length}
                </span>
                <svg
                  className="h-4 w-4 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </summary>
            <div className="border-t border-zinc-200 px-4 pb-4 pt-3">
              {visibleTemplates.length === 0 ? (
                <p className="text-sm text-zinc-600">Nessun template. Crea il primo qui sotto.</p>
              ) : (
                <div className="space-y-3">
                  {visibleTemplates.map((tpl) => (
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

              <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">Nuovo template</h3>
                <SmsTemplateForm action={createTemplate} />
              </div>
            </div>
          </details>
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
