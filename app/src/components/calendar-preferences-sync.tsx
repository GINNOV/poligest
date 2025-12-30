"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_DOCTOR = "calendarDoctor";
const STORAGE_VIEW = "calendarView";

type Props = {
  doctorIds: string[];
};

export function CalendarPreferencesSync({ doctorIds }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let shouldReplace = false;

    const doctorParam = params.get("doctor");
    const viewParam = params.get("view");

    const storedDoctor = window.localStorage.getItem(STORAGE_DOCTOR);
    if (!doctorParam && storedDoctor) {
      if (storedDoctor === "all" || doctorIds.includes(storedDoctor)) {
        params.set("doctor", storedDoctor);
        shouldReplace = true;
      }
    }

    const storedView = window.localStorage.getItem(STORAGE_VIEW);
    if (!viewParam && storedView && (storedView === "week" || storedView === "month")) {
      params.set("view", storedView);
      shouldReplace = true;
    }

    if (shouldReplace) {
      router.replace(`/calendar?${params.toString()}`);
    }
  }, [doctorIds, router, searchParams]);

  useEffect(() => {
    const doctorParam = searchParams.get("doctor");
    const viewParam = searchParams.get("view");

    if (doctorParam) {
      window.localStorage.setItem(STORAGE_DOCTOR, doctorParam);
    }

    if (viewParam === "week" || viewParam === "month") {
      window.localStorage.setItem(STORAGE_VIEW, viewParam);
    }
  }, [searchParams]);

  return null;
}
