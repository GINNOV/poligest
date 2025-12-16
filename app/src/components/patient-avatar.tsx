"use client";

import { useState } from "react";
import clsx from "clsx";

type Props = {
  src?: string | null;
  alt: string;
  size: number;
  className?: string;
};

export function PatientAvatar({ src, alt, size, className }: Props) {
  const fallback = "/avatars/missing_patient.jpg";
  const [currentSrc, setCurrentSrc] = useState(src || fallback);

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
