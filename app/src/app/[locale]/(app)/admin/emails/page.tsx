import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getAllEmailTemplates } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  await requireUser([Role.ADMIN]);
  const templates = await getAllEmailTemplates();

  const grouped = templates.reduce<Record<string, typeof templates>>((acc, tpl) => {
    const key = tpl.category ?? "Generale";
    acc[key] = acc[key] ? [...acc[key], tpl] : [tpl];
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Email</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Template email</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Gestisci i template transazionali, anteprima live e invio di test.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {category}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((tpl) => (
                <Link
                  key={tpl.id}
                  href={`/admin/emails/edit/${tpl.name}`}
                  className="group flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-zinc-900">{tpl.name}</h3>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        Modifica
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600">{tpl.description ?? "Template email"}</p>
                  </div>
                  <div className="mt-4 text-xs text-zinc-500">Oggetto: {tpl.subject}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
