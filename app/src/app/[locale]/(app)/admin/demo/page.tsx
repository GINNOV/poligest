import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { livePrisma } from "@/lib/prisma";
import { DEMO_RESET_CONFIRMATION } from "@/lib/demo/guard";
import { provisionDemoLogins } from "@/lib/demo/provision";
import { resetDemoClinic } from "@/lib/demo/seed";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const roleLabels: Record<Role, string> = {
  [Role.ADMIN]: "Admin",
  [Role.MANAGER]: "Dottore",
  [Role.ASSISTANT]: "Assistente",
  [Role.SECRETARY]: "Segreteria",
  [Role.PATIENT]: "Paziente",
};

async function prepareDemoLogins() {
  "use server";
  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  if (admin.isDemo) {
    throw new Error("Prepara gli accessi dall'account Admin dello studio.");
  }
  await provisionDemoLogins();
  revalidatePath("/admin/demo");
}

async function restoreDemoClinic(formData: FormData) {
  "use server";
  const admin = await requireUser([Role.ADMIN], { allowImpersonation: false });
  if (admin.isDemo) {
    throw new Error("Ripristina lo studio dimostrativo dall'account Admin dello studio.");
  }
  const confirmation = (formData.get("confirm") as string)?.trim();
  if (confirmation !== DEMO_RESET_CONFIRMATION) {
    throw new Error(`Digita '${DEMO_RESET_CONFIRMATION}' per procedere.`);
  }
  await resetDemoClinic();
  await provisionDemoLogins();
  revalidatePath("/admin/demo");
}

export default async function DemoClinicPage() {
  const admin = await requireUser([Role.ADMIN]);
  const accounts = await livePrisma.user.findMany({
    where: { isDemo: true },
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true, demoPassword: true, isActive: true },
  });
  const password = accounts.find((account) => account.demoPassword)?.demoPassword ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Studio dimostrativo</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Gli account qui sotto vedono solo pazienti, appuntamenti e impostazioni inventati. Lo studio vero non compare lì, e questi dati non compaiono negli account dello studio.
        </p>
        <p className="text-sm">
          <Link className="font-semibold text-emerald-700" href="/docs/studio-dimostrativo">
            Come si usa, nel manuale
          </Link>
        </p>
      </div>

      {admin.isDemo ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Sei dentro lo studio dimostrativo. Per ripristinare i dati di partenza, esci e rientra con l&apos;Admin dello studio.
        </p>
      ) : (
        <form action={prepareDemoLogins}>
          <Button type="submit">Prepara accessi dimostrativi</Button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Ruolo</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-3">{account.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{account.email}</td>
                <td className="px-4 py-3">{roleLabels[account.role]}</td>
              </tr>
            ))}
            {accounts.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-zinc-500" colSpan={3}>
                  Nessun accesso ancora. Premi Prepara accessi dimostrativi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {password && !admin.isDemo ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          Password degli accessi dimostrativi: <span className="font-mono font-semibold">{password}</span>
        </p>
      ) : null}

      {admin.isDemo ? null : (
        <form action={restoreDemoClinic} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-950">
            Il ripristino svuota lo studio finto e ricarica pazienti, agenda e impostazioni di partenza. Gli accessi dimostrativi restano. Lo studio vero non viene toccato.
          </p>
          <input
            name="confirm"
            placeholder={DEMO_RESET_CONFIRMATION}
            className="h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm"
          />
          <Button type="submit" variant="secondary">
            Ripristina studio dimostrativo
          </Button>
        </form>
      )}
    </div>
  );
}
