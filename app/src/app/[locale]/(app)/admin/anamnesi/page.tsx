import { Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  createAnamnesisConditionAction,
  updateAnamnesisConditionAction,
  deleteAnamnesisConditionAction,
} from "@/lib/patients/actions";

type AnamnesisConditionRecord = {
  id: string;
  label: string;
};

type AnamnesisClient = {
  findMany: (args?: { orderBy?: { createdAt: "desc" | "asc" } }) => Promise<AnamnesisConditionRecord[]>;
};

function getAnamnesisClient() {
  const prismaModels = prisma as unknown as Record<string, AnamnesisClient | undefined>;
  const client = prismaModels["anamnesisCondition"];
  if (!client?.findMany) {
    throw new Error("Anamnesi non configurata. Esegui migrazioni Prisma e rigenera il client.");
  }
  return client;
}

export default async function AnamnesisSettingsPage() {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");

  const anamnesisClient = getAnamnesisClient();
  const conditions = await anamnesisClient.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t("anamnesis")}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t("anamnesisTitle")}</h1>
          <p className="text-sm text-zinc-600">{t("anamnesisSubtitle")}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {conditions.length} {conditions.length === 1 ? "condizione" : "condizioni"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("anamnesisCreate")}</h2>
          <p className="text-sm text-zinc-600">{t("anamnesisCreateHint")}</p>
          <form action={createAnamnesisConditionAction} className="mt-4 grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              {t("anamnesisName")}
              <input
                name="label"
                required
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder={t("anamnesisNamePlaceholder")}
              />
            </label>
            <div>
              <Button
                type="submit"
                variant="primary"
              >
                {t("anamnesisCreateButton")}
              </Button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("anamnesisList")}</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {conditions.length}
            </span>
          </div>
          <div className="mt-4 divide-y divide-zinc-100">
            {conditions.length === 0 ? (
              <p className="py-4 text-sm text-zinc-600">{t("anamnesisEmpty")}</p>
            ) : (
              conditions.map((condition) => (
                <div
                  key={condition.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <form action={updateAnamnesisConditionAction} className="flex flex-1 items-center gap-3">
                    <input type="hidden" name="conditionId" value={condition.id} />
                    <input
                      name="label"
                      defaultValue={condition.label}
                      className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      {t("anamnesisSave")}
                    </button>
                  </form>
                  <form
                    action={deleteAnamnesisConditionAction}
                    className="flex justify-start sm:justify-end"
                    data-confirm="Eliminare definitivamente questa condizione?"
                  >
                    <input type="hidden" name="conditionId" value={condition.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                    >
                      {t("anamnesisDelete")}
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
