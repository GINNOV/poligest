"use client";

export function NextRecordButton({ containerId }: { containerId: string }) {
  const scrollToNext = () => {
    const current = document.getElementById(containerId);
    if (!current) return;

    // Find all audit record containers
    const allRecords = Array.from(document.querySelectorAll(".audit-record"));
    const currentIndex = allRecords.indexOf(current);

    if (currentIndex !== -1 && currentIndex < allRecords.length - 1) {
      const next = allRecords[currentIndex + 1];
      next.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      onClick={scrollToNext}
      className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      Prossimo record ↓
    </button>
  );
}
