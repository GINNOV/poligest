"use client";

import { useState } from "react";
import { PATIENT_POST_CREATE_STORAGE_KEY } from "@/lib/app-preferences";

const DEFAULT_REDIRECT = "dashboard";

export function PatientCreateRedirectField() {
  const [value] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_REDIRECT;
    return window.localStorage.getItem(PATIENT_POST_CREATE_STORAGE_KEY) ?? DEFAULT_REDIRECT;
  });

  return <input type="hidden" name="postCreateRedirect" value={value} readOnly />;
}
