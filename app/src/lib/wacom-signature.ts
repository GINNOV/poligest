type WacomSigSDK = {
  VERSION: string;
  SigObj: new () => {
    setLicence: (key: string, secret: string) => Promise<void>;
    getWidth: (useEncrypted: boolean) => number;
    getHeight: (useEncrypted: boolean) => number;
    renderBitmap: (
      width: number,
      height: number,
      mime: string,
      padding: number,
      inkColor: string,
      backgroundColor: string,
      x: number,
      y: number,
      flags: number
    ) => Promise<string>;
  };
  Config: new () => {
    source: { mouse: boolean; touch: boolean; pen: boolean; stu: boolean };
  };
  STUDevice: {
    isHIDSupported: () => boolean;
    requestDevices: () => Promise<unknown[]>;
  };
  StuCaptDialog: new (device: unknown, config: unknown) => {
    addEventListener: (eventType: unknown, handler: () => void) => void;
    open: (
      sigObj: unknown,
      signatory: string,
      reason: string,
      field: unknown,
      keyType: unknown,
      hash: unknown
    ) => Promise<void>;
    delete?: () => void;
  };
  EventType: { OK: unknown; CANCEL: unknown };
  KeyType: { SHA512: unknown };
  RenderFlags: { RenderEncodeData: { value: number } };
};

declare global {
  interface Window {
    __WACOM_SIG_SDK__?: WacomSigSDK;
  }
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Script load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Script load failed"));
    document.head.appendChild(script);
  });

export async function loadWacomSignatureSdk(): Promise<WacomSigSDK | null> {
  if (typeof window === "undefined") return null;
  if (window.__WACOM_SIG_SDK__) return window.__WACOM_SIG_SDK__;

  try {
    await loadScript("/wacom/signature_sdk.js");
    const SigSDK = (window as unknown as { SigSDK?: new () => Promise<WacomSigSDK> }).SigSDK;
    if (!SigSDK) return null;
    const sdk = await new SigSDK();
    window.__WACOM_SIG_SDK__ = sdk;
    return sdk;
  } catch {
    return null;
  }
}
