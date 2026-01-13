"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  doctors: string[];
  selectedDoctor: string;
};

export function DoctorFilter({ doctors, selectedDoctor }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      nextParams.delete("doctor");
    } else {
      nextParams.set("doctor", value);
    }
    const qs = nextParams.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard");
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-zinc-700">Appuntamenti per...</label>
      <select
        onChange={(e) => handleChange(e.target.value)}
        value={selectedDoctor || "all"}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="all">Tutti i medici</option>
        {doctors.map((doc) => (
          <option key={doc} value={doc}>
            {doc}
          </option>
        ))}
      </select>
    </div>
  );
}
