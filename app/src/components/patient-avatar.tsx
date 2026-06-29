/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { resolvePatientPhotoUrl } from "@/lib/patient-avatars";

type Props = {
  src?: string | null;
  alt: string;
  patientId?: string;
  firstName?: string | null;
  taxId?: string | null;
  size: number;
  gender?: "MALE" | "FEMALE" | "OTHER" | "NOT_SPECIFIED" | null;
  className?: string;
};

export function PatientAvatar({
  src,
  alt,
  patientId,
  firstName,
  taxId,
  size,
  gender,
  className,
}: Props) {
  const fallback = "/avatars/missing_patient.jpg";
  const resolvedFirstName = useMemo(() => {
    if (firstName?.trim()) return firstName;
    const tokens = alt.trim().split(/\s+/).filter(Boolean);
    return tokens[tokens.length - 1] ?? "";
  }, [alt, firstName]);

  const preferredSrc = useMemo(
    () =>
      resolvePatientPhotoUrl({
        patientId: patientId ?? alt.trim().toLowerCase(),
        firstName: resolvedFirstName,
        gender,
        photoUrl: src,
        taxId,
      }),
    [src, patientId, resolvedFirstName, gender, taxId, alt],
  );
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