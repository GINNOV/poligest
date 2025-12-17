"use client";

import { useRouter, useSearchParams } from "next/navigation";

type DoctorOption = {
  id: string;
  label: string;
};

type Props = {
  doctors: DoctorOption[];
  selectedDoctorId?: string;
};

export function CalendarDoctorFilter({ doctors, selectedDoctorId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (!value) {
      nextParams.delete("doctor");
    } else {
      nextParams.set("doctor", value);
    }
    const qs = nextParams.toString();
    router.push(qs ? `/calendar?${qs}` : "/calendar");
  };

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <label className="text-xs font-semibold uppercase text-zinc-500">Medico</label>
      <select
        onChange={(e) => handleChange(e.target.value)}
        value={selectedDoctorId ?? ""}
        className="h-10 w-full rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:w-64"
      >
        {doctors.length === 0 ? (
          <option value="">Nessun medico disponibile</option>
        ) : (
          doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
