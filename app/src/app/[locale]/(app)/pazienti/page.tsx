import Link from "next/link";
import Image from "next/image";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { ASSISTANT_ROLE } from "@/lib/roles";

export default async function PazientiPage() {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/pazienti/nuovo"
          className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2066/1446] overflow-hidden rounded-xl border border-emerald-100 bg-white">
              <Image
                src="/tiles/new_patient.png"
                alt="Nuovo paziente"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-900">Nuovo paziente</h2>
              <p className="text-sm text-emerald-800">
                Crea una nuova scheda paziente con consensi e dati clinici iniziali.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/pazienti/lista"
          className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2066/1446] overflow-hidden rounded-xl border border-emerald-100 bg-white">
              <Image
                src="/tiles/patient_list.png"
                alt="Lista pazienti"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-900">Lista pazienti</h2>
              <p className="text-sm text-emerald-800">
                Cerca pazienti esistenti. Aggiorna il diario clinico e altre informazioni.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}