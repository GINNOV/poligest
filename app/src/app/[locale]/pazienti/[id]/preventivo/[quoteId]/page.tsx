import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import type { Metadata } from "next";
import { ASSISTANT_ROLE } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preventivo",
};

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id?: string; quoteId?: string }>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "quotes");
  await requireFeatureAccess(Role.ADMIN, "quotes");
  const resolvedParams = await params;
  const patientId = resolvedParams?.id;
  const quoteId = resolvedParams?.quoteId;
  if (!patientId || !quoteId) {
    return notFound();
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, patientId },
    include: { items: true },
  });
  const quoteItems = await prisma.quoteItem.findMany({
    where: { quoteId },
    orderBy: { createdAt: "asc" },
  });
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true, email: true, phone: true },
  });

  if (!quote || !patient) {
    return notFound();
  }

  const price = Number(quote.price.toString());
  const total = Number(quote.total.toString());
  const signedAt = new Date(quote.signedAt);
  const rawItems = quoteItems.length ? quoteItems : quote.items ?? [];
  const items = rawItems.length
    ? rawItems.map((item) => ({
        id: item.id,
        serviceName: item.serviceName,
        quantity: item.quantity,
        price: Number(item.price.toString()),
        total: Number(item.total.toString()),
        saldato: Boolean(item.saldato),
        createdAt: item.createdAt ? new Date(item.createdAt) : null,
      }))
    : [
        {
          id: quote.id,
          serviceName: quote.serviceName,
          quantity: quote.quantity,
          price,
          total,
          saldato: false,
          createdAt: null,
        },
      ];
  const itemsTotal = items.reduce((sum, item) => sum + (item.saldato ? 0 : item.total), 0);
  const formatItemDate = (value: Date | null) => {
    if (!value) return "—";
    return value.toLocaleString("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Rome",
    });
  };

  return (
    <div className="min-h-screen bg-zinc-100 px-6 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm print:max-w-none print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6 print:pb-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-40 rounded-lg bg-white p-2">
              <Image
                src="/logo/studio_agovinoangrisano_logo.png"
                alt="Logo Studio Agovino & Angrisano"
                width={320}
                height={120}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Preventivo
              </p>
              <h1 className="text-2xl font-semibold text-zinc-900">Studio Agovino & Angrisano</h1>
            </div>
          </div>
          <PrintButton
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 print:hidden"
            label="Stampa preventivo"
          />
        </div>

        <div className="grid gap-4 text-sm text-zinc-700 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Paziente</p>
            <p className="mt-2 text-base font-semibold text-zinc-900">
              {patient.lastName} {patient.firstName}
            </p>
            <p className="text-xs text-zinc-600">{patient.email ?? "—"}</p>
            <p className="text-xs text-zinc-600">{patient.phone ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dettagli</p>
            <p className="mt-2 text-sm text-zinc-800">
              Data accettazione:{" "}
              {signedAt.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
            </p>
            <p className="text-sm text-zinc-800">Preventivo ID: {quote.id}</p>
          </div>
        </div>

        <div className="relative overflow-x-auto rounded-2xl border border-zinc-200">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white/90 to-transparent sm:hidden" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/90 to-transparent sm:hidden" />
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left">Prestazione</th>
                <th className="px-4 py-3 text-right">Quantità</th>
                <th className="px-4 py-3 text-right">Prezzo (€)</th>
                <th className="px-4 py-3 text-right">Totale (€)</th>
                <th className="px-4 py-3 text-right">Inserito</th>
                <th className="px-4 py-3 text-center">Saldato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-zinc-900">{item.serviceName}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{item.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-zinc-900">{item.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-zinc-600">
                    {formatItemDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-700">
                    {item.saldato ? "Sì" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50">
              <tr>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-700" colSpan={5}>
                  Totale da saldare
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">
                  {itemsTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid gap-6 border-t border-zinc-200 pt-6 sm:grid-cols-[1fr,240px]">
          <div className="text-xs text-zinc-600">
            Il presente preventivo è valido salvo variazioni concordate con lo studio. Eventuali
            modifiche saranno confermate con un nuovo documento firmato.
          </div>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-center">
            <p className="text-xs font-semibold text-zinc-700">Firma cliente</p>
            <img
              src={quote.signatureUrl}
              alt="Firma cliente"
              className="mt-2 h-24 w-full object-contain"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
          <span>
            Data stampa: {new Date().toLocaleDateString("it-IT", { dateStyle: "short" })}
          </span>
          <span>siamo online su sorrisosplendente.com</span>
        </div>
      </div>
    </div>
  );
}
