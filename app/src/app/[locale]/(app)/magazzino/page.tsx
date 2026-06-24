import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { createPageMetadata, PAGE_TITLES } from "@/lib/page-metadata";

export const metadata = createPageMetadata(PAGE_TITLES.magazzino);

export const revalidate = 60;

const cards = [
  {
    href: "/magazzino/fornitori",
    image: "/tiles/suppliers.png",
    alt: "Gestione fornitori",
    title: "Gestione fornitori",
    description: "Aggiungi nuovi fornitori. Aggiorna fornitori esistenti.",
  },
  {
    href: "/magazzino/prodotti",
    image: "/tiles/products.png",
    alt: "Gestione prodotti",
    title: "Gestione prodotti",
    description: "Aggiungi, cerca, aggiorna o elimina prodotti di magazzino.",
  },
  {
    href: "/magazzino/impianti",
    image: "/tiles/materiali_spese_ufficio.png",
    alt: "Gestione impianti",
    title: "Gestione impianti",
    description: "Registra impianti per associarli a pazienti",
  },
  {
    href: "/magazzino/movimenti",
    image: "/tiles/accounting.png",
    alt: "Movimenti",
    title: "Movimenti",
    description: "Entrate e uscite per il magazzino.",
  },
];

export default async function MagazzinoPage() {
  await requireUser([Role.ADMIN, Role.MANAGER]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Magazzino</p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Gestione magazzino</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <Image
                src={card.image}
                alt={card.alt}
                width={640}
                height={360}
                className="h-44 w-full object-cover"
              />
            </div>
            <h2 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">{card.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
