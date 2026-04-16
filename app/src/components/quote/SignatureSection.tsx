/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { loadWacomSignatureSdk } from "@/lib/wacom-signature";

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

interface SignaturePadProps {
  name: string;
  required?: boolean;
  existingSignatureUrl?: string | null;
  patientName?: string;
  onSignatureStateChange?: (ready: boolean) => void;
  onDirty?: () => void;
}

export function SignatureSection({
  name,
  required,
  existingSignatureUrl,
  patientName,
  onSignatureStateChange,
  onDirty,
}: SignaturePadProps) {
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
