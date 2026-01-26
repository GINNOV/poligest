"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AvatarCameraCaptureProps = {
  uploadAvatar: (formData: FormData) => Promise<void>;
  maxBytes: number;
};

export function AvatarCameraCapture({ uploadAvatar, maxBytes }: AvatarCameraCaptureProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStreaming(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossibile accedere alla fotocamera.";
      setError(message);
      stopCamera();
    }
  }, [stopCamera]);

  const runCountdown = useCallback(() => {
    setCountdown(3);
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
    }
    countdownRef.current = window.setInterval(() => {
      setCountdown((current) => {
        if (current === null) return null;
        if (current <= 1) {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });
    if (!blob) {
      throw new Error("Impossibile scattare la foto.");
    }
    if (blob.size > maxBytes) {
      throw new Error("Immagine troppo grande (max 2MB).");
    }
    setPreviewBlob(blob);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
  }, [maxBytes, previewUrl]);

  const handleCapture = useCallback(async () => {
    if (!isStreaming || isBusy) return;
    setIsBusy(true);
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewBlob(null);
    }
    runCountdown();
    await new Promise((resolve) => setTimeout(resolve, 3100));
    try {
      await capturePhoto();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante la cattura.";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }, [capturePhoto, isBusy, isStreaming, previewUrl, runCountdown]);

  const handleConfirm = useCallback(async () => {
    if (!previewBlob || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("avatar", new File([previewBlob], "avatar.jpg", { type: previewBlob.type }));
      await uploadAvatar(formData);
      router.refresh();
      setPreviewBlob(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore durante il salvataggio.";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, previewBlob, previewUrl, router, uploadAvatar]);

  const handleResetPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, stopCamera]);

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
      <div className="text-sm font-semibold text-emerald-900">Scatta un avatar con la webcam</div>
      <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-white">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Anteprima avatar" className="h-48 w-full object-cover" />
        ) : (
          <video ref={videoRef} className="h-48 w-full object-cover" playsInline muted />
        )}
        {countdown !== null && countdown > 0 ? (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-4xl font-semibold text-white">
            {countdown}
          </div>
        ) : null}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={isStreaming ? stopCamera : startCamera}
          className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300"
        >
          {isStreaming ? "Chiudi fotocamera" : "Apri fotocamera"}
        </button>
        <button
          type="button"
          onClick={handleCapture}
          disabled={!isStreaming || isBusy}
          className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          Scatta foto (3-2-1)
        </button>
        <button
          type="button"
          onClick={handleResetPreview}
          disabled={!previewUrl || isBusy}
          className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:text-emerald-300"
        >
          Scatta di nuovo
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!previewBlob || isBusy}
          className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          Usa questa foto
        </button>
      </div>
    </div>
  );
}
