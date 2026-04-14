/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConflictDialog } from "@/components/conflict-dialog";
import { loadWacomSignatureSdk } from "@/lib/wacom-signature";
import { PrintLinkButton } from "@/components/print-link-button";
import {
  formatDateInDisplayTimeZone,
  formatDateInputValueInTimeZone,
  getBrowserUserDisplayTimeZone,
} from "@/lib/user-display-time-zone";

type ServiceOption = {
  id: string;
  name: string;
  costBasis: number;
};

type QuoteDraft = {
  id?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  serviceDate?: string | null;
  quantity?: number | null;
  price?: number | null;
  total?: number | null;
  signatureUrl?: string | null;
  signedAt?: string | null;
  items?: Array<{
    id?: string | null;
    dentalRecordId?: string | null;
    serviceId?: string | null;
    serviceName?: string | null;
    serviceDate?: string | null;
    quantity?: number | null;
    price?: number | null;
    total?: number | null;
    saldato?: boolean | null;
    treated?: boolean | null;
    tooth?: number | null;
    createdAt?: string | null;
  }>;
};

type SaveState = { savedAt: number };

type Props = {
  patientId: string;
  patientName?: string;
  services: ServiceOption[];
  initialQuote: QuoteDraft | null;
  defaultServiceDate: string;
  printHref?: string | null;
  className?: string;
  onSave: (prevState: SaveState, formData: FormData) => Promise<SaveState>;
};

type Point = { x: number; y: number };
type LoadedWacomSdk = NonNullable<Awaited<ReturnType<typeof loadWacomSignatureSdk>>>;
type WacomSigObject = InstanceType<LoadedWacomSdk["SigObj"]>;
type WacomStuDeviceInstance = { delete?: () => void };
type WacomStuDeviceFactory = LoadedWacomSdk["STUDevice"] & {
  new (device: unknown): WacomStuDeviceInstance;
};
type WacomDialogInstance = InstanceType<LoadedWacomSdk["StuCaptDialog"]> & {
  sigCaptDialog?: {
    getButton: () => number;
    onDown: () => void;
    onMove: () => void;
    onUp: () => void;
    clickButton: () => void;
    clear: () => void;
    cancel: () => void;
    accept: () => void;
    clearTimeOnSurface: () => void;
    startCapture: () => void;
    stopCapture: () => void;
  };
};

function getDefaultServiceDate(value: string | null | undefined, displayTimeZone: string) {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateInputValueInTimeZone(parsed, displayTimeZone);
    }
  }
  return formatDateInputValueInTimeZone(new Date(), displayTimeZone);
}

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

  const getStrokeColor = () => {
    if (typeof window !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "#f4f4f5"; // zinc-100
    }
    return "#0f172a"; // zinc-950
  };

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
      context.strokeStyle = getStrokeColor();
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
    context.strokeStyle = getStrokeColor();
    lastPoint.current = null;
    setHasStroke(false);
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = getPoint(event);
    if (!canvas || !point) return;

    const context = canvas.getContext("2d");
    if (context) {
      context.strokeStyle = getStrokeColor();
    }

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

  const renderWacomSignature = async (sigSDK: LoadedWacomSdk, sigObj: WacomSigObject) => {
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
      getStrokeColor(),
      "transparent",
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

      const stuDevice = new (sigSDK.STUDevice as WacomStuDeviceFactory)(devices[0]);
      const config = new sigSDK.Config();
      config.source.mouse = false;
      config.source.touch = false;
      config.source.pen = false;
      config.source.stu = true;

      const dialog = new sigSDK.StuCaptDialog(stuDevice, config) as WacomDialogInstance;
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
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Firma digitale cliente</p>
          <p className="text-xs text-zinc-500">Acquisisci la firma per confermare il preventivo.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-400">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              isSignatureReady ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
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
              : "border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800"
          }`}
        >
          Tablet
        </button>
        <button
          type="button"
          onClick={captureWithWacom}
          disabled={wacomLoading}
          className="rounded-full border border-emerald-200 dark:border-emerald-900/50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400 transition hover:border-emerald-300 dark:hover:border-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="rounded-full border border-emerald-200 dark:border-emerald-900/50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400 transition hover:border-emerald-300 dark:hover:border-emerald-800"
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
        <div className="h-44 overflow-hidden rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-white dark:bg-zinc-950">
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

      {signatureError ? <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">{signatureError}</p> : null}

      {existingSignatureUrl ? (
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-xs text-emerald-900 dark:text-emerald-200">
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
                className="rounded-full border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 transition hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-300"
              >
                Usa firma depositata
              </button>
            ) : (
              <span className="rounded-full bg-white dark:bg-white/90 px-3 py-1 text-[11px] font-semibold text-emerald-800">
                Firma salvata in uso
              </span>
            )}
          </div>
          {useSavedSignature ? (
            <img
              src={existingSignatureUrl}
              alt="Firma salvata"
              className="mt-2 h-16 rounded border border-emerald-100 dark:border-emerald-900/30 bg-white dark:bg-white/90 object-contain px-2 py-1 shadow-sm"
            />
          ) : null}
        </div>
      ) : null}

      {signatureData ? (
        <div className="rounded-lg border border-emerald-100 dark:border-emerald-900/30 bg-white dark:bg-zinc-950 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Firma acquisita</p>
          <img
            src={signatureData}
            alt="Firma digitale"
            className="mt-2 h-16 rounded border border-emerald-100 dark:border-emerald-900/30 bg-white dark:bg-white/90 object-contain px-2 py-1 shadow-sm"
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
  defaultServiceDate,
  onSave,
  className,
  printHref,
}: Props) {
  const router = useRouter();
  const [displayTimeZone, setDisplayTimeZone] = useState("UTC");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setDisplayTimeZone(getBrowserUserDisplayTimeZone());
    setIsMounted(true);
  }, []);

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
        id: item.id ?? "",
        dentalRecordId: item.dentalRecordId ?? null,
        serviceId: item.serviceId ?? "",
        serviceDate: getDefaultServiceDate(
          item.serviceDate ?? initialQuote.serviceDate ?? defaultServiceDate,
          displayTimeZone
        ),
        quantity: item.quantity ? String(item.quantity) : "1",
        price: item.price != null ? String(item.price) : "",
        treated: Boolean(item.treated),
        tooth: item.tooth ?? null,
        createdAt: item.createdAt ?? null,
      }));
    }
    if (initialQuote?.serviceId) {
      return [
        {
          id: "",
          dentalRecordId: null,
          serviceId: initialQuote.serviceId,
          serviceDate: getDefaultServiceDate(initialQuote.serviceDate ?? defaultServiceDate, displayTimeZone),
          quantity: initialQuote.quantity ? String(initialQuote.quantity) : "1",
          price: initialQuote.price != null ? String(initialQuote.price) : "",
          treated: false,
          tooth: null,
          createdAt: null,
        },
      ];
    }
    return [];
  }, [defaultServiceDate, displayTimeZone, initialQuote]);

  const [items, setItems] = useState(initialItems);
  const [signatureReady, setSignatureReady] = useState(Boolean(initialQuote?.signatureUrl));
  const [prevInitialQuote, setPrevInitialQuote] = useState(initialQuote);
  const [prevDisplayTimeZone, setPrevDisplayTimeZone] = useState(displayTimeZone);
  const [removeDialog, setRemoveDialog] = useState<{ index: number; type: "warning" | "confirm" } | null>(null);

  if (initialQuote !== prevInitialQuote || displayTimeZone !== prevDisplayTimeZone) {
    setPrevInitialQuote(initialQuote);
    setPrevDisplayTimeZone(displayTimeZone);
    setItems(initialItems);
    setSignatureReady(Boolean(initialQuote?.signatureUrl));
  }
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const dirtyVersionRef = useRef(0);
  const [, formAction] = useActionState(onSave, { savedAt: 0 });
  const isDirty = dirtyVersion > savedVersion;
  const markDirty = () =>
    setDirtyVersion((prev) => {
      const next = prev + 1;
      dirtyVersionRef.current = next;
      return next;
    });
  const handleFormAction = async (formData: FormData) => {
    await formAction(formData);
    setSavedVersion(dirtyVersionRef.current);
    router.refresh();
  };

  const updateItem = (index: number, next: Partial<(typeof items)[number]>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...next } : item)));
    markDirty();
  };

  const addItem = () => {
    const fallbackService = sortedServices[0]?.id ?? "";
    setItems((prev) => [
      ...prev,
      {
        id: "",
        dentalRecordId: null,
        serviceId: fallbackService,
        serviceDate: defaultServiceDate,
        quantity: "1",
        price: fallbackService
          ? String(sortedServices.find((service) => service.id === fallbackService)?.costBasis ?? "")
          : "",
        treated: false,
        tooth: null,
        createdAt: null,
      },
    ]);
    markDirty();
  };

  const removeItem = (index: number) => {
    const item = items[index];
    if (item.dentalRecordId || item.treated) {
      setRemoveDialog({ index, type: "warning" });
      return;
    }

    setRemoveDialog({ index, type: "confirm" });
  };

  const confirmRemove = (index: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    markDirty();
    setRemoveDialog(null);
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
        serviceDate: item.serviceDate,
        treated: item.treated,
        tooth: item.tooth,
        createdAt: item.createdAt ?? null,
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
          id: item.id || undefined,
          dentalRecordId: item.dentalRecordId,
          serviceId: item.serviceId,
          serviceDate: item.serviceDate,
          quantity: item.quantityValue,
          price: item.priceValue,
          tooth: item.tooth,
        }))
      ),
    [itemsWithTotals]
  );

  const formatItemDate = (value?: string | null) => {
    if (!isMounted) return null;
    if (!value) return "Da salvare";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Da salvare";
    return formatDateInDisplayTimeZone(
      date,
      {
        dateStyle: "short",
        timeStyle: "short",
      },
      displayTimeZone
    );
  };

  return (
    <details
      open
      className={clsx(
        "group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm [&_summary::-webkit-details-marker]:hidden",
        className
      )}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
        <span className="flex items-center gap-3">
          <svg
            className="h-8 w-8 text-emerald-600 dark:text-emerald-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1 .5-1.5 1-2V5h-2Z" />
            <path d="M7 12h.01" />
            <path d="M11 20h2" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 uppercase">
              DETTAGLIO FINANZIARIO
            </h2>
          </div>
        </span>
        <div className="flex items-center gap-2">
          {initialQuote?.id ? (
            isDirty ? (
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700"
                title="Salva prima di stampare"
                aria-label="Salva prima di stampare"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9V4h12v5" />
                  <path d="M6 18h12v2H6z" />
                  <path d="M6 14h12v4H6z" />
                  <path d="M4 10h16a2 2 0 0 1 2 2v3h-4" />
                  <path d="M2 15h4" />
                </svg>
              </span>
            ) : (
              <PrintLinkButton
                href={printHref || `/pazienti/${patientId}/preventivo/${initialQuote.id}`}
                label="Stampa preventivo"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 transition hover:border-emerald-200 dark:hover:border-emerald-800 hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9V4h12v5" />
                  <path d="M6 18h12v2H6z" />
                  <path d="M6 14h12v4H6z" />
                  <path d="M4 10h16a2 2 0 0 1 2 2v3h-4" />
                  <path d="M2 15h4" />
                </svg>
              </PrintLinkButton>
            )
          ) : null}
          <svg
            className="h-5 w-5 text-zinc-600 dark:text-zinc-400 transition-transform duration-200 group-open:rotate-180"
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
        </div>
      </summary>
      <form action={handleFormAction} className="space-y-6 p-6">
        <input type="hidden" name="patientId" value={patientId} />
        <input type="hidden" name="quoteId" value={initialQuote?.id ?? ""} />
        <input type="hidden" name="itemsJson" value={itemsJson} readOnly />
        <div className="space-y-4">
          {itemsWithTotals.map((item, index) => (
            <div
              key={`quote-item-${index}`}
              className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 sm:grid-cols-2 lg:grid-cols-[2fr,1fr,1fr,1fr,1.2fr,auto]"
            >
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-300 lg:col-span-1">
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
                  className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20"
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
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-300">
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
                  className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-300">
                Prezzo (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price}
                  onChange={(event) => updateItem(index, { price: event.target.value })}
                  className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-300">
                Totale (€)
                <input
                  type="text"
                  value={item.totalValue.toFixed(2)}
                  readOnly
                  className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-300">
                Data prestazione
                <input
                  type="date"
                  value={item.serviceDate}
                  onChange={(event) => updateItem(index, { serviceDate: event.target.value })}
                  className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/20"
                  required
                />
              </label>
              <div className="flex items-end justify-start gap-2">
                {!(item.treated || item.dentalRecordId) ? (
                  <>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900 text-lg font-semibold text-emerald-700 dark:text-emerald-500 transition hover:border-emerald-300 dark:hover:border-emerald-800 hover:text-emerald-800 dark:hover:text-emerald-400"
                      aria-label="Aggiungi prestazione"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-800 text-lg font-semibold text-zinc-600 dark:text-zinc-400 transition hover:border-rose-200 dark:hover:border-rose-900/50 hover:text-rose-600 dark:hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Rimuovi prestazione"
                      disabled={items.length === 1}
                    >
                      −
                    </button>
                  </>
                ) : (
                  <div className="h-11 flex items-center px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-600 italic">
                    Collegato al diario
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400 sm:col-span-2 lg:col-span-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {(() => {
                    const d = formatItemDate(item.createdAt);
                    return d ? <span>Aggiunto: {d}</span> : null;
                  })()}
                  {item.tooth != null ? (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span>Dente: {item.tooth === 0 ? "Bocca intera" : item.tooth}</span>
                    </>
                  ) : null}
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <div className="flex items-center gap-1.5">
                    <span>Stato:</span>
                    {item.treated === false ? (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/30">
                        In corso
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30">
                        Trattato
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-start">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 transition hover:border-emerald-300 hover:bg-emerald-100 dark:hover:border-emerald-800 dark:hover:bg-emerald-900/40"
            >
              + Aggiungi prestazione
            </button>
          </div>

          {itemsWithTotals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p>Nessuna prestazione nel preventivo.</p>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-900 px-4 text-sm font-semibold text-emerald-700 dark:text-emerald-500 transition hover:border-emerald-300 dark:hover:border-emerald-800 hover:text-emerald-800 dark:hover:text-emerald-400"
                >
                  Aggiungi prestazione
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <div className="rounded-full border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <span>Totale:</span>
            <span className="text-lg font-mono">€ {totalSum.toFixed(2)}</span>
          </div>
        </div>

        <SignaturePad
          name="quoteSignatureData"
          required
          existingSignatureUrl={initialQuote?.signatureUrl ?? null}
          patientName={patientName}
          onSignatureStateChange={setSignatureReady}
          onDirty={markDirty}
        />

        <div className="flex flex-wrap items-center justify-end gap-3">
          <FormSubmitButton
            disabled={!signatureReady || items.length === 0}
            className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            Aggiorna contabilità
          </FormSubmitButton>
        </div>
      </form>

      {removeDialog && (
        <ConflictDialog
          message={
            removeDialog.type === "warning"
              ? "Questa prestazione è collegata al diario clinico. Per rimuoverla, elimina la prestazione corrispondente dal diario clinico."
              : "Sei sicuro di voler rimuovere questa prestazione dal preventivo?"
          }
          onClose={() => setRemoveDialog(null)}
          onProceed={removeDialog.type === "confirm" ? () => confirmRemove(removeDialog.index) : undefined}
          proceedLabel="Rimuovi"
          actionLabel="Annulla"
        />
      )}
    </details>
  );
}
