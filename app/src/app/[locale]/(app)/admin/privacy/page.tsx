import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { applyRetentionCleanup, GDPR_RETENTION_DAYS } from "@/lib/gdpr";
import { logAudit } from "@/lib/audit";
import { redirect } from "next/navigation";
import { PageToastTrigger } from "@/components/page-toast-trigger";

async function applyRetentionAction() {
  "use server";

  const user = await requireUser([Role.ADMIN]);

  try {
    const summary = await applyRetentionCleanup();
    await logAudit(user, {
      action: "gdpr.retention.cleaned",
      entity: "System",
      metadata: summary,
    });
    redirect(`/admin/privacy?retentionSuccess=${encodeURIComponent("Retention completata.")}`);
  } catch (error) {
    redirect(`/admin/privacy?retentionError=${encodeURIComponent("Retention non riuscita.")}`);
  }
}

export default async function AdminPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");
  const resolved = await searchParams;
  const retentionSuccess =
    typeof resolved.retentionSuccess === "string" ? resolved.retentionSuccess : null;
  const retentionError =
    typeof resolved.retentionError === "string" ? resolved.retentionError : null;

  return (
    <div className="space-y-6">
      <PageToastTrigger
        messages={[
          { key: "retentionSuccess", message: retentionSuccess ?? "", variant: "success" },
          { key: "retentionError", message: retentionError ?? "", variant: "error" },
        ]}
      />
      <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          {t("privacy")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{t("privacyTitle")}</h1>
        <p className="mt-2 text-sm text-zinc-600">{t("privacySubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">{t("dsarTitle")}</h2>
          <p className="mt-2 text-sm text-zinc-600">{t("dsarDescription")}</p>
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            {t("dsarHint")}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">{t("retentionTitle")}</h2>
          <p className="mt-2 text-sm text-zinc-600">{t("retentionDescription")}</p>
          <ul className="mt-3 space-y-1 text-xs text-zinc-600">
            <li>Audit log: {GDPR_RETENTION_DAYS.auditLogs} giorni</li>
            <li>SMS log: {GDPR_RETENTION_DAYS.smsLogs} giorni</li>
            <li>Notifiche ricorrenti: {GDPR_RETENTION_DAYS.recurringMessageLogs} giorni</li>
            <li>Reminder appuntamenti: {GDPR_RETENTION_DAYS.appointmentReminders} giorni</li>
          </ul>
          <form action={applyRetentionAction} className="mt-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {t("retentionButton")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
