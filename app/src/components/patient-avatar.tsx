"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type Props = {
  src?: string | null;
  alt: string;
  size: number;
  className?: string;
};

export function PatientAvatar({ src, alt, size, className }: Props) {
  const fallback = "/avatars/missing_patient.jpg";
  const avatarPool = [
    "/avatars/avatar_1.jpg",
    "/avatars/avatar_2.jpg",
    "/avatars/avatar_3.jpg",
    "/avatars/avatar_4.jpg",
    "/avatars/avatar_5.jpg",
    "/avatars/avatar_6.jpg",
    "/avatars/avatar_7.jpg",
  ];
  const maleFallback = "/avatars/missing_patient_male.jpg";
  const femaleFallback = "/avatars/missing_patient_female.png";
  const maleExceptions = new Set([
    "luca",
    "andrea",
    "nicola",
    "mattia",
    "elia",
    "gabriele",
  ]);
  const femaleExceptions = new Set([
    "marta",
    "maria",
    "anna",
    "sofia",
  ]);
  const guessGender = (label: string) => {
    const first = label.trim().split(/\s+/)[1] || label.trim().split(/\s+/)[0] || "";
    const lower = first.toLowerCase();
    if (!lower) return "unknown";
    if (maleExceptions.has(lower)) return "male";
    if (femaleExceptions.has(lower)) return "female";
    if (lower.endsWith("a")) return "female";
    if (lower.endsWith("o")) return "male";
    return "unknown";
  };
  const genderGuess = guessGender(alt);
  const genderPool =
    genderGuess === "female"
      ? [femaleFallback, ...avatarPool]
      : genderGuess === "male"
        ? [maleFallback, ...avatarPool]
        : avatarPool;
  const deterministicAvatar = useMemo(() => {
    const value = alt.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % genderPool.length;
    return genderPool[index] ?? fallback;
  }, [alt, genderPool, fallback]);
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
