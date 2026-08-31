import Link from "next/link";
import Image from "next/image";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { requireFeatureAccess } from "@/lib/feature-access";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { PageToastTrigger } from "@/components/page-toast-trigger";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const metadata = createPageMetadata(PAGE_TITLES.pazienti);

const TILE_IMAGE_VERSION = "1";

export default async function PazientiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);
  await requireFeatureAccess(user.role, "patients");
  const resolved = await searchParams;
  const patientCreated =
    typeof resolved.patientCreated === "string" ? resolved.patientCreated : null;

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageToastTrigger
        messages={[
          { key: "patientCreated", message: patientCreated ?? "", variant: "success" },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/pazienti/nuovo"
          className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:hover:border-emerald-800"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2066/1446] overflow-hidden rounded-xl border border-emerald-100 bg-white dark:border-emerald-900/40 dark:bg-zinc-900">
              <Image
                src={`/tiles/new_patient.png?v=${TILE_IMAGE_VERSION}`}
                alt="Nuovo paziente"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">Nuovo paziente</h2>
              <p className="text-sm text-emerald-800 dark:text-emerald-400">
                Crea una nuova scheda paziente con consensi e dati clinici iniziali.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/pazienti/lista"
          className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:hover:border-emerald-800"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2066/1446] overflow-hidden rounded-xl border border-emerald-100 bg-white dark:border-emerald-900/40 dark:bg-zinc-900">
              <Image
                src={`/tiles/patient_list.png?v=${TILE_IMAGE_VERSION}`}
                alt="Lista pazienti"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">Lista pazienti</h2>
              <p className="text-sm text-emerald-800 dark:text-emerald-400">
                Cerca pazienti esistenti. Aggiorna il diario clinico e altre informazioni.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/pazienti/duplicati"
          className="group flex flex-col justify-between rounded-2xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:border-amber-800"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2468/1728] overflow-hidden rounded-xl border border-amber-100 bg-white dark:border-amber-900/40 dark:bg-zinc-900">
              <Image
                src={`/tiles/duplicate_patients.png?v=${TILE_IMAGE_VERSION}`}
                alt="Cerca duplicati"
                fill
                sizes="(min-width: 1280px) 320px, (min-width: 768px) 40vw, 100vw"
                className="object-cover object-center"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-200">Cerca duplicati</h2>
              <p className="text-sm text-amber-900 dark:text-amber-300">
                Controlla schede che potrebbero riferirsi allo stesso paziente prima di lavorare sui dati clinici.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/pazienti/certificati"
          className="group flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:hover:border-emerald-800"
        >
          <div className="space-y-3">
            <div className="relative aspect-[2066/1446] overflow-hidden rounded-xl border border-emerald-100 bg-white dark:border-emerald-900/40 dark:bg-zinc-900">
              <Image
                src={`/tiles/certificates.png?v=${TILE_IMAGE_VERSION}`}
                alt="Certificati"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-contain"
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300">Certificati</h2>
              <p className="text-sm text-emerald-800 dark:text-emerald-400">
                Emetti e gestisci certificati di malattia, riposo lavorativo o per assicurazioni con firma digitale.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
