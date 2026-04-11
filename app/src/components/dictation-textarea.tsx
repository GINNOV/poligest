"use client";

import { useEffect, useRef, useState } from "react";

type DictationTextareaProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onValueChange?: (value: string) => void;
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  dictationLabel?: string;
  dictationLanguage?: string;
};

type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item: (index: number) => SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item: (index: number) => SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  }

  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
};

export function DictationTextarea({
  name,
  value,
  defaultValue,
  onChange,
  onValueChange,
  onFocus,
  onBlur,
  placeholder,
  className,
  rows,
  disabled,
  required,
  dictationLabel = "Dettatura",
  dictationLanguage = "it-IT",
}: DictationTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

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

  const commitValue = (nextValue: string) => {
    if (onValueChange) {
      onValueChange(nextValue);
      return;
    }

    if (textareaRef.current) {
      textareaRef.current.value = nextValue;
    }
  };

  const appendTranscript = (transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return;
    }

    const currentValue = value ?? textareaRef.current?.value ?? "";
    const nextValue = currentValue.trim()
      ? `${currentValue.trimEnd()} ${trimmed}`
      : trimmed;
    commitValue(nextValue);
  };

  const startDictation = () => {
    const SpeechRecognitionImpl = getSpeechRecognition();
    if (!SpeechRecognitionImpl || disabled) {
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionImpl();
      recognition.lang = dictationLanguage;
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
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
        rows={rows}
        disabled={disabled}
        required={required}
      />
      <div className="flex items-center justify-between text-xs">
        <span className={isListening ? "text-emerald-700" : "text-transparent"}>
          In ascolto...
        </span>
        <button
          type="button"
          onClick={toggleDictation}
          disabled={!isSupported || disabled}
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
          {isListening ? "Ferma dettatura" : dictationLabel}
        </button>
      </div>
    </div>
  );
}
