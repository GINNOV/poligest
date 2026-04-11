import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const studio = {
  name: "Studio Associato Dottori Agovino e Angrisano",
  address: "Traversa I Farricella, 115",
  city: "80040 Striano (NA)",
  phone: "081 8654557",
  email: "studio.agovino.angrisano@gmail.com",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-14 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex justify-center">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
            <Image
              src="/logo/studio_agovinoangrisano_logo.png"
              alt="Studio Agovino & Angrisano"
              fill
              className="object-contain p-2"
              sizes="80px"
              priority
            />
          </div>
        </div>

        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Contatti</p>
          <h1 className="text-3xl font-semibold">{studio.name}</h1>
          <p className="text-sm text-zinc-600">
            Per appuntamenti, modifiche o richieste amministrative puoi contattare direttamente lo studio.
          </p>
        </div>

        <section className="grid gap-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Telefono</p>
            <a href={`tel:${studio.phone.replace(/\s+/g, "")}`} className="mt-2 block text-sm font-semibold text-zinc-900 hover:text-emerald-700">
              {studio.phone}
            </a>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Email</p>
            <a href={`mailto:${studio.email}`} className="mt-2 block break-all text-sm font-semibold text-zinc-900 hover:text-emerald-700">
              {studio.email}
            </a>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Indirizzo</p>
            <p className="mt-2 text-sm font-semibold text-zinc-900">{studio.address}</p>
            <p className="text-sm text-zinc-700">{studio.city}</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <Button asChild variant="primary" className="rounded-full"><Link href="/">Torna alla home</Link></Button>
          <Button asChild variant="outline" className="rounded-full border-zinc-200"><Link href="/staff">Area staff</Link></Button>
        </div>
      </div>
    </main>
  );
}
