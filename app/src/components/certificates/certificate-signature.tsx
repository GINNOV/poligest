/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWacomCaptureConfig,
  ensureWacomDialogStub,
  prepareWacomCaptureViewport,
} from "@/lib/wacom-capture";
import { fetchWacomLicenseFromApi } from "@/lib/wacom-license-client";
import { loadWacomSignatureSdk } from "@/lib/wacom-signature";

type Point = { x: number; y: number };
type LoadedWacomSdk = NonNullable<Awaited<ReturnType<typeof loadWacomSignatureSdk>>>;
type WacomStuDeviceInstance = { delete?: () => void };
type WacomStuDeviceFactory = LoadedWacomSdk["STUDevice"] & {
  new (device: unknown): WacomStuDeviceInstance;
};
type WacomDialogInstance = InstanceType<LoadedWacomSdk["StuCaptDialog"]>;

interface CertificateSignatureProps {
  name?: string;
  doctorName?: string;
  initialSignatureUrl?: string | null;
  onSignatureChange?: (dataUrl: string | null) => void;
}

export function CertificateSignature({
  name = "signatureData",
  doctorName,
  initialSignatureUrl,
  onSignatureChange,
}: CertificateSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [signatureData, setSignatureData] = useState<string>(initialSignatureUrl || "");
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [wacomLoading, setWacomLoading] = useState(false);
  const [useCanvas, setUseCanvas] = useState(!initialSignatureUrl);
  const [hasStroke, setHasStroke] = useState(false);

  const isSignatureReady = Boolean(signatureData);

  const getStrokeColor = () => {
    if (typeof window !== "undefined" && document.documentElement.classList.contains("dark")) {
      return "#f4f4f5";
    }
    return "#0f172a";
  };

  const resizeCanvas = useCallback(() => {
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
  }, []);

  useEffect(() => {
    if (useCanvas) {
      resizeCanvas();
      const handleResize = () => resizeCanvas();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [useCanvas, resizeCanvas]);

  useEffect(() => {
    onSignatureChange?.(signatureData || null);
  }, [signatureData, onSignatureChange]);

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
    // Automatically save snapshot on stroke completion
    const canvas = canvasRef.current;
    if (canvas && hasStroke) {
      const dataUrl = canvas.toDataURL("image/png");
      setSignatureData(dataUrl);
      setSignatureError(null);
    }
  };

  const captureWithWacom = async () => {
    if (wacomLoading) return;
    setSignatureError(null);
    setWacomLoading(true);
    const restoreViewport = prepareWacomCaptureViewport();
    try {
      const sigSDK = await loadWacomSignatureSdk();
      if (!sigSDK) {
        throw new Error(
          "SDK Wacom non disponibile. Verifica la presenza di signature_sdk in /public/wacom."
        );
      }
      if (!sigSDK.STUDevice.isHIDSupported()) {
        throw new Error("Il browser non supporta WebHID per il dispositivo STU.");
      }

      const license = await fetchWacomLicenseFromApi();
      if (!license) {
        throw new Error("Licenza Wacom mancante. Configurala in Amministrazione > Integrazione Wacom.");
      }

      const sigObj = new sigSDK.SigObj();
      await sigObj.setLicence(license.licenseKey, license.licenseSecret);

      const devices = await sigSDK.STUDevice.requestDevices();
      if (devices.length === 0) {
        throw new Error("Nessun dispositivo STU selezionato.");
      }

      const stuDevice = new (sigSDK.STUDevice as WacomStuDeviceFactory)(devices[0]);
      const config = createWacomCaptureConfig(sigSDK);
      const dialog = new sigSDK.StuCaptDialog(stuDevice, config) as WacomDialogInstance;
      ensureWacomDialogStub(dialog);

      dialog.addEventListener(sigSDK.EventType.OK, async () => {
        const width = Math.trunc((96 * sigObj.getWidth(false) * 0.01) / 25.4);
        const height = Math.trunc((96 * sigObj.getHeight(false) * 0.01) / 25.4);
        const scale = Math.min(360 / width, 220 / height);
        let renderWidth = Math.trunc(width * scale);
        const renderHeight = Math.trunc(height * scale);
        if (renderWidth % 4 !== 0) renderWidth += renderWidth % 4;

        const image = await sigObj.renderBitmap(
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

        setSignatureData(image);
        setSignatureError(null);
        dialog.delete?.();
        stuDevice.delete?.();
        restoreViewport();
      });

      dialog.addEventListener(sigSDK.EventType.CANCEL, () => {
        dialog.delete?.();
        stuDevice.delete?.();
        restoreViewport();
      });

      await dialog.open(
        sigObj,
        doctorName ?? "Medico",
        "Certificato Medico",
        null,
        sigSDK.KeyType.SHA512,
        null
      );
    } catch (error) {
      restoreViewport();
      setSignatureError(error instanceof Error ? error.message : "Errore acquisizione firma Wacom.");
    } finally {
      setWacomLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Firma Digitale Medico / Struttura
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Apponi la firma digitale mediante schermo touch/mouse o tavoletta Wacom.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-400">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              isSignatureReady ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          />
          {isSignatureReady ? "Firma acquisita" : "Firma non ancora presente"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setUseCanvas(true);
            setTimeout(resizeCanvas, 50);
          }}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            useCanvas
              ? "bg-emerald-700 text-white"
              : "border border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          Disegna firma (Tablet/Touch)
        </button>
        <button
          type="button"
          onClick={captureWithWacom}
          disabled={wacomLoading}
          className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:border-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {wacomLoading ? "Connessione Wacom..." : "Tavoletta Wacom"}
        </button>
        {useCanvas ? (
          <button
            type="button"
            onClick={() => {
              clearCanvas();
              setSignatureData("");
              setSignatureError(null);
            }}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
          >
            Cancella
          </button>
        ) : null}
      </div>

      {useCanvas ? (
        <div className="h-36 overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
          <canvas
            ref={canvasRef}
            className="h-full w-full touch-none cursor-crosshair"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
          />
        </div>
      ) : null}

      {signatureError ? (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">{signatureError}</p>
      ) : null}

      {signatureData && !useCanvas ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Firma memorizzata
          </p>
          <img
            src={signatureData}
            alt="Firma"
            className="mt-2 h-14 rounded border border-zinc-200 bg-white object-contain px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      ) : null}

      <input type="hidden" name={name} value={signatureData} readOnly />
    </div>
  );
}
