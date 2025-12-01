import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export default async function PazientiPage() {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const t = await getTranslations("patients");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-600">{t("subtitle")}</p>
      <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        {t("placeholder")}
      </div>
    </div>
  );
}
