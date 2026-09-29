const chips = [
  {
    minutes: 60,
    label: "1H",
    active: (durationMinutes: number) => durationMinutes > 45,
    idle: "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100",
    on: "border-violet-500 bg-violet-200 text-violet-950 ring-2 ring-violet-300 dark:border-violet-400 dark:bg-violet-800/70 dark:text-violet-50 dark:ring-violet-700",
    slot: "border-violet-600 bg-violet-300 text-violet-950 hover:bg-violet-400 dark:border-violet-300 dark:bg-violet-700 dark:text-violet-50 dark:hover:bg-violet-600",
    slotOn: "border-violet-900 bg-violet-700 text-white ring-2 ring-violet-400 dark:border-violet-100 dark:bg-violet-300 dark:text-violet-950 dark:ring-violet-200",
  },
  {
    minutes: 30,
    label: "30m",
    active: (durationMinutes: number) => durationMinutes > 20 && durationMinutes <= 45,
    idle: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100",
    on: "border-emerald-500 bg-emerald-200 text-emerald-950 ring-2 ring-emerald-300 dark:border-emerald-400 dark:bg-emerald-800/70 dark:text-emerald-50 dark:ring-emerald-700",
    slot: "border-emerald-600 bg-emerald-300 text-emerald-950 hover:bg-emerald-400 dark:border-emerald-300 dark:bg-emerald-700 dark:text-emerald-50 dark:hover:bg-emerald-600",
    slotOn: "border-emerald-900 bg-emerald-700 text-white ring-2 ring-emerald-400 dark:border-emerald-100 dark:bg-emerald-300 dark:text-emerald-950 dark:ring-emerald-200",
  },
  {
    minutes: 15,
    label: "15m",
    active: (durationMinutes: number) => durationMinutes > 10 && durationMinutes <= 20,
    idle: "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100",
    on: "border-sky-500 bg-sky-200 text-sky-950 ring-2 ring-sky-300 dark:border-sky-400 dark:bg-sky-800/70 dark:text-sky-50 dark:ring-sky-700",
    slot: "border-sky-600 bg-sky-300 text-sky-950 hover:bg-sky-400 dark:border-sky-300 dark:bg-sky-700 dark:text-sky-50 dark:hover:bg-sky-600",
    slotOn: "border-sky-900 bg-sky-700 text-white ring-2 ring-sky-400 dark:border-sky-100 dark:bg-sky-300 dark:text-sky-950 dark:ring-sky-200",
  },
  {
    minutes: 5,
    label: "5m",
    active: (durationMinutes: number) => durationMinutes <= 10,
    idle: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
    on: "border-amber-500 bg-amber-200 text-amber-950 ring-2 ring-amber-300 dark:border-amber-400 dark:bg-amber-800/70 dark:text-amber-50 dark:ring-amber-700",
    slot: "border-amber-600 bg-amber-300 text-amber-950 hover:bg-amber-400 dark:border-amber-300 dark:bg-amber-700 dark:text-amber-50 dark:hover:bg-amber-600",
    slotOn: "border-amber-900 bg-amber-500 text-amber-950 ring-2 ring-amber-400 dark:border-amber-100 dark:bg-amber-300 dark:text-amber-950 dark:ring-amber-200",
  },
] as const;

export function slotDurationClass(durationMinutes: number, isSelected: boolean) {
  const chip = chips.find((item) => item.active(durationMinutes)) ?? chips[chips.length - 1];
  return isSelected ? chip.slotOn : chip.slot;
}

export function AppointmentDurationChips({
  durationMinutes,
  onSelect,
}: {
  durationMinutes: number;
  onSelect: (minutes: number) => void;
}) {
  return (
    <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
      {chips.map((chip) => {
        const selected = chip.active(durationMinutes);
        return (
          <button
            key={chip.minutes}
            type="button"
            aria-pressed={selected}
            className={`h-9 rounded-full border px-3 text-xs font-semibold transition ${selected ? chip.on : chip.idle}`}
            onClick={() => onSelect(chip.minutes)}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
