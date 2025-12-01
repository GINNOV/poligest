'use client';

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError(t("error"));
      return;
    }

    router.push(result?.url ?? "/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-emerald-50 px-6 py-20">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg ring-1 ring-zinc-100">
        <div className="mb-6 flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-semibold text-zinc-900">
            {t("title")}
          </h1>
          <p className="text-base text-zinc-600">{t("subtitle")}</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            {t("email")}
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
            {t("password")}
            <input
              className="h-11 rounded-xl border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "..." : t("submit")}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-600">
          <Link
            href="/"
            className="font-semibold text-emerald-700 hover:text-emerald-600"
          >
            {t("back")}
          </Link>
        </div>
      </div>
    </main>
  );
}
