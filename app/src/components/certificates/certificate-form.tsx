"use client";

import { useActionState, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CERTIFICATE_TEMPLATES,
  type CertificateType,
  interpolateCertificateTemplate,
} from "@/lib/certificates/templates";
import {
  saveMedicalCertificateAction,
  type CertificateSaveState,
} from "@/lib/patients/actions/certificates-actions";
import { CertificateSignature } from "./certificate-signature";
import { FormSubmitButton } from "@/components/form-submit-button";

export interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  taxId?: string | null;
  birthDate?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface DoctorOption {
  id: string;
  fullName: string;
  specialty?: string | null;
}

interface CertificateFormProps {
  patients: PatientOption[];
  doctors: DoctorOption[];
  initialPatientId?: string;
  initialDoctorId?: string;
  currentUserName?: string;
  // For new versioning
  rootCertificateId?: string;
  initialData?: {
    certificateNumber?: string;
    version?: number;
    type?: CertificateType;
    title?: string;
    content?: string;
    diagnosis?: string | null;
    prognosisDays?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    place?: string;
    notes?: string | null;
    signatureUrl?: string | null;
  };
}

export function CertificateForm({
  patients,
  doctors,
  initialPatientId,
  initialDoctorId,
  currentUserName,
  rootCertificateId,
  initialData,
}: CertificateFormProps) {
  const router = useRouter();
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId || "");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    initialDoctorId || (doctors.length === 1 ? doctors[0].id : "")
  );
  const [doctorNameInput, setDoctorNameInput] = useState<string>(
    doctors.find((d) => d.id === initialDoctorId)?.fullName || currentUserName || ""
  );

  const [certType, setCertType] = useState<CertificateType>(
    initialData?.type || "WORK_INCAPACITY"
  );
  const [title, setTitle] = useState<string>(
    initialData?.title || CERTIFICATE_TEMPLATES[initialData?.type || "WORK_INCAPACITY"].defaultTitle
  );
  const [diagnosis, setDiagnosis] = useState<string>(
    initialData?.diagnosis || "postumi da intervento odontoiatrico e necessità di convalescenza"
  );
  const [prognosisDays, setPrognosisDays] = useState<number>(initialData?.prognosisDays ?? 2);

  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState<string>(
    initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : todayStr
  );
  const [endDate, setEndDate] = useState<string>(
    initialData?.endDate
      ? new Date(initialData.endDate).toISOString().split("T")[0]
      : tomorrowStr
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [place, setPlace] = useState(initialData?.place || "San Valentino Torio (SA)");
  const [issuedAt, setIssuedAt] = useState(todayStr);

  const [manualContent, setManualContent] = useState<string | null>(initialData?.content || null);

  const [state, formAction] = useActionState<CertificateSaveState, FormData>(
    saveMedicalCertificateAction,
    {}
  );

  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId);
  }, [patients, selectedPatientId]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 30);
    const query = patientSearch.toLowerCase();
    return patients
      .filter(
        (p) =>
          p.lastName.toLowerCase().includes(query) ||
          p.firstName.toLowerCase().includes(query) ||
          (p.taxId && p.taxId.toLowerCase().includes(query))
      )
      .slice(0, 30);
  }, [patients, patientSearch]);

  // Derived content computed during render (idiomatic React, avoiding setState in useEffect)
  const defaultInterpolatedContent = useMemo(() => {
    const patientBirthDate = selectedPatient?.birthDate
      ? new Date(selectedPatient.birthDate).toLocaleDateString("it-IT")
      : undefined;

    const patientAddress = selectedPatient?.address
      ? `${selectedPatient.address}${selectedPatient.city ? ` - ${selectedPatient.city}` : ""}`
      : undefined;

    return interpolateCertificateTemplate(CERTIFICATE_TEMPLATES[certType].bodyTemplate, {
      patientName: selectedPatient
        ? `${selectedPatient.lastName} ${selectedPatient.firstName}`
        : "—",
      patientBirthPlace: selectedPatient?.city || "—",
      patientBirthDate,
      patientTaxId: selectedPatient?.taxId || "—",
      patientAddress,
      diagnosis,
      prognosisDays,
      startDate: startDate ? new Date(startDate).toLocaleDateString("it-IT") : undefined,
      endDate: endDate ? new Date(endDate).toLocaleDateString("it-IT") : undefined,
      startTime,
      endTime,
      doctorName: doctorNameInput || "Dott. Agovino & Angrisano",
      place,
    });
  }, [
    certType,
    selectedPatient,
    diagnosis,
    prognosisDays,
    startDate,
    endDate,
    startTime,
    endTime,
    doctorNameInput,
    place,
  ]);

  const effectiveContent = manualContent !== null ? manualContent : defaultInterpolatedContent;

  // Handle template change
  const handleTemplateChange = (type: CertificateType) => {
    setCertType(type);
    setTitle(CERTIFICATE_TEMPLATES[type].defaultTitle);
    setManualContent(null);
  };

  // Handle date changes with automatic prognosis days calculation
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && endDate) {
      const s = new Date(val).getTime();
      const e = new Date(endDate).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
        const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
        setPrognosisDays(days);
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && val) {
      const s = new Date(startDate).getTime();
      const e = new Date(val).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
        const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
        setPrognosisDays(days);
      }
    }
  };

  const handleDaysChange = (days: number) => {
    setPrognosisDays(days);
    if (startDate && days > 0) {
      const s = new Date(startDate);
      s.setDate(s.getDate() + days - 1);
      setEndDate(s.toISOString().split("T")[0]);
    }
  };

  // Redirect on successful save
  useEffect(() => {
    if (state.success && state.certificateId && selectedPatientId) {
      router.push(`/pazienti/${selectedPatientId}/certificati/${state.certificateId}`);
    }
  }, [state, selectedPatientId, router]);

  return (
    <form action={formAction} className="space-y-6">
      {rootCertificateId ? (
        <input type="hidden" name="rootCertificateId" value={rootCertificateId} />
      ) : null}

      {/* Versioning banner if applicable */}
      {rootCertificateId && initialData ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            Nuova Versione del Certificato {initialData.certificateNumber} (v{(initialData.version ?? 1) + 1})
          </div>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Stai creando una rettifica o nuova versione. Il certificato precedente verrà collegato e marcato come aggiornato, mantenendo lo storico completo.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
          ⚠️ {state.error}
        </div>
      ) : null}

      {/* Section 1: Patient & Doctor Selection */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              1. Paziente Intestatario
            </h3>
            {selectedPatient ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Selezionato
              </span>
            ) : null}
          </div>

          {!initialPatientId ? (
            <div className="space-y-2">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Cerca per cognome, nome o codice fiscale..."
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-emerald-900"
              />
              <select
                name="patientId"
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setManualContent(null);
                }}
                required
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-emerald-900"
              >
                <option value="" disabled>
                  -- Seleziona un paziente --
                </option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName} {p.firstName} {p.taxId ? `(${p.taxId})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="patientId" value={selectedPatientId} />
          )}

          {selectedPatient ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-950 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-200">
              <p className="text-sm font-semibold">
                {selectedPatient.lastName} {selectedPatient.firstName}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-emerald-900/80 dark:text-emerald-300/80">
                <div>
                  <span className="font-semibold">C.F.:</span> {selectedPatient.taxId || "—"}
                </div>
                <div>
                  <span className="font-semibold">Data Nascita:</span>{" "}
                  {selectedPatient.birthDate
                    ? new Date(selectedPatient.birthDate).toLocaleDateString("it-IT")
                    : "—"}
                </div>
                <div>
                  <span className="font-semibold">Telefono:</span> {selectedPatient.phone || "—"}
                </div>
                <div>
                  <span className="font-semibold">Città:</span> {selectedPatient.city || "—"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Seleziona un paziente per compilare automaticamente il certificato.</p>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            2. Medico / Emittente & Luogo
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Medico di riferimento
              <select
                name="doctorId"
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value);
                  const doc = doctors.find((d) => d.id === e.target.value);
                  if (doc) setDoctorNameInput(doc.fullName);
                }}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">-- Seleziona o digita nome --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} {d.specialty ? `(${d.specialty})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nome emittente / Dicitura timbro
              <input
                type="text"
                name="doctorName"
                value={doctorNameInput}
                onChange={(e) => setDoctorNameInput(e.target.value)}
                placeholder="Dott. Mario Rossi"
                required
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Luogo di rilascio
              <input
                type="text"
                name="place"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Data rilascio
              <input
                type="date"
                name="issuedAt"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Section 2: Template Selection */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          3. Tipologia di Certificato & Modello Predefinito
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Scegli un modello per generare automaticamente il testo legale appropriato.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(CERTIFICATE_TEMPLATES) as CertificateType[]).map((typeKey) => {
            const tpl = CERTIFICATE_TEMPLATES[typeKey];
            const isSelected = certType === typeKey;
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => handleTemplateChange(typeKey)}
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-zinc-200 bg-zinc-50/60 text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{tpl.label}</span>
                    {isSelected ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {tpl.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="type" value={certType} />
      </div>

      {/* Section 3: Clinical Parameters & Dates */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          4. Dati Clinici, Prognosi & Date
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="sm:col-span-3 flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Diagnosi / Motivo clinico
            <input
              type="text"
              name="diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="es. postumi da avulsione dentaria chirurgica e necessità di riposo"
              className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          {certType === "WORK_INCAPACITY" ? (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Data inizio riposo
                <input
                  type="date"
                  name="startDate"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Data fine riposo (compresa)
                <input
                  type="date"
                  name="endDate"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Giorni totali di prognosi
                <input
                  type="number"
                  name="prognosisDays"
                  min="1"
                  max="365"
                  value={prognosisDays}
                  onChange={(e) => handleDaysChange(Number.parseInt(e.target.value, 10) || 1)}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            </>
          ) : certType === "ATTENDANCE" ? (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Ora inizio permanenza
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Ora fine permanenza
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
            </>
          ) : null}
        </div>
      </div>

      {/* Section 4: Editable Certificate Text */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              5. Testo del Certificato (Completamente Modificabile)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Puoi modificare liberamente qualsiasi frase o aggiungere dettagli specifici prima del salvataggio.
            </p>
          </div>
          {manualContent !== null ? (
            <button
              type="button"
              onClick={() => setManualContent(null)}
              className="text-xs font-semibold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
            >
              Ripristina testo predefinito
            </button>
          ) : null}
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Titolo certificato
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Corpo del testo
          <textarea
            name="content"
            value={effectiveContent}
            rows={8}
            onChange={(e) => {
              setManualContent(e.target.value);
            }}
            required
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 font-sans text-sm leading-relaxed text-zinc-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:bg-zinc-950"
          />
        </label>
      </div>

      {/* Section 5: Digital Signature */}
      <CertificateSignature
        doctorName={doctorNameInput}
        initialSignatureUrl={initialData?.signatureUrl}
      />

      {/* Submit Button */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300"
        >
          Annulla
        </button>
        <FormSubmitButton className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
          {rootCertificateId ? "Salva Nuova Versione" : "Emetti Certificato Ufficiale"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
