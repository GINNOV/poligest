"use client";

import { useEffect, useRef, useState } from "react";

type ActiveField = "medications" | "extraNotes";

type Props = {
  medicationsDefault?: string | null;
  extraNotesDefault?: string | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
};

const appendText = (current: string, transcript: string) => {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return current;
  }
  return current.trim()
    ? `${current.trimEnd()} ${trimmed}`
    : trimmed;
};

export function PatientAnamnesisNotes({ medicationsDefault, extraNotesDefault }: Props) {
  const [medications, setMedications] = useState(medicationsDefault ?? "");
  const [extraNotes, setExtraNotes] = useState(extraNotesDefault ?? "");
  const [activeField, setActiveField] = useState<ActiveField>("medications");
  const activeFieldRef = useRef<ActiveField>("medications");
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsSupported(!!getSpeechRecognition());
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      if (!isListening || !containerRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (target && containerRef.current.contains(target)) {
        return;
      }
      stopDictation();
    };
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isListening]);

  const handleFocus = (field: ActiveField) => {
    setActiveField(field);
    activeFieldRef.current = field;
  };

  const appendTranscript = (transcript: string) => {
    if (activeFieldRef.current === "medications") {
      setMedications((current) => appendText(current, transcript));
      return;
    }
    setExtraNotes((current) => appendText(current, transcript));
  };

  const startDictation = () => {
    const SpeechRecognitionImpl = getSpeechRecognition();
    if (!SpeechRecognitionImpl) {
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = "it-IT";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) {
            transcript += result[0].transcript;
          }
        }
        appendTranscript(transcript);
      };
      recognition.onerror = () => {
        setIsListening(false);
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const toggleDictation = () => {
    if (isListening) {
      stopDictation();
      return;
    }
    startDictation();
  };

  return (
    <div className="contents" ref={containerRef}>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        <span
          className={
            activeField === "medications"
              ? "font-semibold text-emerald-700"
              : "font-medium text-zinc-800"
          }
        >
          Specificare eventuali farmaci assunti regolarmente
        </span>
        <textarea
          name="medications"
          value={medications}
          onChange={(event) => setMedications(event.target.value)}
          onFocus={() => handleFocus("medications")}
          className="min-h-[90px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Elenca farmaci e dosaggi"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800">
        <span
          className={
            activeField === "extraNotes"
              ? "font-semibold text-emerald-700"
              : "font-medium text-zinc-800"
          }
        >
          Note aggiuntive
        </span>
        <textarea
          name="extraNotes"
          value={extraNotes}
          onChange={(event) => setExtraNotes(event.target.value)}
          onFocus={() => handleFocus("extraNotes")}
          className="min-h-[90px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          placeholder="Annotazioni utili per il medico"
        />
      </label>
      <div className="flex items-center justify-end text-xs sm:col-span-2">
        <button
          type="button"
          onClick={toggleDictation}
          disabled={!isSupported}
          aria-pressed={isListening}
          title={
            isSupported ? undefined : "Dettatura non supportata dal browser"
          }
          className={[
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold transition disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400",
            isListening
              ? "border-rose-700 bg-rose-600 text-white animate-pulse"
              : "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:text-emerald-600",
          ].join(" ")}
        >
          {isListening ? "Ferma dettatura" : "Dettatura"}
        </button>
      </div>
    </div>
  );
}
