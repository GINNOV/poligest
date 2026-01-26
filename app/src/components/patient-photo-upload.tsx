"use client";

import { useRef } from "react";

type PatientPhotoUploadProps = {
  patientId: string;
  uploadPhoto: (formData: FormData) => Promise<void>;
};

export function PatientPhotoUpload({ patientId, uploadPhoto }: PatientPhotoUploadProps) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form action={uploadPhoto} ref={formRef} className="flex flex-col gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600">
        <span>Scegli foto</span>
        <input
          type="file"
          name="photo"
          accept="image/*"
          className="hidden"
          required
          onChange={() => {
            formRef.current?.requestSubmit();
          }}
        />
      </label>
    </form>
  );
}
