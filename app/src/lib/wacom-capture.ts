import type { loadWacomSignatureSdk } from "@/lib/wacom-signature";

export type LoadedWacomSdk = NonNullable<Awaited<ReturnType<typeof loadWacomSignatureSdk>>>;

export const STU_430_ASPECT = 320 / 200;

export function computeWacomDialogSize(viewport?: { width: number; height: number }) {
  const widthLimit = viewport?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1024);
  const heightLimit = viewport?.height ?? (typeof window !== "undefined" ? window.innerHeight : 768);

  const maxWidth = Math.min(widthLimit - 48, 560);
  const maxHeight = Math.min(heightLimit - 120, 420);

  let width = maxWidth;
  let height = Math.round(width / STU_430_ASPECT);
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * STU_430_ASPECT);
  }

  return { width, height };
}

export function createWacomCaptureConfig(sigSDK: LoadedWacomSdk) {
  const config = new sigSDK.Config();
  const { width, height } = computeWacomDialogSize();

  config.source.mouse = false;
  config.source.touch = false;
  config.source.pen = false;
  config.source.stu = true;
  config.centered = true;
  config.modal = true;
  config.fitMode = sigSDK.FIT_MODE.FIXED;
  config.width = width;
  config.height = height;

  return config;
}

export function prepareWacomCaptureViewport() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const previousOverflow = document.body.style.overflow;

  document.body.style.overflow = "hidden";
  window.scrollTo(0, 0);

  return () => {
    document.body.style.overflow = previousOverflow;
    window.scrollTo(scrollX, scrollY);
  };
}

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

export function ensureWacomDialogStub(dialog: WacomDialogInstance) {
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
}