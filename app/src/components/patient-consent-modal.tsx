"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FormSubmitButton } from "@/components/form-submit-button";
import { loadWacomSignatureSdk } from "@/lib/wacom-signature";

type Props = {
  content: string;
  fiscalCode?: string;
  doctors?: { id: string; fullName: string }[];
};

type Page = string[];

const renderInline = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((segment, idx) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-zinc-900">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{segment}</span>;
  });

const renderMarkdown = (markdown: string) => {
  const lines = markdown.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];

  const flushList = () => {
    if (list.length > 0) {
      nodes.push(
        <ul key={`list-${nodes.length}`} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-zinc-800">
          {list}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith("# ")) {
      flushList();
      nodes.push(
        <h3 key={`h1-${idx}`} className="text-base font-semibold text-zinc-900">
          {line.replace(/^#\s+/, "")}
        </h3>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h4 key={`h2-${idx}`} className="text-sm font-semibold text-zinc-900">
          {line.replace(/^##\s+/, "")}
        </h4>,
      );
      return;
    }

    if (line.startsWith("* ")) {
      list.push(
        <li key={`li-${idx}`} className="text-sm leading-relaxed text-zinc-800">
          {renderInline(line.replace(/^\*\s+/, ""))}
        </li>,
      );
      return;
    }

    flushList();
    nodes.push(
      <p key={`p-${idx}`} className="text-sm leading-relaxed text-zinc-800">
        {renderInline(line)}
      </p>,
    );
  });

  flushList();
  return nodes;
};

const chunkContent = (text: string): Page[] => {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const pages: Page[] = [];
  let current: string[] = [];
  let length = 0;

  paragraphs.forEach((paragraph) => {
    const paragraphLength = paragraph.length;
    if (length + paragraphLength > 1200 && current.length > 0) {
      pages.push(current);
      current = [];
      length = 0;
    }
    current.push(paragraph);
    length += paragraphLength;
  });

  if (current.length > 0) {
    pages.push(current);
  }

  return pages.length > 0 ? pages : [text.split("\n")];
};

export function PatientConsentSection({ content, fiscalCode: fiscalCodeProp, doctors = [] }: Props) {
  const [patientName, setPatientName] = useState("Paziente");
  const [fiscalCode, setFiscalCode] = useState(fiscalCodeProp ?? "");
  const normalizedContent = useMemo(
    () =>
      content
        .replace(/%PATIENT_NAME_HERE%/g, patientName.trim() || "Paziente")
        .replace(/%CODICE_FISCALE%/g, fiscalCode.trim() || "—"),
    [content, fiscalCode, patientName],
  );
  const pages = useMemo(() => chunkContent(normalizedContent), [normalizedContent]);
  const [isOpen, setIsOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [signatureData, setSignatureData] = useState<string>("");
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [wacomLoading, setWacomLoading] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isOpen && canvasRef.current) {
      clearCanvas();
    }
  }, [isOpen]);

  const clearCanvas = (ref: React.RefObject<HTMLCanvasElement | null> = canvasRef) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    setHasStroke(false);
    lastPoint.current = null;
  };

  const resizeCanvas = () => {
    [canvasRef, inlineCanvasRef].forEach((ref) => {
      const canvas = ref.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth * ratio;
      const height = canvas.offsetHeight * ratio;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(ratio, ratio);
          ctx.lineWidth = 2.4;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#0f172a";
        }
      }
    });
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(resizeCanvas, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (fiscalCodeProp) {
      setFiscalCode(fiscalCodeProp);
    }
  }, [fiscalCodeProp]);

  useEffect(() => {
    const updateName = () => {
      const first = (document.querySelector<HTMLInputElement>('input[name="firstName"]')?.value || "").trim();
      const last = (document.querySelector<HTMLInputElement>('input[name="lastName"]')?.value || "").trim();
      const full = [first, last].filter(Boolean).join(" ");
      setPatientName(full || "Paziente");
    };

    const updateFiscal = () => {
      const tax = (document.querySelector<HTMLInputElement>('input[name="taxId"]')?.value || "").trim();
      setFiscalCode(tax || fiscalCodeProp || "");
    };

    updateName();
    updateFiscal();
    const firstInput = document.querySelector<HTMLInputElement>('input[name="firstName"]');
    const lastInput = document.querySelector<HTMLInputElement>('input[name="lastName"]');
    const taxInput = document.querySelector<HTMLInputElement>('input[name="taxId"]');

    firstInput?.addEventListener("input", updateName);
    lastInput?.addEventListener("input", updateName);
    taxInput?.addEventListener("input", updateFiscal);

    return () => {
      firstInput?.removeEventListener("input", updateName);
      lastInput?.removeEventListener("input", updateName);
      taxInput?.removeEventListener("input", updateFiscal);
    };
  }, [fiscalCodeProp]);

  const getPoint = (
    event: React.PointerEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null> = canvasRef
  ) => {
    const canvas = ref.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null> = canvasRef
  ) => {
    event.preventDefault();
    const point = getPoint(event, ref);
    if (!point) return;
    lastPoint.current = point;
    setHasStroke(true);
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLCanvasElement>,
    ref: React.RefObject<HTMLCanvasElement | null> = canvasRef
  ) => {
    if (!lastPoint.current) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const point = getPoint(event, ref);
    if (!point) return;
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
  };

  const handlePointerUp = () => {
    lastPoint.current = null;
  };

  const saveSignature = (ref: React.RefObject<HTMLCanvasElement | null> = canvasRef) => {
    const canvas = ref.current;
    if (!canvas || !hasStroke) {
      setSignatureError("Firma obbligatoria. Disegna la firma e riprova.");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureData(dataUrl);
    setSignatureError(null);
    setIsOpen(false);
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
      sigSDK.RenderFlags.RenderEncodeData.value,
    );
  };

  const captureWithWacom = async () => {
    if (wacomLoading) return;
    setSignatureError(null);
    setWacomLoading(true);
    try {
      const sigSDK = await loadWacomSignatureSdk();
      if (!sigSDK) {
        throw new Error("SDK Wacom non disponibile. Aggiungi signature_sdk.js e signature_sdk.wasm in /public/wacom.");
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

      const dialog = new sigSDK.StuCaptDialog(stuDevice, config);
      dialog.addEventListener(sigSDK.EventType.OK, async () => {
        const image = await renderWacomSignature(sigSDK, sigObj);
        setSignatureData(image);
        setHasStroke(true);
        setIsOpen(false);
        dialog.delete?.();
        stuDevice.delete?.();
      });
      dialog.addEventListener(sigSDK.EventType.CANCEL, () => {
        dialog.delete?.();
        stuDevice.delete?.();
      });

      await dialog.open(sigObj, patientName, "Consenso informato", null, sigSDK.KeyType.SHA512, null);
    } catch (error) {
      setSignatureError(error instanceof Error ? error.message : "Errore acquisizione firma Wacom.");
    } finally {
      setWacomLoading(false);
    }
  };

  const currentPage = pages[pageIndex] ?? [];
  const totalPages = pages.length;
  const renderedMarkdown = useMemo(
    () => renderMarkdown(currentPage.join("\n\n")),
    [currentPage],
  );

  useEffect(() => {
    if (pageIndex === totalPages - 1 || signatureData) {
      setHasReachedEnd(true);
    }
  }, [pageIndex, totalPages, signatureData]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-900">Consenso Informato</p>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Leggi l&apos;informativa privacy completa e raccogli la firma digitale del paziente.
          La firma è obbligatoria per completare la registrazione.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setPageIndex(0);
            setHasReachedEnd(Boolean(signatureData) || totalPages <= 1);
            setSignatureError(null);
          }}
          className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Apri informativa privacy e firma
        </button>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              signatureData ? "bg-emerald-500" : "bg-zinc-300"
            }`}
          />
          {signatureData ? "Firma digitale acquisita" : "Firma digitale mancante"}
        </div>
      </div>

      <input type="hidden" name="consentSignatureData" value={signatureData} readOnly />

      {signatureData ? (
        <div className="rounded-lg border border-emerald-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Firma salvata</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <img
              src={signatureData}
              alt="Firma digitale"
              className="h-16 rounded border border-emerald-100 bg-white object-contain px-2 py-1 shadow-sm"
            />
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center justify-center rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300"
            >
              Rivedi informativa / Rifirma
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          Luogo
          <input
            name="consentPlace"
            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            placeholder="Luogo"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          Data
          <input
            type="date"
            name="consentDate"
            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            placeholder="dd/mm/yyyy"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          In stampatello, paziente o esercente podestà
          <input
            name="patientSignature"
            required
            className="h-11 rounded-lg border border-zinc-200 px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            placeholder="Inserire nome"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
          Medico assegnato
          <select
            name="doctorSignature"
            className="h-11 rounded-lg border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Seleziona medico
            </option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.fullName}>
                {doctor.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-emerald-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Firma digitale del paziente</p>
            <p className="text-xs text-emerald-700">
              Firma qui sotto; usa Cancella per ricominciare. Puoi anche aprire l&apos;informativa sopra.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={captureWithWacom}
              disabled={wacomLoading}
              className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {wacomLoading ? "Collego Wacom..." : "Firma con Wacom"}
            </button>
            <button
              type="button"
              onClick={() => {
                clearCanvas(inlineCanvasRef);
                setHasStroke(false);
                setSignatureData("");
              }}
              className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-300"
            >
              Cancella
            </button>
            <button
              type="button"
              onClick={() => saveSignature(inlineCanvasRef)}
              disabled={!hasStroke}
              className="rounded-full bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Salva firma
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50">
          <canvas
            ref={inlineCanvasRef}
            className="h-40 w-full bg-white"
            onPointerDown={(e) => handlePointerDown(e, inlineCanvasRef)}
            onPointerMove={(e) => handlePointerMove(e, inlineCanvasRef)}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        {signatureError ? <p className="text-xs font-semibold text-amber-700">{signatureError}</p> : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <Link
          href="/pazienti"
          className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 px-5 text-sm font-semibold text-zinc-800 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          Annulla
        </Link>
        <FormSubmitButton
          disabled={!signatureData}
          className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Salva Modulo
        </FormSubmitButton>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Informativa privacy
                </p>
                <h2 className="text-xl font-semibold text-zinc-900">Lettura e firma digitale</h2>
                <p className="text-sm text-zinc-600">Scorri il testo, usa Avanti/Indietro e firma nel riquadro.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
                <span>Pagina {pageIndex + 1} di {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPageIndex((idx) => Math.max(0, idx - 1))}
                    disabled={pageIndex === 0}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Indietro
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageIndex((idx) => Math.min(totalPages - 1, idx + 1))}
                    disabled={pageIndex === totalPages - 1}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Avanti
                  </button>
                </div>
              </div>
              <div className="mt-3 max-h-[45vh] space-y-3 overflow-y-auto rounded-lg border border-zinc-100 bg-white p-3 text-sm leading-relaxed text-zinc-800">
                {renderedMarkdown}
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Firma digitale del paziente</p>
                  <p className="text-xs text-emerald-700">
                    Firma all&apos;interno del riquadro. Usa Cancella per ricominciare.
                    {!hasReachedEnd ? " Completa la lettura dell'informativa prima di salvare." : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={captureWithWacom}
                    disabled={wacomLoading}
                    className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {wacomLoading ? "Collego Wacom..." : "Firma con Wacom"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearCanvas(canvasRef);
                      setHasStroke(false);
                      setSignatureData("");
                    }}
                    className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:border-emerald-300"
                  >
                    Cancella
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSignature(canvasRef)}
                    disabled={!hasStroke}
                    className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Salva firma
                  </button>
                </div>
              </div>
                <div className="overflow-hidden rounded-lg border border-emerald-200 bg-white">
                  <canvas
                    ref={canvasRef}
                    className="h-44 w-full touch-none"
                    onPointerDown={(e) => handlePointerDown(e, canvasRef)}
                    onPointerMove={(e) => handlePointerMove(e, canvasRef)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                </div>
                {signatureError ? <p className="text-xs font-semibold text-amber-700">{signatureError}</p> : null}
                {!hasReachedEnd ? (
                  <p className="text-xs font-semibold text-amber-700">
                    Scorri l&apos;informativa fino in fondo prima di salvare la firma.
                  </p>
                ) : null}
              </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
