"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  appointmentId: string;
  whatsappHref: string | null;
  initialReminderSent?: boolean;
  initialReminderSendCount?: number;
  size?: "default" | "compact";
};

export function AgendaReminderButton({
  appointmentId,
  whatsappHref,
  initialReminderSent = false,
  initialReminderSendCount,
  size = "default",
}: Props) {
  const initialSendCount =
    typeof initialReminderSendCount === "number"
      ? initialReminderSendCount
      : initialReminderSent
        ? 1
        : 0;
  const [sendCount, setSendCount] = useState(initialSendCount);
  const buttonTone =
    sendCount >= 2
      ? "bg-purple-700 hover:bg-purple-600"
      : sendCount === 1
        ? "bg-emerald-700 hover:bg-emerald-600"
        : "bg-rose-600 hover:bg-rose-500";

  const handleClick = () => {
    if (!whatsappHref) return;
    setSendCount((count) => count + 1);

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

  const isCompact = size === "compact";
  const buttonClass = isCompact
    ? "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-white transition"
    : "inline-flex h-9 w-full items-center justify-center gap-2 rounded-full px-3 text-xs font-semibold text-white transition";
  const iconSize = isCompact ? 14 : 18;

  if (!whatsappHref) {
    return (
      <span className={`${buttonClass} bg-emerald-700/60 opacity-70`}>
        <Image src="/whatsapp.png" alt="" width={iconSize} height={iconSize} />
        Promemoria
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${buttonClass} ${buttonTone}`}
    >
      <Image src="/whatsapp.png" alt="" width={iconSize} height={iconSize} />
      Promemoria
    </button>
  );
}
