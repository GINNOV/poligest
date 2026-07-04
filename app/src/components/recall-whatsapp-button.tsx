"use client";

import Image from "next/image";
import { useTransition } from "react";

type Props = {
  recallId: string;
  whatsappHref: string;
  action: (recallId: string) => Promise<void>;
};

export function RecallWhatsappButton({ recallId, whatsappHref, action }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    // Open the WhatsApp link in a new window/tab
    window.open(whatsappHref, "_blank", "noopener,noreferrer");

    // Update status in the background
    startTransition(async () => {
      try {
        await action(recallId);
      } catch (err) {
        console.error("Failed to mark recall as contacted:", err);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition shrink-0 ${
        isPending
          ? "bg-emerald-700/60 cursor-not-allowed"
          : "bg-emerald-700 hover:bg-emerald-600"
      }`}
    >
      <Image src="/whatsapp.png" alt="" width={12} height={12} className="shrink-0 brightness-0 invert" />
      <span>{isPending ? "Invio..." : "Invia"}</span>
    </button>
  );
}
