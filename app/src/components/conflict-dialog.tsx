"use client";

type ConflictDialogProps = {
  message: string;
  onClose: () => void;
  actionLabel?: string;
};

export function ConflictDialog({ message, onClose, actionLabel = "Chiudi" }: ConflictDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-3 text-center text-lg font-semibold text-rose-700">Conflitto orario</div>
        <p className="text-sm text-zinc-700">{message}</p>
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
