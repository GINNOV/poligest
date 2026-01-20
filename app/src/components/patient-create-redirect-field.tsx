"use client";

import { useEffect, useState } from "react";
import { PATIENT_POST_CREATE_STORAGE_KEY } from "@/lib/app-preferences";

const DEFAULT_REDIRECT = "dashboard";

export function PatientCreateRedirectField() {
  const [value, setValue] = useState(DEFAULT_REDIRECT);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PATIENT_POST_CREATE_STORAGE_KEY);
    if (stored) {
      setValue(stored);
    }
  }, []);

  return <input type="hidden" name="postCreateRedirect" value={value} readOnly />;
}
