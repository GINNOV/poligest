"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { FormSubmitButton } from "@/components/form-submit-button";

type ServiceOption = {
  id: string;
  name: string;
  costBasis: number;
};

type QuoteDraft = {
  id?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  quantity?: number | null;
  price?: number | null;
  total?: number | null;
  signatureUrl?: string | null;
  signedAt?: string | null;
  items?: Array<{
    id?: string | null;
    serviceId?: string | null;
    serviceName?: string | null;
    quantity?: number | null;
    price?: number | null;
    total?: number | null;
  }>;
};

type Props = {
  patientId: string;
  services: ServiceOption[];
  initialQuote: QuoteDraft | null;
  printHref?: string | null;
  className?: string;
  onSave: (formData: FormData) => void;
};

type Point = { x: number; y: number };

function SignaturePad({
  name,
  required,
  existingSignatureUrl,
  onSignatureStateChange,
}: {
  name: string;
  required?: boolean;
  existingSignatureUrl?: string | null;
  onSignatureStateChange?: (ready: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const [useSavedSignature, setUseSavedSignature] = useState(Boolean(existingSignatureUrl));
  const isSignatureReady = Boolean(signatureData || (existingSignatureUrl && useSavedSignature));

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.scale(dpr, dpr);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#111827";
  };

  useEffect(() => {
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    onSignatureStateChange?.(isSignatureReady);
  }, [isSignatureReady, onSignatureStateChange]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getPoint(event);
    if (!canvas || !context || !point) return;
    if (useSavedSignature) return;
    isDrawing.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getPoint(event);
    if (!canvas || !context || !point) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignatureData(canvas.toDataURL("image/png"));
    setUseSavedSignature(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
    setUseSavedSignature(false);
  };

  const drawSavedSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !existingSignatureUrl) return;
    const img = new Image();
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const { width, height } = canvas.getBoundingClientRect();
      const scale = Math.min(width / img.width, height / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (width - drawWidth) / 2;
      const offsetY = (height - drawHeight) / 2;
      context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      setUseSavedSignature(true);
    };
    img.src = existingSignatureUrl;
  };

  useEffect(() => {
    if (!existingSignatureUrl || !useSavedSignature || signatureData) return;
    const raf = requestAnimationFrame(() => drawSavedSignature());
    return () => cancelAnimationFrame(raf);
  }, [existingSignatureUrl, useSavedSignature, signatureData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Firma digitale cliente</p>
          <p className="text-xs text-zinc-500">Disegna la firma per confermare il preventivo.</p>
        </div>
        <button
          type="button"
          onClick={clearSignature}
          className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          Pulisci
        </button>
      </div>
      {existingSignatureUrl ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div>
            Firma salvata in precedenza:
            <a
              href={existingSignatureUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-2 font-semibold underline"
            >
              visualizza
            </a>
          </div>
          {!useSavedSignature ? (
            <button
              type="button"
              onClick={drawSavedSignature}
              className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-900"
            >
              Usa firma depositata
            </button>
          ) : (
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800">
              Firma salvata in uso
            </span>
          )}
        </div>
      ) : null}
      <div className="rounded-xl border border-zinc-200 bg-white p-2">
        <canvas
          ref={canvasRef}
          className={clsx(
            "h-40 w-full touch-none rounded-lg border border-dashed border-zinc-200 bg-zinc-50",
            useSavedSignature && "pointer-events-none opacity-70"
          )}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />
        {useSavedSignature ? (
          <p className="mt-2 text-xs font-semibold text-emerald-700">
            Firma depositata in uso (canvas bloccato).
          </p>
        ) : null}
      </div>
      <input type="hidden" name={name} value={signatureData} readOnly required={required} />
      <input
        type="hidden"
        name="existingQuoteSignatureUrl"
        value={useSavedSignature ? existingSignatureUrl ?? "" : ""}
        readOnly
      />
      {required && !signatureData && !useSavedSignature ? (
        <p className="text-xs font-semibold text-amber-700">Firma obbligatoria prima di salvare.</p>
      ) : null}
    </div>
  );
}

export function QuoteAccordion({ patientId, services, initialQuote, onSave, className, printHref }: Props) {
  const initialItems = useMemo(() => {
    if (initialQuote?.items && initialQuote.items.length) {
      return initialQuote.items.map((item) => ({
        serviceId: item.serviceId ?? "",
        quantity: item.quantity ? String(item.quantity) : "1",
        price: item.price != null ? String(item.price) : "",
      }));
    }
    if (initialQuote?.serviceId) {
      return [
        {
          serviceId: initialQuote.serviceId,
          quantity: initialQuote.quantity ? String(initialQuote.quantity) : "1",
          price: initialQuote.price != null ? String(initialQuote.price) : "",
        },
      ];
    }
    return [
      {
        serviceId: services[0]?.id ?? "",
        quantity: "1",
        price: services[0]?.costBasis != null ? String(services[0].costBasis) : "",
      },
    ];
  }, [initialQuote, services]);

  const [items, setItems] = useState(initialItems);
  const [signatureReady, setSignatureReady] = useState(Boolean(initialQuote?.signatureUrl));

  const updateItem = (index: number, next: Partial<(typeof items)[number]>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
  };

  const addItem = () => {
    const fallbackService = services[0]?.id ?? "";
    setItems((prev) => [
      ...prev,
      {
        serviceId: fallbackService,
        quantity: "1",
        price: fallbackService
          ? String(services.find((service) => service.id === fallbackService)?.costBasis ?? "")
          : "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const itemsWithTotals = useMemo(() => {
    return items.map((item) => {
      const quantityParsed = Number.parseInt(item.quantity, 10);
      const quantityValue = Number.isNaN(quantityParsed) || quantityParsed <= 0 ? 1 : quantityParsed;
      const priceParsed = Number.parseFloat(String(item.price).replace(",", "."));
      const priceValue = Number.isNaN(priceParsed) ? 0 : priceParsed;
      return {
        ...item,
        quantityValue,
        priceValue,
        totalValue: quantityValue * priceValue,
      };
    });
  }, [items]);

  const totalSum = useMemo(
    () => itemsWithTotals.reduce((sum, item) => sum + item.totalValue, 0),
    [itemsWithTotals]
  );

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        itemsWithTotals.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantityValue,
          price: item.priceValue,
        }))
      ),
    [itemsWithTotals]
  );

  return (
    <details
      className={clsx(
        "group rounded-2xl border border-zinc-200 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden",
        className
      )}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-base font-semibold text-zinc-900">
        <span className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-emerald-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 3h6l-1.5 2h-3L9 3Z" />
            <path d="M6 9a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z" />
            <path d="M9 12h6" />
          </svg>
          <span className="uppercase tracking-wide">Preventivo</span>
        </span>
        <svg
          className="h-5 w-5 text-zinc-600 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <form action={onSave} className="space-y-6 p-6">
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="itemsJson" value={itemsJson} readOnly />
        <div className="space-y-4">
          {itemsWithTotals.map((item, index) => (
            <div
              key={`quote-item-${index}`}
              className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr,1fr,1fr,auto]"
            >
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 lg:col-span-1">
                Prestazione
                <select
                  value={item.serviceId}
                  onChange={(event) => {
                    const nextServiceId = event.target.value;
                    const nextService = services.find((service) => service.id === nextServiceId);
                    updateItem(index, {
                      serviceId: nextServiceId,
                      price: item.priceValue === 0 ? String(nextService?.costBasis ?? "") : item.price,
                    });
                  }}
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                >
                  <option value="" disabled>
                    Seleziona servizio
                  </option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Quantità
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, { quantity: event.target.value })}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Prezzo (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(event) => updateItem(index, { price: event.target.value })}
                  className="h-11 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
                Totale (€)
                <input
                  type="text"
                  value={item.totalValue.toFixed(2)}
                  readOnly
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none"
                />
              </label>
              <div className="flex items-end justify-start gap-2">
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 text-lg font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800"
                  aria-label="Aggiungi prestazione"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 text-lg font-semibold text-zinc-600 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Rimuovi prestazione"
                  disabled={items.length === 1}
                >
                  −
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
            Totale preventivo: € {totalSum.toFixed(2)}
          </div>
        </div>

        <SignaturePad
          name="quoteSignatureData"
          required
          existingSignatureUrl={initialQuote?.signatureUrl ?? null}
          onSignatureStateChange={setSignatureReady}
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          {initialQuote?.id && (
            <Link
              href={printHref || `/pazienti/${patientId}/preventivo/${initialQuote.id}`}
              target="_blank"
              className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 px-5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-900"
            >
              Stampa
            </Link>
          )}
          <FormSubmitButton
            disabled={!signatureReady}
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Salva preventivo
          </FormSubmitButton>
        </div>
      </form>
    </details>
  );
}
