import Link from "next/link";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { EmailTemplateForm } from "@/components/EmailTemplateForm";
import { getEmailTemplateByName } from "@/lib/email-templates";
import {
  WELCOME_PATIENT_TEMPLATE,
  WELCOME_STAFF_TEMPLATE,
} from "@/lib/welcome-email";

export const metadata = createPageMetadata(PAGE_TITLES.messaggioBenvenuto);

export const revalidate = 60;

export default async function AdminWelcomeMessagePage() {
  await requireUser([Role.ADMIN]);

  const [staffTemplate, patientTemplate] = await Promise.all([
    getEmailTemplateByName(WELCOME_STAFF_TEMPLATE),
    getEmailTemplateByName(WELCOME_PATIENT_TEMPLATE),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Comunicazioni
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Messaggio di Benvenuto</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Personalizza le email inviate automaticamente ai nuovi membri dello staff e ai nuovi pazienti.
          I due messaggi sono indipendenti.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {staffTemplate ? (
          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Staff</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Inviata quando un account staff viene creato o riattivato.
              </p>
            </div>
            <EmailTemplateForm
              template={{
                name: staffTemplate.name,
                title: staffTemplate.description ?? staffTemplate.name,
                subject: staffTemplate.subject,
                body: staffTemplate.body,
                buttonColor: staffTemplate.buttonColor,
              }}
            />
          </section>
        ) : null}

        {patientTemplate ? (
          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Pazienti</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Inviata alla creazione del profilo paziente e quando si invia l&apos;accesso all&apos;area paziente.
              </p>
            </div>
            <EmailTemplateForm
              template={{
                name: patientTemplate.name,
                title: patientTemplate.description ?? patientTemplate.name,
                subject: patientTemplate.subject,
                body: patientTemplate.body,
                buttonColor: patientTemplate.buttonColor,
              }}
            />
          </section>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        <p>
          Per gli altri template transazionali (promemoria, follow-up, fatture) visita{" "}
          <Link href="/admin/emails" className="font-semibold text-emerald-700 hover:underline">
            Messaggi Emails
          </Link>
          .
        </p>
      </div>
    </div>
  );
}