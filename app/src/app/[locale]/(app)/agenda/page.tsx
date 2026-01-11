import Link from "next/link";
import Image from "next/image";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";

export default async function AgendaPage() {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/agenda/appuntamenti"
          className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2752/1536] overflow-hidden rounded-xl border border-emerald-100 bg-white">
              <Image
                src="/tiles/appointments.png"
                alt="Appuntamenti"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-900">Elenco appuntamenti</h2>
              <p className="text-sm text-emerald-800">
                Gestisci gli appuntamenti correnti e aggiorna le loro informazioni.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/calendar"
          className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2752/1536] overflow-hidden rounded-xl border border-emerald-100 bg-white">
              <Image
                src="/tiles/calendar.png"
                alt="Calendario"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-900">Calendario</h2>
              <p className="text-sm text-emerald-800">
                Visualizza la pianificazione mensile, le disponibilita e crea nuovi appuntamenti.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
