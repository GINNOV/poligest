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
};

export default async function AdminPage() {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");

  const serviceClient = (prisma as any).service as { count: () => Promise<number> };

  const [usersCount, doctorsCount, auditCount, servicesCount] = await Promise.all([
    prisma.user.count(),
    prisma.doctor.count(),
    prisma.auditLog.count(),
    serviceClient?.count ? serviceClient.count() : Promise.resolve(0),
  ]);

  const shortcuts: AdminShortcut[] = [
    {
      key: "doctors",
      title: t("doctors"),
      description: "Crea, aggiorna e assegna i medici dello studio.",
      href: "/medici",
      badge: `${doctorsCount} medici`,
      tone: "primary",
    },
    {
      key: "users",
      title: t("users"),
      description: "Ruoli, accessi e attivazione degli account di sistema.",
      href: "/admin/utenti",
      badge: `${usersCount} utenti`,
      tone: "neutral",
    },
    {
      key: "feature-access",
      title: t("featureAccess"),
      description: t("featureAccessDescription"),
      href: "/admin/feature-access",
      badge: "Permessi",
      tone: "primary",
    },
    {
      key: "audit",
      title: t("audit"),
      description: "Registro di tutti gli eventi di sistema e modifiche ai dati.",
      href: "/admin/audit",
      badge: t("auditBadge", { count: auditCount }),
      tone: "neutral",
    },
    {
      key: "services",
      title: t("services"),
      description: "Catalogo delle prestazioni: nome, descrizione e costo base.",
      href: "/admin/servizi",
      badge: `${servicesCount} servizi`,
      tone: "neutral",
    },
    {
      key: "inventory",
      title: t("inventory"),
      description: "Giacenze e movimenti del magazzino.",
      href: "/magazzino",
      badge: "Operativo",
      tone: "neutral",
    },
    {
      key: "settings",
      title: t("settings"),
      description: "Preferenze generali e integrazioni (presto disponibile).",
      disabled: true,
      badge: t("comingSoon"),
      tone: "neutral",
    },
    {
      key: "sms-templates",
      title: "Template SMS",
      description: "Gestisci testi predefiniti e consulta gli ultimi invii.",
      href: "/admin/sms-templates",
      badge: "Notifiche",
      tone: "primary",
    },
    {
      key: "reset",
      title: t("reset"),
      description: "Ripristino del sistema ai dati di esempio ed esportazione dati.",
      href: "/admin/reset",
      badge: t("dangerZone"),
      tone: "warning",
    },
  ];

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
        {shortcuts.map((item) => (
          <div
            key={item.key}
            className="relative flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">{item.title}</h2>
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

            {item.disabled ? (
              <button
                className="mt-4 inline-flex items-center justify-center rounded-full border border-dashed border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-500"
                aria-disabled="true"
              >
                {t("comingSoon")}
              </button>
            ) : (
              <Link
                href={item.href ?? "#"}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                {t("open")}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
