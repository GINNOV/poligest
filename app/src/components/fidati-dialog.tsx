"use client";

import { createPortal } from "react-dom";
import { useEffect, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

const FIDATI_VIDEO_ID = "ygqGg3F3Yhc";
const FIDATI_EMBED_SRC = `https://www.youtube-nocookie.com/embed/${FIDATI_VIDEO_ID}?controls=0&modestbranding=1&rel=0&playsinline=1&fs=0&iv_load_policy=3&disablekb=1`;

type FidatiDialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
};

export function FidatiDialog({ open, onClose }: FidatiDialogProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-50">Fidati.</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-lg leading-none transition rounded-lg"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <div className="relative w-full overflow-hidden rounded-xl bg-black aspect-video">
          <iframe
            key={FIDATI_VIDEO_ID}
            src={FIDATI_EMBED_SRC}
            title="Fidati"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
