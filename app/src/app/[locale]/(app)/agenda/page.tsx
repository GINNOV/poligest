import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { getRoleFeatureAccess, requireFeatureAccess } from "@/lib/feature-access";
import { ASSISTANT_ROLE } from "@/lib/roles";

export const metadata: Metadata = {
  title: "AGENDA",
};

export default async function AgendaPage() {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "agenda");
  const featureAccess = await getRoleFeatureAccess(user.role);
  const showCalendar = featureAccess.isAllowed("calendar");

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/agenda/appuntamenti"
          className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2752/1536] overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <Image
                src="/tiles/appointments.png"
                alt="Appuntamenti"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="h-44 w-full object-cover"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Apputamenti esistenti</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Gestisci gli appuntamenti correnti e aggiorna le loro informazioni.
              </p>
            </div>
          </div>
        </Link>

        {showCalendar ? (
          <Link
            href="/calendar"
            className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="space-y-3">
              <div className="relative aspect-[2752/1536] overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <Image
                  src="/tiles/calendar.png"
                  alt="Aggiungi appuntamenti"
                  fill
                  sizes="(min-width: 1024px) 320px, 100vw"
                  className="h-44 w-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Aggiungi appuntamenti</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Visualizza la pianificazione mensile, le disponibilita e crea nuovi appuntamenti.
                </p>
              </div>
            </div>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
