import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { RecallStatus, Role } from "@prisma/client";

const TILE_IMAGE_VERSION = "2";

const TILES = [
  {
    key: "programmati",
    title: "Richiami in scadenza",
    description: "Coda dei richiami e pianificazione manuale per i pazienti.",
    href: "/richiami/programmati",
    tone: "primary",
    image: "/tiles/expiring_recalls.png",
  },
  {
    key: "regole",
    title: "Regole automatiche",
    description: "Richiami ricorrenti per servizio + promemoria appuntamenti.",
    href: "/richiami/regole",
    tone: "primary",
    image: "/tiles/auto_rules.png",
  },
  {
    key: "manuale",
    title: "Promemoria manuali",
    description: "Invia notifiche rapide per appuntamenti o eventi speciali.",
    href: "/richiami/manuale",
    tone: "neutral",
    image: "/tiles/manuale_reminders.png",
  },
  {
    key: "ricorrenti",
    title: "Comunicazioni ricorrenti",
    description: "Email automatiche per festività, chiusure studio e compleanni.",
    href: "/richiami/ricorrenti",
    tone: "neutral",
    image: "/tiles/recurrent_comms.png",
  },
] as const;

type Tile = (typeof TILES)[number];

type TileWithBadge = Tile & { badge?: string };

export default async function RichiamiPage() {
  await requireUser([Role.ADMIN, Role.MANAGER, Role.SECRETARY]);
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  const [recallsCount, rulesCount, upcomingAppointmentsCount, recurringConfigsCount] =
    await Promise.all([
      prisma.recall.count({
        where: {
          status: { in: [RecallStatus.PENDING, RecallStatus.CONTACTED, RecallStatus.SKIPPED] },
          dueAt: { lte: soon },
        },
      }),
      prisma.recallRule.count(),
      prisma.appointment.count({
        where: { startsAt: { gte: now, lte: soon } },
      }),
      prisma.recurringMessageConfig.count(),
    ]);

  const tiles: TileWithBadge[] = TILES.map((tile) => {
    if (tile.key === "programmati") {
      return { ...tile, badge: `${recallsCount} in coda` };
    }
    if (tile.key === "regole") {
      return { ...tile, badge: `${rulesCount} regole` };
    }
    if (tile.key === "manuale") {
      return { ...tile, badge: `${upcomingAppointmentsCount} appuntamenti` };
    }
    if (tile.key === "ricorrenti") {
      return { ...tile, badge: `${recurringConfigsCount} config.` };
    }
    return tile;
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Richiami & notifiche
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-900">
          Centro automazioni
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          Scegli la sezione per configurare regole, invii manuali e comunicazioni ricorrenti.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="group relative flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
          >
            <div className="space-y-3">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition group-hover:border-emerald-200">
                <Image
                  src={`${tile.image}?v=${TILE_IMAGE_VERSION}`}
                  alt={`Anteprima ${tile.title}`}
                  fill
                  sizes="(min-width: 1280px) 320px, (min-width: 768px) 40vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-zinc-900">{tile.title}</h2>
                </div>
                {tile.badge ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      tile.tone === "primary"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {tile.badge}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-600">{tile.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
