import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Gender, Role } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { put } from "@vercel/blob";
import { LocalizedFileInput } from "@/components/localized-file-input";
import { AvatarCameraCapture } from "@/components/avatar-camera-capture";
import { ProfilePasswordForm } from "@/components/profile-password-form";
import { updateProfilePassword } from "@/lib/profile-password";
import { getOptionalStackServerApp } from "@/lib/stack-app";
import { normalizeItalianPhone } from "@/lib/phone";
import { normalizePersonName } from "@/lib/name";
import { ASSISTANT_ROLE } from "@/lib/roles";

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
  const normalized = normalizePersonName(value);
  const tokens = normalized.split(" ").filter(Boolean);
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

  if (user.role === Role.PATIENT && user.email) {
    await prisma.patient.updateMany({
      where: { email: { equals: user.email, mode: "insensitive" } },
      data: { photoUrl: url },
    });
  }

  await logAudit(user, {
    action: "profile.avatar_uploaded",
    entity: "User",
    entityId: user.id,
    metadata: { url },
  });

  revalidatePath("/profilo");
}

async function resetAvatar() {
  "use server";

  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });

  if (user.role === Role.PATIENT && user.email) {
    await prisma.patient.updateMany({
      where: { email: { equals: user.email, mode: "insensitive" } },
      data: { photoUrl: null },
    });
  }

  await logAudit(user, {
    action: "profile.avatar_reset",
    entity: "User",
    entityId: user.id,
  });

  revalidatePath("/profilo");
}

async function assignAward(formData: FormData) {
  "use server";

  const staffUser = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
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
  const stackServerApp = getOptionalStackServerApp();
  const stackUser = stackServerApp ? await stackServerApp.getUser() : null;

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
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Profilo</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Il tuo profilo</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Gestisci avatar, dati personali e visualizza eventuali premi assegnati.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Avatar</h2>
          <div className="mt-4 flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt="Avatar"
                className="h-16 w-16 rounded-full border border-zinc-200 object-cover dark:border-zinc-800"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full border border-zinc-200 bg-zinc-100 text-lg font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {initials || "U"}
              </div>
            )}
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">{user.name ?? user.email}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">PNG/JPG/WebP · max 2MB</div>
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
          <AvatarCameraCapture uploadAvatar={uploadAvatar} maxBytes={MAX_AVATAR_BYTES} />
          <form action={resetAvatar} className="mt-3">
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Ripristina avatar
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dati personali</h2>
            <form action={updateProfileBasics} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Nome
                <input
                  name="name"
                  defaultValue={user.name ?? ""}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                  placeholder="Nome e cognome"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Email
                <input
                  type="email"
                  name="email"
                  value={user.email ?? ""}
                  readOnly
                  disabled
                  className="h-11 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-base text-zinc-600 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                />
              </label>
              {currentUser.role === Role.PATIENT ? (
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Telefono
                  <input
                    name="phone"
                    defaultValue={patientRecord?.phone ?? ""}
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                    placeholder="+39 333 123 4567"
                  />
                </label>
              ) : null}
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Genere
                <select
                  name="gender"
                  defaultValue={user.gender ?? Gender.NOT_SPECIFIED}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
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
                  Aggiorna
                </button>
              </div>
            </form>
          </div>

          {stackUser ? (
            <ProfilePasswordForm
              hasPassword={stackUser.hasPassword}
              updateProfilePassword={updateProfilePassword}
            />
          ) : null}

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">PIN personale</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Ogni paziente ha un codice un&apos;univoco (PIN) che e&apos; utilizzato per verificare l&apos;identita&apos;. Il PIN è generato dal sistema, unico e non può essere cambiato.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {pinDigits.map((digit, idx) => (
                <div
                  key={`${digit}-${idx}`}
                  className="grid h-12 w-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-xl font-semibold text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <span className="font-mono">{digit}</span>
                </div>
              ))}
              {!user.personalPin ? (
                <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">In generazione...</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Premi</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Premi assegnati dai medici.
            </p>
            <div className="mt-4 space-y-3">
              {awards.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Nessun premio assegnato.</p>
              ) : (
                awards.map((award) => (
                  <div key={award.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start gap-3">
                      <div className="grid h-12 w-12 flex-shrink-0 place-items-center overflow-hidden rounded-2xl bg-emerald-50 text-2xl leading-none text-center whitespace-nowrap dark:bg-emerald-950/40">
                        {award.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-50">{award.title}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(award.createdAt)}
                          </div>
                        </div>
                        {award.description ? (
                          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{award.description}</p>
                        ) : null}
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          Assegnato da:{" "}
                          {award.doctor?.fullName ? award.doctor.fullName : "Sistema"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {isDoctorAccount && currentUser.role !== Role.PATIENT ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Assegna premio (medico)</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Seleziona un paziente e assegna un premio con emoji e descrizione.
              </p>
              <form action={assignAward} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:col-span-2">
                  Paziente
                  <select
                    name="targetUserId"
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
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
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Emoji
                  <input
                    name="emoji"
                    placeholder="🏆"
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Titolo
                  <input
                    name="title"
                    placeholder="Igiene Master"
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 sm:col-span-2">
                  Descrizione (breve)
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Ottima costanza nell'igiene orale e controlli regolari."
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
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
