"use client";

import {
  CredentialSignIn,
  MagicLinkSignIn,
  OAuthButton,
  useStackApp,
  useUser,
} from "@stackframe/stack";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

type SignInMethodId = "email" | "password" | `oauth:${string}`;

type SignInMethodOption =
  | { id: SignInMethodId; kind: "oauth"; provider: string; label: string; description: string }
  | { id: "email"; kind: "email"; label: string; description: string }
  | { id: "password"; kind: "password"; label: string; description: string };

const OAUTH_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  facebook: "Facebook",
  microsoft: "Microsoft",
};

function oauthLabel(provider: string) {
  return OAUTH_LABELS[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

function parseMethod(raw: string | null): SignInMethodId | null {
  if (!raw) return null;
  if (raw === "email" || raw === "password") return raw;
  if (raw.startsWith("oauth:")) return raw as SignInMethodId;
  if (raw in OAUTH_LABELS || /^[a-z]+$/.test(raw)) return `oauth:${raw}`;
  return null;
}

function methodToParam(method: SignInMethodId): string {
  if (method.startsWith("oauth:")) return method.slice("oauth:".length);
  return method;
}

function SignUpLink({ isStaff }: { isStaff: boolean }) {
  const stackApp = useStackApp();
  const project = stackApp.useProject();
  const router = useRouter();
  const searchParams = useSearchParams();

  const signUpHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("method");
    const query = params.toString();
    const signUpPath = stackApp.urls.signUp.replace(window.location.origin, "");
    return query ? `${signUpPath}?${query}` : signUpPath;
  }, [searchParams, stackApp.urls.signUp]);

  if (!project.config.signUpEnabled) return null;

  return (
    <p className={`mt-6 text-center text-sm ${isStaff ? "text-slate-400" : "text-zinc-600 dark:text-slate-400"}`}>
      Non hai un account?{" "}
      <button
        type="button"
        className={
          isStaff
            ? "font-semibold text-cyan-400 hover:text-cyan-300"
            : "font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-400"
        }
        onClick={() => router.push(signUpHref)}
      >
        Registrati
      </button>
    </p>
  );
}

function MethodPicker({
  isStaff,
  options,
  onSelect,
  showSignUpLink,
}: {
  isStaff: boolean;
  options: SignInMethodOption[];
  onSelect: (method: SignInMethodId) => void;
  showSignUpLink: boolean;
}) {
  const buttonClass = isStaff
    ? "group flex w-full flex-col items-start gap-1 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3.5 text-left transition hover:border-cyan-500/60 hover:bg-slate-800"
    : "group flex w-full flex-col items-start gap-1 rounded-xl border border-emerald-100 bg-white px-4 py-3.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-emerald-700";

  const titleClass = isStaff ? "text-sm font-semibold text-slate-100" : "text-sm font-semibold text-zinc-900 dark:text-slate-100";
  const descClass = isStaff ? "text-xs text-slate-400" : "text-xs text-zinc-500 dark:text-slate-400";

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className={isStaff ? "text-xl font-semibold text-slate-100" : "text-xl font-semibold text-zinc-900 dark:text-slate-100"}>
          Come vuoi accedere?
        </h2>
        <p className={isStaff ? "text-sm text-slate-400" : "text-sm text-zinc-600 dark:text-slate-400"}>
          Scegli il metodo più comodo per te.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={buttonClass}
            onClick={() => onSelect(option.id)}
          >
            <span className={titleClass}>{option.label}</span>
            <span className={descClass}>{option.description}</span>
          </button>
        ))}
      </div>

      {showSignUpLink ? <SignUpLink isStaff={isStaff} /> : null}
    </div>
  );
}

function MethodForm({
  isStaff,
  method,
  option,
  onBack,
}: {
  isStaff: boolean;
  method: SignInMethodId;
  option: SignInMethodOption;
  onBack?: () => void;
}) {
  const backClass = isStaff
    ? "mb-4 inline-flex items-center text-sm font-medium text-cyan-400 transition hover:text-cyan-300"
    : "mb-4 inline-flex items-center text-sm font-medium text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-400";

  return (
    <div>
      {onBack ? (
        <button type="button" className={backClass} onClick={onBack}>
          ← Cambia metodo
        </button>
      ) : null}

      <div className="mb-5 space-y-1">
        <h2 className={isStaff ? "text-xl font-semibold text-slate-100" : "text-xl font-semibold text-zinc-900 dark:text-slate-100"}>
          {option.label}
        </h2>
        <p className={isStaff ? "text-sm text-slate-400" : "text-sm text-zinc-600 dark:text-slate-400"}>
          {option.description}
        </p>
      </div>

      <div className="stack-scope">
        {method.startsWith("oauth:") ? (
          <OAuthButton provider={method.slice("oauth:".length)} type="sign-in" />
        ) : method === "email" ? (
          <MagicLinkSignIn />
        ) : (
          <CredentialSignIn />
        )}
      </div>
    </div>
  );
}

export function StackSignInFlow({ isStaff }: { isStaff: boolean }) {
  const stackApp = useStackApp();
  const user = useUser({ includeRestricted: true });
  const project = stackApp.useProject();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!user) return;
    void stackApp.redirectToAfterSignIn({ replace: true });
  }, [stackApp, user]);

  const method = parseMethod(searchParams.get("method"));

  const options = useMemo(() => {
    const entries: SignInMethodOption[] = [];

    for (const provider of project.config.oauthProviders) {
      const name = oauthLabel(provider.id);
      entries.push({
        id: `oauth:${provider.id}`,
        kind: "oauth",
        provider: provider.id,
        label: `Accedi con ${name}`,
        description: `Usa il tuo account ${name} dello studio.`,
      });
    }

    if (project.config.magicLinkEnabled) {
      entries.push({
        id: "email",
        kind: "email",
        label: "Codice via email",
        description: "Ricevi un codice monouso nella tua casella di posta.",
      });
    }

    if (project.config.credentialEnabled) {
      entries.push({
        id: "password",
        kind: "password",
        label: "Email e password",
        description: "Accedi con le credenziali che hai già impostato.",
      });
    }

    return entries;
  }, [project.config.credentialEnabled, project.config.magicLinkEnabled, project.config.oauthProviders]);

  const selectedOption = method ? options.find((option) => option.id === method) : undefined;

  const updateMethod = (nextMethod: SignInMethodId | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMethod) {
      params.set("method", methodToParam(nextMethod));
    } else {
      params.delete("method");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  if (options.length === 0) {
    return (
      <p className={isStaff ? "text-center text-sm text-slate-400" : "text-center text-sm text-zinc-600 dark:text-slate-400"}>
        Nessun metodo di accesso è attualmente disponibile. Contatta l&apos;assistenza.
      </p>
    );
  }

  if (options.length === 1) {
    const only = options[0]!;
    return (
      <>
        <MethodForm isStaff={isStaff} method={only.id} option={only} />
        <SignUpLink isStaff={isStaff} />
      </>
    );
  }

  if (!method || !selectedOption) {
    return <MethodPicker isStaff={isStaff} options={options} onSelect={updateMethod} showSignUpLink={true} />;
  }

  return <MethodForm isStaff={isStaff} method={method} option={selectedOption} onBack={() => updateMethod(null)} />;
}