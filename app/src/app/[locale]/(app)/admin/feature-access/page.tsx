import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { FALLBACK_PERMISSIONS, FEATURES, type FeatureId } from "@/lib/feature-access";
import { ASSISTANT_ROLE } from "@/lib/roles";

const roles: Role[] = [Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY];

async function saveAccess(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);

  const entries = roles.flatMap((role) =>
    FEATURES.map((feature) => {
      const key = `${role}-${feature.id}`;
      const allowed = formData.get(key) === "on";
      return { role, feature: feature.id, allowed };
    }),
  );

  await prisma.$transaction([
    prisma.roleFeatureAccess.deleteMany({ where: { role: { in: roles } } }),
    prisma.roleFeatureAccess.createMany({ data: entries }),
  ]);

  await logAudit(admin, {
    action: "admin.feature_access.save",
    entity: "RoleFeatureAccess",
    metadata: { enabled: entries.filter((entry) => entry.allowed).length },
  });

  revalidatePath("/admin/feature-access");
}

export default async function FeatureAccessPage() {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");

  const savedAccess = await prisma.roleFeatureAccess.findMany({
    where: { role: { in: roles } },
  });

  const accessMap = new Map(savedAccess.map((access) => [`${access.role}-${access.feature}`, access.allowed]));

  const getAllowed = (role: Role, featureId: FeatureId) => {
    const existing = accessMap.get(`${role}-${featureId}`);
    if (existing !== undefined) return existing;
    return FALLBACK_PERMISSIONS[role]?.has(featureId) ?? false;
  };

  const roleLabels: Record<Role, string> = {
    [Role.ADMIN]: t("featureAccessRoleAdmin"),
    [Role.MANAGER]: t("featureAccessRoleManager"),
    [ASSISTANT_ROLE]: t("featureAccessRoleAssistant"),
    [Role.SECRETARY]: t("featureAccessRoleSecretary"),
    [Role.PATIENT]: "Paziente",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t("featureAccess")}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">{t("featureAccessHeading")}</h1>
          <p className="mt-1 text-sm text-zinc-600">{t("featureAccessSubtitle")}</p>
        </div>
        <div className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-800">
          {t("featureAccessLegend")}
        </div>
      </div>

      <form action={saveAccess} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{t("featureAccessRoleLabel")}</p>
                  <h2 className="text-lg font-semibold text-zinc-900">{roleLabels[role]}</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase text-emerald-800">
                  {FALLBACK_PERMISSIONS[role]?.size ?? 0} predefiniti
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {FEATURES.map((feature) => (
                  <label
                    key={feature.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-100 px-3 py-2 hover:border-emerald-200 hover:bg-emerald-50/40"
                  >
                    <input
                      type="checkbox"
                      name={`${role}-${feature.id}`}
                      defaultChecked={getAllowed(role, feature.id)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900">{feature.label}</p>
                      <p className="text-xs text-zinc-600">{feature.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-700">{t("featureAccessHelper")}</p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            {t("featureAccessSave")}
          </button>
        </div>
      </form>
    </div>
  );
}