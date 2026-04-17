"use client";

export function AuditRecordNav({
  containerId,
  showLabels = true,
}: {
  containerId: string;
  showLabels?: boolean;
}) {
  const scrollTo = (direction: "next" | "prev") => {
    const current = document.getElementById(containerId);
    if (!current) return;

    // Find all audit record containers
    const allRecords = Array.from(document.querySelectorAll(".audit-record"));
    const currentIndex = allRecords.indexOf(current);

    if (direction === "next" && currentIndex !== -1 && currentIndex < allRecords.length - 1) {
      const next = allRecords[currentIndex + 1];
      next.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (direction === "prev" && currentIndex > 0) {
      const prev = allRecords[currentIndex - 1];
      prev.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => scrollTo("prev")}
        title="Record precedente"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 shadow-sm"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      {showLabels && (
        <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-400 dark:text-zinc-500">
          Record
        </span>
      )}
      <button
        onClick={() => scrollTo("next")}
        title="Record successivo"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 shadow-sm"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
