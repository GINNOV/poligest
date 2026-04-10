import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getOptionalPrismaModel, runOptionalPrismaQuery } from "@/lib/prisma-models";
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

  const serviceClient = getOptionalPrismaModel<{ count?: () => Promise<number> }>("service");
  const anamnesisClient = getOptionalPrismaModel<{ count?: () => Promise<number> }>("anamnesisCondition");
  const closureClient = getOptionalPrismaModel<{ count?: () => Promise<number> }>("practiceClosure");
  const featureUpdateClient = getOptionalPrismaModel<{ count?: () => Promise<number> }>("featureUpdate");
  const consentModuleClient = getOptionalPrismaModel<{ count?: () => Promise<number> }>("consentModule");
  const emailTemplateClient = getOptionalPrismaModel<{ count?: () => Promise<number> }>("emailTemplate");
  const weeklyReportConfigClient = getOptionalPrismaModel<{
    findUnique?: (args: { where: { id: string } }) => Promise<{ id: string } | null>;
  }>("practiceWeeklyReportConfig");

  const weeklyReportAvailability = await runOptionalPrismaQuery(
    weeklyReportConfigClient?.findUnique
      ? () => weeklyReportConfigClient.findUnique!({ where: { id: "default" } })
      : undefined,
    null,
  );

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
      key: "weekly-report",
      title: "Report settimanale",
      description: "Invio automatico ai responsabili con visite, promemoria e risultati della settimana.",
      href: weeklyReportAvailability.available ? "/admin/report-settimanale" : undefined,
      badge: weeklyReportAvailability.available ? "Direzione" : "Non disponibile",
      tone: weeklyReportAvailability.available ? "primary" : "warning",
      disabled: !weeklyReportAvailability.available,
      icon: "📈",
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

  const cardBaseStyles = "group relative flex h-full flex-col justify-between rounded-3xl border p-6 transition-all duration-300";
  const cardHoverStyles = "hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-none";

  const renderShortcut = (item: AdminShortcut, sectionGradient: string) => {
    const CardContent = (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/50 bg-white/30 text-2xl shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              {item.icon ?? "🧭"}
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight text-zinc-900 dark:text-zinc-50">
                {item.title.replace("Sistema: ", "").replace("Messaggi ", "")}
              </h2>
              {item.badge ? (
                <span
                  className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    item.tone === "warning"
                      ? "bg-rose-500 text-white"
                      : "bg-white/60 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {item.description}
        </p>
      </div>
    );

    if (item.disabled) {
      return (
        <div
          key={item.key}
          className={`${cardBaseStyles} border-zinc-200 bg-zinc-50 opacity-60 grayscale cursor-not-allowed`}
        >
          {CardContent}
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t("comingSoon")}
          </div>
        </div>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href ?? "#"}
        className={`${cardBaseStyles} ${cardHoverStyles} ${sectionGradient} ${
          item.tone === "warning" 
            ? "border-rose-200 from-rose-50 to-rose-100/40 hover:border-rose-400 dark:border-rose-900/50 dark:from-rose-950/30 dark:to-rose-900/10" 
            : "hover:border-zinc-400 dark:hover:border-zinc-600"
        }`}
      >
        {CardContent}
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-12 pb-12">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-emerald-200 bg-gradient-to-br from-emerald-100/40 via-white to-emerald-50 p-8 shadow-sm dark:border-emerald-900/30 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/20">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-400">
            <span className="h-1 w-8 rounded-full bg-emerald-600" />
            {t("title")}
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-5xl">
            {t("subtitle")}
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium text-zinc-600 dark:text-zinc-400">
            {t("dashboardHint")}
          </p>
        </div>
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-900/20" />
      </div>

      <div className="space-y-8">
        <div className="flex items-center gap-4 border-l-4 border-emerald-500 pl-4">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Principali</h2>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {primaryShortcuts.map((item) => renderShortcut(item, "border-emerald-100/80 bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-emerald-900/10"))}
        </div>
      </div>

      {messageShortcuts.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center gap-4 border-l-4 border-blue-500 pl-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Comunicazioni</h2>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {messageShortcuts.map((item) => renderShortcut(item, "border-blue-100/80 bg-gradient-to-br from-blue-50 to-blue-100/30 dark:border-blue-900/30 dark:from-blue-950/20 dark:to-blue-900/10"))}
          </div>
        </div>
      )}

      {systemShortcuts.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center gap-4 border-l-4 border-purple-500 pl-4">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Sistema</h2>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {systemShortcuts.map((item) => renderShortcut(item, "border-purple-100/80 bg-gradient-to-br from-purple-50 to-purple-100/30 dark:border-purple-900/30 dark:from-purple-950/20 dark:to-purple-900/10"))}
          </div>
        </div>
      )}
    </div>
  );
}
