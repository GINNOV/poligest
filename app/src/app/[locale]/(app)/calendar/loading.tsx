export default function CalendarLoading() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm">
      <div className="flex flex-col items-center justify-center gap-3 text-sm text-zinc-600">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        <p className="font-semibold">Caricamento calendario...</p>
      </div>
    </div>
  );
}
