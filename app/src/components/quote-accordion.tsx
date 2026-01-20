"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { FormSubmitButton } from "@/components/form-submit-button";
import { loadWacomSignatureSdk } from "@/lib/wacom-signature";

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
    saldato?: boolean | null;
    createdAt?: string | null;
  }>;
};

type SaveState = { savedAt: number };

type Props = {
  patientId: string;
  patientName?: string;
  services: ServiceOption[];
  initialQuote: QuoteDraft | null;
  printHref?: string | null;
  className?: string;
  onSave: (prevState: SaveState, formData: FormData) => Promise<SaveState>;
};

type Point = { x: number; y: number };

function SignaturePad({
  name,
  required,
  existingSignatureUrl,
  patientName,
  onSignatureStateChange,
  onDirty,
}: {
  name: string;
  required?: boolean;
  existingSignatureUrl?: string | null;
  patientName?: string;
  onSignatureStateChange?: (ready: boolean) => void;
  onDirty?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [signatureData, setSignatureData] = useState<string>("");
  const [useSavedSignature, setUseSavedSignature] = useState(Boolean(existingSignatureUrl));
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [wacomLoading, setWacomLoading] = useState(false);
  const [useTabletSignature, setUseTabletSignature] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const isSignatureReady = Boolean(signatureData || (existingSignatureUrl && useSavedSignature));

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    const nextWidth = Math.round(width * ratio);
    const nextHeight = Math.round(height * ratio);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineWidth = 2.4;
      context.lineCap = "round";
      context.strokeStyle = "#0f172a";
    }
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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.strokeStyle = "#0f172a";
    lastPoint.current = null;
    setHasStroke(false);
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = getPoint(event);
    if (!canvas || !point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPoint.current = point;
    setHasStroke(true);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const point = getPoint(event);
    if (!canvas || !context || !point || !lastPoint.current) return;
    context.beginPath();
    context.moveTo(lastPoint.current.x, lastPoint.current.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint.current = point;
  };

  const stopDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    lastPoint.current = null;
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke) {
      setSignatureError("Firma obbligatoria. Disegna la firma e riprova.");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureData(dataUrl);
    setUseSavedSignature(false);
    setSignatureError(null);
    onDirty?.();
  };

  const renderWacomSignature = async (sigSDK: Awaited<ReturnType<typeof loadWacomSignatureSdk>>, sigObj: any) => {
    if (!sigSDK) throw new Error("SDK Wacom non disponibile.");
    const width = Math.trunc((96 * sigObj.getWidth(false) * 0.01) / 25.4);
    const height = Math.trunc((96 * sigObj.getHeight(false) * 0.01) / 25.4);
    const scale = Math.min(360 / width, 220 / height);
    let renderWidth = Math.trunc(width * scale);
    const renderHeight = Math.trunc(height * scale);
    if (renderWidth % 4 !== 0) {
      renderWidth += renderWidth % 4;
    }
    return sigObj.renderBitmap(
      renderWidth,
      renderHeight,
      "image/png",
      4,
      "#0f172a",
      "white",
      0,
      0,
      sigSDK.RenderFlags.RenderEncodeData.value
    );
  };

  const captureWithWacom = async () => {
    if (wacomLoading) return;
    setSignatureError(null);
    setWacomLoading(true);
    try {
      const sigSDK = await loadWacomSignatureSdk();
      if (!sigSDK) {
        throw new Error(
          "SDK Wacom non disponibile. Installa il pacchetto Wacom e copia signature_sdk(.wasm/.js) in /public/wacom (npm run wacom:sync)."
        );
      }
      if (!sigSDK.STUDevice.isHIDSupported()) {
        throw new Error("Il browser non supporta WebHID per il tablet STU.");
      }

      const key = process.env.NEXT_PUBLIC_WACOM_SIGNATURE_KEY ?? "";
      const secret = process.env.NEXT_PUBLIC_WACOM_SIGNATURE_SECRET ?? "";
      if (!key || !secret) {
        throw new Error("Licenza Wacom mancante. Configura le chiavi NEXT_PUBLIC_WACOM_SIGNATURE_*.");
      }

      const sigObj = new sigSDK.SigObj();
      await sigObj.setLicence(key, secret);

      const devices = await sigSDK.STUDevice.requestDevices();
      if (devices.length === 0) {
        throw new Error("Nessun dispositivo STU selezionato.");
      }

      const stuDevice = new (sigSDK as any).STUDevice(devices[0]);
      const config = new sigSDK.Config();
      config.source.mouse = false;
      config.source.touch = false;
      config.source.pen = false;
      config.source.stu = true;

      const dialog = new sigSDK.StuCaptDialog(stuDevice, config) as any;
      if (!dialog.sigCaptDialog) {
        dialog.sigCaptDialog = {
          getButton: () => -1,
          onDown: () => {},
          onMove: () => {},
          onUp: () => {},
          clickButton: () => {},
          clear: () => {},
          cancel: () => {},
          accept: () => {},
          clearTimeOnSurface: () => {},
          startCapture: () => {},
          stopCapture: () => {},
        };
      }
      dialog.addEventListener(sigSDK.EventType.OK, async () => {
        const image = await renderWacomSignature(sigSDK, sigObj);
        setSignatureData(image);
        setUseSavedSignature(false);
        setUseTabletSignature(false);
        setSignatureError(null);
        onDirty?.();
        dialog.delete?.();
        stuDevice.delete?.();
      });
      dialog.addEventListener(sigSDK.EventType.CANCEL, () => {
        dialog.delete?.();
        stuDevice.delete?.();
      });

      const wacomTitle = "Preventivo";
      await dialog.open(sigObj, patientName ?? "Paziente", wacomTitle, null, sigSDK.KeyType.SHA512, null);
    } catch (error) {
      setSignatureError(error instanceof Error ? error.message : "Errore acquisizione firma Wacom.");
    } finally {
      setWacomLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Firma digitale cliente</p>
          <p className="text-xs text-zinc-500">Acquisisci la firma per confermare il preventivo.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              isSignatureReady ? "bg-emerald-500" : "bg-zinc-300"
            }`}
          />
          {isSignatureReady ? "Firma digitale acquisita" : "Firma digitale mancante"}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setUseTabletSignature((prev) => !prev);
            setSignatureError(null);
            if (!useTabletSignature) {
              clearCanvas();
              setHasStroke(false);
              setTimeout(resizeCanvas, 50);
            }
          }}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            useTabletSignature
              ? "bg-emerald-700 text-white"
              : "border border-emerald-200 text-emerald-800 hover:border-emerald-300"
          }`}
        >
          Tablet
        </button>
        <button
          type="button"
          onClick={captureWithWacom}
          disabled={wacomLoading}
          className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {wacomLoading ? "Collego Wacom..." : "Wacom"}
        </button>
        {useTabletSignature ? (
          <button
            type="button"
            onClick={() => {
              clearCanvas();
              setSignatureData("");
              setUseSavedSignature(false);
              setSignatureError(null);
              onDirty?.();
            }}
            className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300"
          >
            Cancella
          </button>
        ) : null}
        {useTabletSignature ? (
          <button
            type="button"
            onClick={saveSignature}
            disabled={!hasStroke}
            className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Conferma firma
          </button>
        ) : null}
      </div>

      {useTabletSignature ? (
        <div className="h-44 overflow-hidden rounded-lg border border-emerald-200 bg-white">
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
          />
        </div>
      ) : null}

      {signatureError ? <p className="text-xs font-semibold text-amber-700">{signatureError}</p> : null}

      {existingSignatureUrl ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Firma salvata in precedenza.</span>
            {!useSavedSignature ? (
              <button
                type="button"
                onClick={() => {
                  setUseSavedSignature(true);
                  setSignatureData("");
                  setSignatureError(null);
                  onDirty?.();
                }}
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
          {useSavedSignature ? (
            <img
              src={existingSignatureUrl}
              alt="Firma salvata"
              className="mt-2 h-16 rounded border border-emerald-100 bg-white object-contain px-2 py-1 shadow-sm"
            />
          ) : null}
        </div>
      ) : null}

      {signatureData ? (
        <div className="rounded-lg border border-emerald-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Firma acquisita</p>
          <img
            src={signatureData}
            alt="Firma digitale"
            className="mt-2 h-16 rounded border border-emerald-100 bg-white object-contain px-2 py-1 shadow-sm"
          />
        </div>
      ) : null}

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

export function QuoteAccordion({
  patientId,
  patientName,
  services,
  initialQuote,
  onSave,
  className,
  printHref,
}: Props) {
  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) =>
        a.name.localeCompare(b.name, "it", { sensitivity: "base" })
      ),
    [services]
  );

  const initialItems = useMemo(() => {
    if (initialQuote?.items && initialQuote.items.length) {
      return initialQuote.items.map((item) => ({
        serviceId: item.serviceId ?? "",
        quantity: item.quantity ? String(item.quantity) : "1",
        price: item.price != null ? String(item.price) : "",
        saldato: Boolean(item.saldato),
        createdAt: item.createdAt ?? null,
      }));
    }
    if (initialQuote?.serviceId) {
      return [
        {
          serviceId: initialQuote.serviceId,
          quantity: initialQuote.quantity ? String(initialQuote.quantity) : "1",
          price: initialQuote.price != null ? String(initialQuote.price) : "",
          saldato: false,
          createdAt: null,
        },
      ];
    }
    return [
      {
        serviceId: sortedServices[0]?.id ?? "",
        quantity: "1",
        price: sortedServices[0]?.costBasis != null ? String(sortedServices[0].costBasis) : "",
        saldato: false,
        createdAt: null,
      },
    ];
  }, [initialQuote, sortedServices]);

  const [items, setItems] = useState(initialItems);
  const [signatureReady, setSignatureReady] = useState(Boolean(initialQuote?.signatureUrl));
  const [isDirty, setIsDirty] = useState(false);
  const [saveState, formAction] = useActionState(onSave, { savedAt: 0 });
  useEffect(() => {
    if (saveState.savedAt) {
      setIsDirty(false);
    }
  }, [saveState.savedAt]);

  const updateItem = (index: number, next: Partial<(typeof items)[number]>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
    setIsDirty(true);
  };

  const addItem = () => {
    const fallbackService = sortedServices[0]?.id ?? "";
    setItems((prev) => [
      ...prev,
      {
        serviceId: fallbackService,
        quantity: "1",
        price: fallbackService
          ? String(sortedServices.find((service) => service.id === fallbackService)?.costBasis ?? "")
          : "",
        saldato: false,
        createdAt: null,
      },
    ]);
    setIsDirty(true);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    setIsDirty(true);
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
        saldato: Boolean(item.saldato),
        createdAt: item.createdAt ?? null,
      };
    });
  }, [items]);

  const totalSum = useMemo(
    () => itemsWithTotals.reduce((sum, item) => sum + (item.saldato ? 0 : item.totalValue), 0),
    [itemsWithTotals]
  );

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        itemsWithTotals.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantityValue,
          price: item.priceValue,
          saldato: item.saldato,
        }))
      ),
    [itemsWithTotals]
  );

  const formatItemDate = (value?: string | null) => {
    if (!value) return "Da salvare";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Da salvare";
    return date.toLocaleString("it-IT", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Rome",
    });
  };

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
      <form action={formAction} className="space-y-6 p-6">
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
                    const nextService = sortedServices.find((service) => service.id === nextServiceId);
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
                  {sortedServices.map((service) => (
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={item.quantity}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/\D+/g, "");
                    updateItem(index, { quantity: nextValue });
                  }}
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
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 sm:col-span-2 lg:col-span-5">
                <span>Aggiunto: {formatItemDate(item.createdAt)}</span>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
                  <input
                    type="checkbox"
                    checked={item.saldato}
                    onChange={(event) => updateItem(index, { saldato: event.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-200"
                  />
                  Saldato
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
            Totale da saldare: € {totalSum.toFixed(2)}
          </div>
        </div>

        <SignaturePad
          name="quoteSignatureData"
          required
          existingSignatureUrl={initialQuote?.signatureUrl ?? null}
          patientName={patientName}
          onSignatureStateChange={setSignatureReady}
          onDirty={() => setIsDirty(true)}
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          {initialQuote?.id && (
            isDirty ? (
              <span className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 px-5 text-sm font-semibold text-zinc-400">
                Stampa
              </span>
            ) : (
              <Link
                href={printHref || `/pazienti/${patientId}/preventivo/${initialQuote.id}`}
                target="_blank"
                className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 px-5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:text-emerald-900"
              >
                Stampa
              </Link>
            )
          )}
          <FormSubmitButton
            disabled={!signatureReady}
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Aggiorna preventivo
          </FormSubmitButton>
        </div>
      </form>
    </details>
  );
}
