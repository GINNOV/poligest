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

async function updateDoctor(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const id = formData.get("doctorId") as string;
  const fullName = (formData.get("fullName") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim() || "Odontoiatra";

  if (!id || !fullName) {
    throw new Error("Dati medico non validi");
  }

  await prisma.doctor.update({
    where: { id },
    data: { fullName, specialty },
  });

  revalidatePath("/medici");
}

async function deleteDoctor(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);
  const id = formData.get("doctorId") as string;
  if (!id) throw new Error("Medico non valido");

  // detach related appointments and records before deletion
  await prisma.appointment.updateMany({
    where: { doctorId: id },
    data: { doctorId: null },
  });
  await prisma.financeEntry.updateMany({
    where: { doctorId: id },
    data: { doctorId: null },
  });
  await prisma.cashAdvance.deleteMany({
    where: { doctorId: id },
  });

  await prisma.doctor.delete({ where: { id } });
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
                <option value="Igenista">{t("igenista")}</option>
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
              <div key={doc.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <form action={updateDoctor} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <input type="hidden" name="doctorId" value={doc.id} />
                  <input
                    name="fullName"
                    defaultValue={doc.fullName}
                    className="h-10 flex-1 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <select
                    name="specialty"
                    defaultValue={doc.specialty ?? "Odontoiatra"}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="Odontoiatra">{t("odontoiatra")}</option>
                    <option value="Cardiologo">{t("cardiologo")}</option>
                    <option value="Igenista">{t("igenista")}</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Salva
                  </button>
                </form>
                <form action={deleteDoctor} className="flex justify-end">
                  <input type="hidden" name="doctorId" value={doc.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800"
                  >
                    Elimina
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
