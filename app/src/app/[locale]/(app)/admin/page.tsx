import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

type AdminShortcut = {
  key: string;
  title: string;
  description: string;
  href?: string;
  badge?: string;
  tone?: "neutral" | "primary" | "warning";
  disabled?: boolean;
  icon?: string;
};

export default async function AdminPage() {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");

  const prismaModels = prisma as unknown as Record<string, unknown>;
  const serviceClient = prismaModels["service"] as { count?: () => Promise<number> } | undefined;
  const anamnesisClient = prismaModels["anamnesisCondition"] as
    | { count?: () => Promise<number> }
    | undefined;
  const closureClient = prismaModels["practiceClosure"] as
    | { count?: () => Promise<number> }
    | undefined;
  const featureUpdateClient = prismaModels["featureUpdate"] as { count?: () => Promise<number> } | undefined;
  const consentModuleClient = prismaModels["consentModule"] as { count?: () => Promise<number> } | undefined;
  const emailTemplateClient = prismaModels["emailTemplate"] as { count?: () => Promise<number> } | undefined;

  const [
    usersCount,
    doctorsCount,
    auditCount,
    servicesCount,
    anamnesisCount,
    closuresCount,
    updatesCount,
    consentModulesCount,
    emailTemplatesCount,
    errorCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.doctor.count(),
    prisma.auditLog.count(),
    serviceClient?.count ? serviceClient.count() : Promise.resolve(0),
    anamnesisClient?.count ? anamnesisClient.count() : Promise.resolve(0),
    closureClient?.count ? closureClient.count() : Promise.resolve(0),
    featureUpdateClient?.count ? featureUpdateClient.count() : Promise.resolve(0),
    consentModuleClient?.count ? consentModuleClient.count() : Promise.resolve(0),
    emailTemplateClient?.count ? emailTemplateClient.count() : Promise.resolve(0),
    prisma.auditLog.count({ where: { action: "error.reported" } }),
  ]);

  const shortcuts: AdminShortcut[] = [
    {
      key: "doctors",
      title: t("doctors"),
      description: "Crea, aggiorna e assegna i medici dello studio.",
      href: "/medici",
      badge: `${doctorsCount} medici`,
      tone: "primary",
      icon: "🩺",
    },
    {
      key: "calendar",
      title: t("calendar"),
      description: t("calendarDescription"),
      href: "/admin/calendario",
      badge: closuresCount ? `${closuresCount} chiusure` : "Disponibilità",
      tone: "primary",
      icon: "📅",
    },
    {
      key: "updates",
      title: "Sistema: Nuovi Utenti",
      description: "Popup nuove funzionalità visibile allo staff una sola volta.",
      href: "/admin/aggiornamenti",
      badge: updatesCount ? `${updatesCount} versioni` : "Annunci",
      tone: "neutral",
      icon: "✨",
    },
    {
      key: "consent-modules",
      title: "Moduli consenso",
      description: "Carica testi, attiva moduli e definisci quelli obbligatori.",
      href: "/admin/consensi",
      badge: consentModulesCount ? `${consentModulesCount} moduli` : "Nessun modulo",
      tone: "primary",
      icon: "📄",
    },
    {
      key: "email-templates",
      title: "Messaggi Emails",
      description: "Editor, anteprima e invio di test per le email di sistema.",
      href: "/admin/emails",
      badge: emailTemplatesCount ? `${emailTemplatesCount} template` : "Nessun template",
      tone: "primary",
      icon: "📧",
    },
    {
      key: "users",
      title: t("users"),
      description: "Ruoli, accessi e attivazione degli account di sistema.",
      href: "/admin/utenti",
      badge: `${usersCount} utenti`,
      tone: "neutral",
      icon: "👤",
    },
    {
      key: "feature-access",
      title: t("featureAccess"),
      description: t("featureAccessDescription"),
      href: "/admin/feature-access",
      badge: "Permessi",
      tone: "primary",
      icon: "🛡️",
    },
    {
      key: "errors",
      title: "Sistema: Errori",
      description: "Registro errori applicativi con codici per il supporto.",
      href: "/admin/errori",
      badge: errorCount ? `${errorCount} errori` : "Nessun errore",
      tone: errorCount ? "warning" : "neutral",
      icon: "🚨",
    },
    {
      key: "audit",
      title: "Sistema: Audit",
      description: "Registro di tutti gli eventi di sistema e modifiche ai dati.",
      href: "/admin/audit",
      badge: t("auditBadge", { count: auditCount }),
      tone: "neutral",
      icon: "🧾",
    },
    {
      key: "privacy",
      title: t("privacy"),
      description: t("privacyDescription"),
      href: "/admin/privacy",
      badge: "GDPR",
      tone: "primary",
      icon: "🔒",
    },
    {
      key: "services",
      title: t("services"),
      description: "Catalogo delle prestazioni: nome, descrizione e costo base.",
      href: "/admin/servizi",
      badge: `${servicesCount} servizi`,
      tone: "neutral",
      icon: "🧰",
    },
    {
      key: "anamnesis",
      title: t("anamnesis"),
      description: "Personalizza le condizioni cliniche mostrate in Anamnesi generale.",
      href: "/admin/anamnesi",
      badge: `${anamnesisCount} voci`,
      tone: "neutral",
      icon: "🫀",
    },
    {
      key: "sms-templates",
      title: "Messaggi SMS",
      description: "Gestisci testi predefiniti e consulta gli ultimi invii.",
      href: "/admin/sms-templates",
      badge: "Notifiche",
      tone: "primary",
      icon: "✉️",
    },
    {
      key: "clicksend",
      title: "Messaggi Clicksend",
      description: "Configura le credenziali per l'invio SMS e verifica lo stato.",
      href: "/admin/clicksend",
      badge: "Integrazione",
      tone: "primary",
      icon: "📨",
    },
    {
      key: "reset",
      title: t("reset"),
      description: "Ripristino del sistema ai dati di esempio ed esportazione dati.",
      href: "/admin/reset",
      badge: t("dangerZone"),
      tone: "warning",
      icon: "⚠️",
    },
  ];
  const sortedShortcuts = [...shortcuts].sort((a, b) =>
    a.title.localeCompare(b.title, "it", { sensitivity: "base" })
  );
  const isSystem = (item: AdminShortcut) => item.title.startsWith("Sistema:");
  const isMessages = (item: AdminShortcut) =>
    item.title.startsWith("Messaggi SMS") ||
    item.title.startsWith("Messaggi Emails") ||
    item.title.startsWith("Messaggi Clicksend");
  const systemShortcuts = sortedShortcuts.filter((item) => isSystem(item));
  const messageShortcuts = sortedShortcuts.filter((item) => isMessages(item));
  const primaryShortcuts = sortedShortcuts.filter(
    (item) => !isSystem(item) && !isMessages(item)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          {t("title")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          {t("subtitle")}
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          {t("dashboardHint")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {primaryShortcuts.map((item) => (
          <div
            key={item.key}
            className="relative flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50 text-lg">
                    {item.icon ?? "🧭"}
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900">{item.title}</h2>
                </div>
                {item.badge ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.tone === "warning"
                        ? "bg-amber-50 text-amber-800"
                        : item.tone === "primary"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-600">{item.description}</p>
            </div>

            <div className="mt-4 flex items-center justify-end">
              {item.disabled ? (
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-300 text-sm font-semibold text-zinc-400"
                  aria-disabled="true"
                  title={t("comingSoon")}
                >
                  →
                </span>
              ) : (
                <Link
                  href={item.href ?? "#"}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  aria-label={t("open")}
                  title={t("open")}
                >
                  →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {messageShortcuts.length > 0 ? (
        <>
          <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <div className="h-px flex-1 bg-zinc-200" />
            Messaggi
            <div className="h-px flex-1 bg-zinc-200" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {messageShortcuts.map((item) => (
              <div
                key={item.key}
                className="relative flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50 text-lg">
                        {item.icon ?? "🧭"}
                      </div>
                      <h2 className="text-lg font-semibold text-zinc-900">{item.title}</h2>
                    </div>
                    {item.badge ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.tone === "warning"
                            ? "bg-amber-50 text-amber-800"
                            : item.tone === "primary"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-600">{item.description}</p>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  {item.disabled ? (
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-300 text-sm font-semibold text-zinc-400"
                      aria-disabled="true"
                      title={t("comingSoon")}
                    >
                      →
                    </span>
                  ) : (
                    <Link
                      href={item.href ?? "#"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-600"
                      aria-label={t("open")}
                      title={t("open")}
                    >
                      →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {systemShortcuts.length > 0 ? (
        <>
          <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <div className="h-px flex-1 bg-zinc-200" />
            Sistema
            <div className="h-px flex-1 bg-zinc-200" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {systemShortcuts.map((item) => (
              <div
                key={item.key}
                className="relative flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-2xl border border-zinc-200 bg-zinc-50 text-lg">
                        {item.icon ?? "🧭"}
                      </div>
                      <h2 className="text-lg font-semibold text-zinc-900">{item.title}</h2>
                    </div>
                    {item.badge ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.tone === "warning"
                            ? "bg-amber-50 text-amber-800"
                            : item.tone === "primary"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-600">{item.description}</p>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  {item.disabled ? (
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-300 text-sm font-semibold text-zinc-400"
                      aria-disabled="true"
                      title={t("comingSoon")}
                    >
                      →
                    </span>
                  ) : (
                    <Link
                      href={item.href ?? "#"}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-600"
                      aria-label={t("open")}
                      title={t("open")}
                    >
                      →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
