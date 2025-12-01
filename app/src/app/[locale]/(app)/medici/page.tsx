import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import Link from "next/link";

async function createDoctor(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);

  const name = (formData.get("name") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim() || "Odontoiatra";

  if (!name || !lastName) {
    throw new Error("Nome e cognome sono obbligatori");
  }

  await prisma.doctor.create({
    data: {
      fullName: `${name} ${lastName}`.trim(),
      specialty,
    },
  });

  revalidatePath("/medici");
}

export default async function MediciPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const t = await getTranslations("doctors");

  const doctors = await prisma.doctor.findMany({
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, specialty: true },
  });

  return (
    <div className="space-y-4">
      <nav className="text-sm text-zinc-600">
        <Link href="/admin" className="hover:text-emerald-700">
          Amministrazione
        </Link>{" "}
        / <span className="text-zinc-900">{t("title")}</span>
      </nav>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">{t("title")}</h1>
          <p className="mt-2 text-sm text-zinc-600">{t("subtitle")}</p>

          <form action={createDoctor} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              {t("name")}
              <input
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="name"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              {t("lastName")}
              <input
                className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                name="lastName"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
              {t("specialty")}
              <select
                name="specialty"
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                defaultValue="Odontoiatra"
              >
                <option value="Odontoiatra">{t("odontoiatra")}</option>
                <option value="Cardiologo">{t("cardiologo")}</option>
              </select>
            </label>
            <div className="col-span-full">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                {t("save")}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Elenco</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {doctors.length} medici
            </span>
          </div>
          <div className="mt-4 divide-y divide-zinc-100">
            {doctors.length === 0 ? (
              <p className="py-4 text-sm text-zinc-600">Nessun medico registrato.</p>
            ) : (
              doctors.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-zinc-900">{doc.fullName}</span>
                    <span className="text-xs text-zinc-600">{doc.specialty ?? "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
