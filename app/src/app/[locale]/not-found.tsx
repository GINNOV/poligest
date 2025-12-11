import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex justify-center">
          <Image
            src="/status/404.png"
            alt="Pagina non trovata"
            width={360}
            height={220}
            className="h-auto max-w-full"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">Pagina non trovata</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Non riusciamo a trovare la pagina che stai cercando. Controlla l&apos;indirizzo oppure torna alla
          home.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}
