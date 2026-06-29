import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { FormSubmitButton } from "@/components/form-submit-button";
import { SmsTemplateForm } from "@/components/sms-template-form";
import { DEFAULT_WHATSAPP_TEMPLATE, WHATSAPP_TEMPLATE_NAME } from "@/lib/whatsapp-template";

const textareaClassName =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-50 dark:focus:ring-emerald-500/20";

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

function formatLogStatus(status: string) {
  switch (status) {
    case "SENT":
      return "Inviato";
    case "SIMULATED":
      return "Simulato";
    case "FAILED":
      return "Fallito";
    default:
      return status;
  }
}

export const metadata = createPageMetadata(PAGE_TITLES.messaggiSms);

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
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Comunicazioni
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Messaggi SMS</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Gestisci i testi predefiniti per SMS e promemoria WhatsApp. Per credenziali e invio, configura{" "}
          <Link href="/admin/clicksend" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
            ClickSend
          </Link>{" "}
          e{" "}
          <Link href="/admin/whatsapp" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
            Kapso WhatsApp
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Promemoria WhatsApp</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Messaggio usato dal pulsante Promemoria negli appuntamenti.
            </p>
          </div>
          <form action={upsertWhatsappTemplate} className="space-y-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Testo messaggio
              <textarea
                name="body"
                rows={5}
                defaultValue={whatsappTemplate?.body ?? DEFAULT_WHATSAPP_TEMPLATE}
                className={textareaClassName}
                required
              />
            </label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Segnaposto supportati: {"{{nome}}, {{cognome}}, {{dottore}}, {{data_appuntamento}}, {{motivo_visita}}, {{note}}"}.
            </p>
            <FormSubmitButton className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600">
              Salva messaggio WhatsApp
            </FormSubmitButton>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Ultimi invii SMS</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Registro degli ultimi 20 invii registrati dall&apos;app.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {lastLogs.length}
            </span>
          </div>
          <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {lastLogs.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Nessun invio registrato.</p>
            ) : (
              lastLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">{log.to}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        log.status === "SENT" || log.status === "SIMULATED"
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {formatLogStatus(log.status)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {log.template?.name ? `${log.template.name} · ` : ""}
                    {log.patient ? `${log.patient.lastName} ${log.patient.firstName}` : ""}
                    {" · "}
                    {new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(
                      log.createdAt,
                    )}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{log.body}</p>
                  {log.error ? (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">Errore: {log.error}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Template SMS</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Testi riutilizzabili per invii manuali o automatici via SMS.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {visibleTemplates.length} template
            </span>
          </div>

          {visibleTemplates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
              Nessun template SMS. Crea il primo con il modulo qui sotto.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {visibleTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex h-full flex-col justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{tpl.name}</p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {tpl.body}
                    </p>
                  </div>
                  <form action={deleteTemplate} data-confirm="Eliminare definitivamente questo template SMS?">
                    <input type="hidden" name="id" value={tpl.id} />
                    <FormSubmitButton className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-950/40">
                      Elimina
                    </FormSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nuovo template SMS</h3>
            <SmsTemplateForm action={createTemplate} />
          </div>
        </section>
      </div>
    </div>
  );
}