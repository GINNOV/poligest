import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const metadata = createPageMetadata(PAGE_TITLES.medici);

async function createDoctor(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN, Role.MANAGER]);

  const name = (formData.get("name") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const specialty = (formData.get("specialty") as string)?.trim() || "Odontoiatra";
  const phone = (formData.get("phone") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const userId = (formData.get("userId") as string) || null;

  if (!name || !lastName) {
    throw new Error("Nome e cognome sono obbligatori");
  }

  await prisma.doctor.create({
    data: {
      fullName: `${name} ${lastName}`.trim(),
      specialty,
      phone,
      notes,
      userId,
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
  const phone = (formData.get("phone") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const userId = (formData.get("userId") as string) || null;

  if (!id || !fullName) {
    throw new Error("Dati medico non validi");
  }

  await prisma.doctor.update({
    where: { id },
    data: { fullName, specialty, phone, notes, userId },
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

  await prisma.doctor.delete({ where: { id } });
  revalidatePath("/medici");
}

export default async function MediciPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);
  const t = await getTranslations("doctors");

  const [doctors, users] = await Promise.all([
    prisma.doctor.findMany({
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, specialty: true, phone: true, notes: true, userId: true },
    }),
    prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.MANAGER, Role.ASSISTANT] },
        isActive: true,
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>

          <form action={createDoctor} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {t("name")}
              <input
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="name"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {t("lastName")}
              <input
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="lastName"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {t("specialty")}
              <select
                name="specialty"
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                defaultValue="Odontoiatra"
              >
                <option value="Odontoiatra">{t("odontoiatra")}</option>
                <option value="Cardiologo">{t("cardiologo")}</option>
                <option value="Igenista">{t("igenista")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {t("phone")}
              <input
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                name="phone"
                type="tel"
                placeholder="+39..."
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Utente associato
              <select
                name="userId"
                className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                defaultValue=""
              >
                <option value="">— Nessuno —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 lg:col-span-3">
              {t("notes")}
              <textarea
                name="notes"
                rows={2}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                placeholder={t("notesPlaceholder")}
              />
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

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Elenco</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {doctors.length} medici
            </span>
          </div>
          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {doctors.length === 0 ? (
              <p className="py-4 text-sm text-zinc-600 dark:text-zinc-400">Nessun medico registrato.</p>
            ) : (
              doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-4 py-4"
                >
                  <form
                    action={updateDoctor}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <input type="hidden" name="doctorId" value={doc.id} />
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Nome completo</span>
                      <input
                        name="fullName"
                        defaultValue={doc.fullName}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Specializzazione</span>
                      <select
                        name="specialty"
                        defaultValue={doc.specialty ?? "Odontoiatra"}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                      >
                        <option value="Odontoiatra">{t("odontoiatra")}</option>
                        <option value="Cardiologo">{t("cardiologo")}</option>
                        <option value="Igenista">{t("igenista")}</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Telefono</span>
                      <input
                        name="phone"
                        defaultValue={doc.phone ?? ""}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Utente associato</span>
                      <select
                        name="userId"
                        defaultValue={doc.userId || ""}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                      >
                        <option value="">— Nessuno —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1 lg:col-span-3">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Note</span>
                      <textarea
                        name="notes"
                        defaultValue={doc.notes ?? ""}
                        rows={1}
                        className="min-h-[40px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        className="h-10 flex-1 rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Aggiorna
                      </button>
                    </div>
                  </form>
                  <div className="flex justify-end border-t border-zinc-50 pt-2 dark:border-zinc-800/50">
                    <form
                      action={deleteDoctor}
                      data-confirm="Eliminare definitivamente questo medico e le relative informazioni?"
                    >
                      <input type="hidden" name="doctorId" value={doc.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                      >
                        Elimina medico
                      </button>
                    </form>
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
