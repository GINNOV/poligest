"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STORAGE_VIEW = "calendarView";

export function calendarDoctorStorageKey(userId: string) {
  return `calendarDoctor:${userId}`;
}

type Props = {
  doctorIds: string[];
  userId: string;
  linkedDoctorId?: string | null;
};

export function CalendarPreferencesSync({ doctorIds, userId, linkedDoctorId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchParamString);
    let shouldReplace = false;

    const doctorParam = params.get("doctor");
    const viewParam = params.get("view");

    const storedDoctor = window.localStorage.getItem(calendarDoctorStorageKey(userId));
    if (!doctorParam && storedDoctor && (storedDoctor === "all" || doctorIds.includes(storedDoctor))) {
      params.set("doctor", storedDoctor);
      shouldReplace = true;
    } else if (!doctorParam && linkedDoctorId && doctorIds.includes(linkedDoctorId)) {
      params.set("doctor", linkedDoctorId);
      shouldReplace = true;
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
  }, [doctorIds, linkedDoctorId, router, searchParamString, userId]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamString);
    const doctorParam = params.get("doctor");
    const viewParam = params.get("view");

    if (doctorParam) {
      window.localStorage.setItem(calendarDoctorStorageKey(userId), doctorParam);
    }

    if (viewParam === "week" || viewParam === "month") {
      window.localStorage.setItem(STORAGE_VIEW, viewParam);
    }
  }, [searchParamString, userId]);

  return null;
}
