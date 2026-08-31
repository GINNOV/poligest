import Link from "next/link";
import { Gender } from "@prisma/client";
import { deleteMedicalCertificateAction } from "@/lib/patients/actions/certificates-actions";
import { PatientAvatar } from "@/components/patient-avatar";

export interface CertificateListItem {
  id: string;
  certificateNumber: string;
  version: number;
  rootCertificateId?: string | null;
  type: string;
  title: string;
  diagnosis?: string | null;
  prognosisDays?: number | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  place: string;
  issuedAt: Date | string;
  signedAt?: Date | string | null;
  signatureUrl?: string | null;
  status: string;
  doctorName: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    taxId?: string | null;
    photoUrl?: string | null;
    gender?: Gender | null;
  };
  doctor?: {
    id: string;
    fullName: string;
    specialty?: string | null;
  } | null;
}

const typeLabels: Record<string, { label: string; badgeClass: string }> = {
  WORK_INCAPACITY: {
    label: "Riposo Lavorativo",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  },
  ATTENDANCE: {
    label: "Presenza Cure",
    badgeClass:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200",
  },
  INSURANCE: {
    label: "Assicurazione",
    badgeClass:
      "border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-200",
  },
  CUSTOM: {
    label: "Personalizzato",
    badgeClass:
      "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
  },
};

interface CertificatesTableProps {
  certificates: CertificateListItem[];
  canDelete?: boolean;
}

export function CertificatesTable({ certificates, canDelete = false }: CertificatesTableProps) {
  if (certificates.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          📄
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Nessun certificato trovato
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Non sono presenti certificati medici corrispondenti ai filtri di ricerca.
        </p>
        <div className="mt-5">
          <Link
            href="/pazienti/certificati/nuovo"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            + Emetti Nuovo Certificato
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {certificates.map((cert) => {
        const typeInfo = typeLabels[cert.type] || typeLabels.CUSTOM;
        const isSuperseded = cert.status === "SUPERSEDED";
        const hasSignature = Boolean(cert.signatureUrl);

        return (
          <div
            key={cert.id}
            className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-sm transition hover:shadow-md lg:flex-row lg:items-center lg:justify-between ${
              isSuperseded
                ? "border-zinc-200 bg-zinc-50/70 opacity-85 dark:border-zinc-800/80 dark:bg-zinc-950/40"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-100 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
                <PatientAvatar
                  src={cert.patient.photoUrl}
                  alt={`${cert.patient.lastName} ${cert.patient.firstName}`}
                  patientId={cert.patient.id}
                  firstName={cert.patient.firstName}
                  taxId={cert.patient.taxId}
                  gender={cert.patient.gender || Gender.NOT_SPECIFIED}
                  size={48}
                  className="h-full w-full rounded-full"
                />
              </div>

              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {cert.certificateNumber}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    v{cert.version}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${typeInfo.badgeClass}`}
                  >
                    {typeInfo.label}
                  </span>
                  {isSuperseded ? (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Aggiornato da nuova versione
                    </span>
                  ) : null}
                  {hasSignature ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Firmato
                    </span>
                  ) : null}
                </div>

                <Link
                  href={`/pazienti/${cert.patient.id}`}
                  className="block text-base font-semibold text-zinc-900 hover:text-emerald-700 dark:text-zinc-50 dark:hover:text-emerald-400"
                >
                  {cert.patient.lastName} {cert.patient.firstName}{" "}
                  {cert.patient.taxId ? (
                    <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      ({cert.patient.taxId})
                    </span>
                  ) : null}
                </Link>

                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">Titolo:</span>{" "}
                  {cert.title}
                </p>

                {cert.diagnosis ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Motivo/Diagnosi:</span>{" "}
                    {cert.diagnosis}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>
                    📅 Rilasciato il {new Date(cert.issuedAt).toLocaleDateString("it-IT")}
                  </span>
                  <span>👨‍⚕️ Emesso da: {cert.doctorName}</span>
                  {cert.prognosisDays ? (
                    <span>⏱️ Prognosi: {cert.prognosisDays} gg</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 lg:flex-col lg:items-end lg:pt-0">
              <Link
                href={`/pazienti/${cert.patient.id}/certificati/${cert.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9V4h12v5" />
                  <path d="M6 18h12v2H6z" />
                  <path d="M6 14h12v4H6z" />
                  <path d="M4 10h16a2 2 0 0 1 2 2v3h-4" />
                  <path d="M2 15h4" />
                </svg>
                Stampa / PDF
              </Link>

              <Link
                href={`/pazienti/certificati/nuovo?rootId=${cert.id}&patientId=${cert.patient.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                + Nuova Versione
              </Link>

              {canDelete ? (
                <form action={deleteMedicalCertificateAction}>
                  <input type="hidden" name="certificateId" value={cert.id} />
                  <button
                    type="submit"
                    onClick={(e) => {
                      if (!confirm("Sei sicuro di voler eliminare questo certificato?")) {
                        e.preventDefault();
                      }
                    }}
                    className="text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400"
                  >
                    Elimina
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
