"use client";

import { useState } from "react";
import { PatientAvatar } from "@/components/patient-avatar";
import { PatientPhotoCameraCapture } from "@/components/patient-photo-camera-capture";
import { PatientPhotoUpload } from "@/components/patient-photo-upload";

type PatientPhotoDialogProps = {
  patientId: string;
  fullName: string;
  photoUrl?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "NOT_SPECIFIED" | null;
  uploadPhoto: (formData: FormData) => Promise<void>;
  resetPhoto: (formData: FormData) => Promise<void>;
};

export function PatientPhotoDialog({
  patientId,
  fullName,
  photoUrl,
  gender,
  uploadPhoto,
  resetPhoto,
}: PatientPhotoDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300"
      >
        Gestisci foto
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Foto paziente</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900">{fullName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300"
              >
                Chiudi
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[160px,1fr]">
              <div className="flex flex-col items-center gap-2">
                <PatientAvatar
                  src={photoUrl}
                  alt={fullName}
                  gender={gender}
                  size={128}
                  className="h-32 w-32 rounded-full"
                />
                <form action={resetPhoto} className="flex">
                  <input type="hidden" name="patientId" value={patientId} />
                  <button
                    type="submit"
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300"
                  >
                    Ripristina avatar
                  </button>
                </form>
              </div>
              <div className="flex flex-col gap-4">
                <PatientPhotoUpload patientId={patientId} uploadPhoto={uploadPhoto} />
                <PatientPhotoCameraCapture
                  patientId={patientId}
                  uploadPhoto={uploadPhoto}
                  maxBytes={2 * 1024 * 1024}
                  onComplete={() => setIsOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
