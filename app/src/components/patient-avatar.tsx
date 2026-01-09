"use client";

import { useEffect, useState } from "react";
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
  const [randomAvatar] = useState(
    () => genderPool[Math.floor(Math.random() * genderPool.length)] ?? fallback
  );
  const [currentSrc, setCurrentSrc] = useState(src || randomAvatar || fallback);

  useEffect(() => {
    setCurrentSrc(src || randomAvatar || fallback);
  }, [src, randomAvatar, fallback]);

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
