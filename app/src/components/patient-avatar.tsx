"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [currentSrc, setCurrentSrc] = useState(src || deterministicAvatar || fallback);

  useEffect(() => {
    setCurrentSrc(src || deterministicAvatar || fallback);
  }, [src, deterministicAvatar, fallback]);

  return (
    // Using <img> avoids Next image optimization errors on missing uploads.
    <img
      src={currentSrc}
      alt={alt}
      width={size}
      height={size}
      className={clsx("object-cover", className)}
      onError={() => {
        if (currentSrc !== fallback) {
          setCurrentSrc(fallback);
        }
      }}
    />
  );
}
