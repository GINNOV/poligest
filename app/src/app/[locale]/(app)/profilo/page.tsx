import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Gender, Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { put } from "@vercel/blob";
import { LocalizedFileInput } from "@/components/localized-file-input";
import { normalizeItalianPhone } from "@/lib/phone";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function sanitizeBaseName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "avatar";
}

function ensureEmoji(value: unknown) {
  const emoji = String(value ?? "").trim();
  if (!emoji) throw new Error("Inserisci un emoji.");
  if (emoji.length > 8) throw new Error("Emoji non valido.");
  return emoji;
}

function splitFullName(value: string) {
  const tokens = value.split(" ").filter(Boolean);
  if (!tokens.length) return null;
  const [firstName, ...rest] = tokens;
  const lastName = rest.join(" ").trim() || firstName;
  return { firstName, lastName };
}

async function updateProfileBasics(formData: FormData) {
  "use server";

  const user = await requireUser();
  const name = (formData.get("name") as string)?.trim() || null;
  const genderRaw = (formData.get("gender") as string) || Gender.NOT_SPECIFIED;
  const gender = Object.values(Gender).includes(genderRaw as Gender)
    ? (genderRaw as Gender)
    : Gender.NOT_SPECIFIED;
  const phone = normalizeItalianPhone((formData.get("phone") as string) ?? null);

  await prisma.user.update({
    where: { id: user.id },
    data: { name, gender },
  });

  if (user.role === Role.PATIENT && user.email) {
    const patientData: { phone: string | null; firstName?: string; lastName?: string } = { phone };
    if (name) {
      const parts = splitFullName(name);
      if (parts) {
        patientData.firstName = parts.firstName;
        patientData.lastName = parts.lastName;
      }
    }
    await prisma.patient.updateMany({
      where: { email: { equals: user.email, mode: "insensitive" } },
      data: patientData,
    });
  }

  await logAudit(user, {
    action: "profile.updated",
    entity: "User",
    entityId: user.id,
    metadata: { gender, phoneUpdated: Boolean(phone), nameUpdated: Boolean(name) },
  });

  revalidatePath("/profilo");
}

async function uploadAvatar(formData: FormData) {
  "use server";

  const user = await requireUser();
  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) throw new Error("Seleziona un file immagine.");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Immagine troppo grande (max 2MB).");
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error("Formato non supportato. Usa PNG/JPG/WebP.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const baseName = sanitizeBaseName(user.id);
  const blobName = `avatars/${baseName}/${Date.now()}.${ext}`;
  const blob = await put(blobName, file, { access: "public", addRandomSuffix: false });
  const url = blob.url;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });

  await logAudit(user, {
    action: "profile.avatar_uploaded",
    entity: "User",
    entityId: user.id,
    metadata: { url },
  });

  revalidatePath("/profilo");
}

async function assignAward(formData: FormData) {
  "use server";

  const staffUser = await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const doctor = await prisma.doctor.findFirst({
    where: { userId: staffUser.id },
    select: { id: true },
  });
  if (!doctor) {
    throw new Error("Solo un medico con account collegato può assegnare premi.");
  }

  const targetUserId = (formData.get("targetUserId") as string) || "";
  const emoji = ensureEmoji(formData.get("emoji"));
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  if (!targetUserId || !title) throw new Error("Dati premio non validi.");

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) throw new Error("Utente destinatario non trovato.");

  const created = await prisma.userAward.create({
    data: { userId: targetUserId, emoji, title, description, doctorId: doctor.id },
  });

  await logAudit(staffUser, {
    action: "award.assigned",
    entity: "UserAward",
    entityId: created.id,
    metadata: { targetUserId, doctorId: doctor.id },
  });

  revalidatePath("/profilo");
}

export default async function ProfilePage() {
  const currentUser = await requireUser();

  const [user, awards, isDoctorAccount, patients, patientRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { id: true, email: true, name: true, avatarUrl: true, personalPin: true, gender: true, role: true },
    }),
    prisma.userAward.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
      include: { doctor: { select: { fullName: true, specialty: true } } },
    }),
    prisma.doctor.findFirst({ where: { userId: currentUser.id }, select: { id: true } }),
    currentUser.role !== Role.PATIENT
      ? prisma.user.findMany({
          where: { role: Role.PATIENT },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, name: true },
          take: 200,
        })
      : Promise.resolve([]),
    currentUser.role === Role.PATIENT && currentUser.email
      ? prisma.patient.findFirst({
          where: { email: { equals: currentUser.email, mode: "insensitive" } },
          select: { phone: true },
        })
      : Promise.resolve(null),
  ]);

  if (!user) redirect("/");

  const initials = (user.name ?? user.email)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const pinDigits = (user.personalPin ?? "------").split("").slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Profilo</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Il tuo profilo</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Gestisci avatar, dati personali e visualizza eventuali premi assegnati.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Avatar</h2>
          <div className="mt-4 flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt="Avatar"
                className="h-16 w-16 rounded-full border border-zinc-200 object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-lg font-semibold text-zinc-700">
                {initials || "U"}
              </div>
            )}
            <div className="text-sm text-zinc-700">
              <div className="font-semibold text-zinc-900">{user.name ?? user.email}</div>
              <div className="text-xs text-zinc-500">{user.email}</div>
              <div className="mt-1 text-xs text-zinc-500">PNG/JPG/WebP · max 2MB</div>
            </div>
          </div>
          <form action={uploadAvatar} className="mt-4 space-y-3">
            <LocalizedFileInput name="avatar" accept="image/png,image/jpeg,image/webp" required />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Carica avatar
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Dati personali</h2>
            <form action={updateProfileBasics} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Nome
                <input
                  name="name"
                  defaultValue={user.name ?? ""}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Nome e cognome"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Email
                <input
                  type="email"
                  name="email"
                  value={user.email ?? ""}
                  readOnly
                  disabled
                  className="h-11 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-base text-zinc-600 outline-none"
                />
              </label>
              {currentUser.role === Role.PATIENT ? (
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                  Telefono
                  <input
                    name="phone"
                    defaultValue={patientRecord?.phone ?? ""}
                    className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    placeholder="+39 333 123 4567"
                  />
                </label>
              ) : null}
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Genere
                <select
                  name="gender"
                  defaultValue={user.gender ?? Gender.NOT_SPECIFIED}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value={Gender.NOT_SPECIFIED}>Preferisco non indicarlo</option>
                  <option value={Gender.MALE}>Maschio</option>
                  <option value={Gender.FEMALE}>Femmina</option>
                  <option value={Gender.OTHER}>Altro</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">PIN personale</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Ogni paziente ha un codice un&apos;univoco (PIN) che e&apos; utilizzato per verificare l&apos;identita&apos;. Il PIN è generato dal sistema, unico e non può essere cambiato.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {pinDigits.map((digit, idx) => (
                <div
                  key={`${digit}-${idx}`}
                  className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-xl font-semibold text-zinc-900 shadow-sm"
                >
                  <span className="font-mono">{digit}</span>
                </div>
              ))}
              {!user.personalPin ? (
                <span className="ml-2 text-sm text-zinc-600">In generazione...</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Premi</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Premi assegnati dai medici.
            </p>
            <div className="mt-4 space-y-3">
              {awards.length === 0 ? (
                <p className="text-sm text-zinc-600">Nessun premio assegnato.</p>
              ) : (
                awards.map((award) => (
                  <div key={award.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-50 text-2xl leading-none text-center whitespace-nowrap">
                        {award.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-zinc-900">{award.title}</div>
                          <div className="text-xs text-zinc-500">
                            {new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(award.createdAt)}
                          </div>
                        </div>
                        {award.description ? (
                          <p className="mt-1 text-sm text-zinc-700">{award.description}</p>
                        ) : null}
                        <div className="mt-1 text-xs text-zinc-500">
                          Assegnato da:{" "}
                          {award.doctor?.fullName
                            ? `${award.doctor.fullName}${award.doctor.specialty ? ` (${award.doctor.specialty})` : ""}`
                            : "Sistema"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {isDoctorAccount && currentUser.role !== Role.PATIENT ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">Assegna premio (medico)</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Seleziona un paziente e assegna un premio con emoji e descrizione.
              </p>
              <form action={assignAward} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                  Paziente
                  <select
                    name="targetUserId"
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Seleziona paziente
                    </option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.name ?? "").trim() ? `${p.name} · ${p.email}` : p.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                  Emoji
                  <input
                    name="emoji"
                    placeholder="🏆"
                    className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                  Titolo
                  <input
                    name="title"
                    placeholder="Igiene Master"
                    className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                  Descrizione (breve)
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Ottima costanza nell'igiene orale e controlli regolari."
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Assegna premio
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
