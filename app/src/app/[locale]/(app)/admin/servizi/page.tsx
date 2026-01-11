import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const serviceClient = (prisma as any).service as {
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  findMany: (args?: any) => Promise<any[]>;
};

async function createService(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const costBasisRaw = (formData.get("costBasis") as string)?.trim();

  if (!name || !costBasisRaw) {
    throw new Error("Nome e costo base sono obbligatori");
  }

  const cost = Number.parseFloat(costBasisRaw.replace(",", "."));
  if (Number.isNaN(cost)) {
    throw new Error("Costo base non valido");
  }

  const service = await serviceClient.create({
    data: {
      name,
      description,
      costBasis: new Prisma.Decimal(cost),
    },
  });

  await logAudit(admin, {
    action: "service.created",
    entity: "Service",
    entityId: service.id,
    metadata: { name, costBasis: cost },
  });

  revalidatePath("/admin/servizi");
}

async function updateService(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const id = (formData.get("serviceId") as string) || "";
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const costBasisRaw = (formData.get("costBasis") as string)?.trim();

  if (!id || !name || !costBasisRaw) {
    throw new Error("Dati servizio non validi");
  }

  const cost = Number.parseFloat(costBasisRaw.replace(",", "."));
  if (Number.isNaN(cost)) {
    throw new Error("Costo base non valido");
  }

  const service = await serviceClient.update({
    where: { id },
    data: {
      name,
      description,
      costBasis: new Prisma.Decimal(cost),
    },
  });

  await logAudit(admin, {
    action: "service.updated",
    entity: "Service",
    entityId: service.id,
    metadata: { name, costBasis: cost },
  });

  revalidatePath("/admin/servizi");
}

async function deleteService(formData: FormData) {
  "use server";

  const admin = await requireUser([Role.ADMIN]);
  const id = (formData.get("serviceId") as string) || "";
  if (!id) throw new Error("Servizio non valido");

  await serviceClient.delete({ where: { id } });

  await logAudit(admin, {
    action: "service.deleted",
    entity: "Service",
    entityId: id,
  });

  revalidatePath("/admin/servizi");
}

export default async function ServicesPage() {
  await requireUser([Role.ADMIN]);
  const t = await getTranslations("admin");

  const services = await serviceClient.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {t("services")}
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900">{t("servicesTitle")}</h1>
          <p className="text-sm text-zinc-600">{t("servicesSubtitle")}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {services.length} {services.length === 1 ? "servizio" : "servizi"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">{t("servicesCreate")}</h2>
          <p className="text-sm text-zinc-600">{t("servicesCreateHint")}</p>
          <form action={createService} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              {t("servicesName")}
              <input
                name="name"
                required
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder={t("servicesNamePlaceholder")}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              {t("servicesCost")}
              <input
                name="costBasis"
                type="number"
                step="0.01"
                min="0"
                required
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              {t("servicesDescription")}
              <textarea
                name="description"
                rows={3}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder={t("servicesDescriptionPlaceholder")}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                {t("servicesCreateButton")}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">{t("servicesList")}</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
              {services.length}
            </span>
          </div>
          <div className="mt-4 divide-y divide-zinc-100">
            {services.length === 0 ? (
              <p className="py-4 text-sm text-zinc-600">{t("servicesEmpty")}</p>
            ) : (
              services.map((service: any) => (
                <div
                  key={service.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <form
                    action={updateService}
                    className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.2fr,1fr] sm:items-center sm:gap-3"
                  >
                    <input type="hidden" name="serviceId" value={service.id} />
                    <div className="space-y-2 sm:col-span-2">
                      <input
                        name="name"
                        defaultValue={service.name}
                        className="h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <textarea
                        name="description"
                        defaultValue={service.description ?? ""}
                        rows={2}
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        placeholder={t("servicesDescriptionPlaceholder")}
                      />
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                      <label className="flex flex-col gap-1 text-xs font-semibold text-zinc-700">
                        {t("servicesCost")}
                        <input
                          name="costBasis"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={service.costBasis.toString()}
                          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                      >
                        {t("servicesSave")}
                      </button>
                    </div>
                  </form>
                  <form
                    action={deleteService}
                    className="flex justify-start sm:justify-end"
                    data-confirm="Eliminare definitivamente questo servizio?"
                  >
                    <input type="hidden" name="serviceId" value={service.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                    >
                      {t("servicesDelete")}
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
