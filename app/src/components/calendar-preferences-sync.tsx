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
  const searchParamString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchParamString);
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

    const nextQuery = params.toString();
    if (shouldReplace && nextQuery !== searchParamString) {
      router.replace(`/calendar?${nextQuery}`);
    }
  }, [doctorIds, router, searchParamString]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamString);
    const doctorParam = params.get("doctor");
    const viewParam = params.get("view");

    if (doctorParam) {
      window.localStorage.setItem(STORAGE_DOCTOR, doctorParam);
    }

    if (viewParam === "week" || viewParam === "month") {
      window.localStorage.setItem(STORAGE_VIEW, viewParam);
    }
  }, [searchParamString]);

  return null;
}
