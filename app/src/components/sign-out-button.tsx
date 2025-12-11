"use client";

import { useRouter } from "next/navigation";

export function SignOutButton({
  label,
  signOutUrl = "/handler/sign-out",
}: {
  label: string;
  signOutUrl?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(signOutUrl)}
      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
    >
      {label}
    </button>
  );
}
