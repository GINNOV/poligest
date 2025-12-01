'use client';

import { useStackApp } from "@stackframe/stack";
import { useRouter } from "next/navigation";

export function SignOutButton({ label }: { label: string }) {
  const app = useStackApp();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(app.urls.signOut)}
      className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
    >
      {label}
    </button>
  );
}
