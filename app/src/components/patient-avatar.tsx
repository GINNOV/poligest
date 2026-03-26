/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { pickSystemAvatar } from "@/lib/patient-avatars";

type Props = {
  src?: string | null;
  alt: string;
  size: number;
  gender?: "MALE" | "FEMALE" | "OTHER" | "NOT_SPECIFIED" | null;
  className?: string;
};

export function PatientAvatar({ src, alt, size, gender, className }: Props) {
  const fallback = "/avatars/missing_patient.jpg";
  const deterministicAvatar = useMemo(() => {
    const seed = alt.trim().toLowerCase();
    return pickSystemAvatar(seed, gender);
  }, [alt, gender]);
  const preferredSrc = src || deterministicAvatar || fallback;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const currentSrc = failedSrc === preferredSrc ? fallback : preferredSrc;

  return (
    <img
      src={currentSrc}
      alt={alt}
      width={size}
      height={size}
      className={clsx("object-cover", className)}
      onError={() => {
        if (preferredSrc !== fallback) {
          setFailedSrc(preferredSrc);
        }
      }}
    />
  );
}
