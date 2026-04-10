"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  appointmentId: string;
  whatsappHref: string | null;
  initialReminderSent?: boolean;
};

export function AgendaReminderButton({ appointmentId, whatsappHref, initialReminderSent = false }: Props) {
  const [clicked, setClicked] = useState(false);
  const reminderSent = initialReminderSent || clicked;

  const handleClick = () => {
    if (!whatsappHref) return;
    setClicked(true);
    
    const clickLogUrl = `/api/appointments/${appointmentId}/whatsapp-reminder-click`;
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(clickLogUrl, new Blob(["{}"], { type: "application/json" }));
    } else {
      void fetch(clickLogUrl, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    }
    
    window.location.href = whatsappHref;
  };

  if (!whatsappHref) {
    return (
      <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-emerald-700/60 px-3 text-xs font-semibold text-white opacity-70">
        <Image src="/whatsapp.png" alt="" width={18} height={18} />
        Promemoria
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold text-white transition ${
        reminderSent
          ? "bg-emerald-700 hover:bg-emerald-600"
          : "bg-rose-600 hover:bg-rose-500"
      }`}
    >
      <Image src="/whatsapp.png" alt="" width={18} height={18} />
      Promemoria
    </button>
  );
}
