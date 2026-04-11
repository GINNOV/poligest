"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { placeholderCatalog, previewData } from "@/lib/placeholder-data";
import { createButton, renderEmailHtml, replacePlaceholders } from "@/lib/email-template-utils";
import { sendTestEmail, updateEmailTemplate } from "@/actions/adminActions";
import { PlaceholderGuide } from "@/components/PlaceholderGuide";

export type EmailTemplateFormProps = {
  template: {
    name: string;
    title?: string | null;
    subject: string;
    body: string;
    buttonColor?: string | null;
  };
};

export function EmailTemplateForm({ template }: EmailTemplateFormProps) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [buttonColor, setButtonColor] = useState(template.buttonColor ?? "#059669");
  const [testEmail, setTestEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isSending, startSending] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const previewHtml = useMemo(() => {
    const data = {
      ...previewData,
      button: createButton("Apri dettaglio", "https://sorrisosplendente.com", buttonColor),
    };
    const replaced = replacePlaceholders(body, data);
    return renderEmailHtml(replaced, buttonColor);
  }, [body, buttonColor]);

  const handleInsert = (key: string) => {
    const token = `{{${key}}}`;
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    startSaving(async () => {
      try {
        await updateEmailTemplate({
          name: template.name,
          subject: subject.trim(),
          body: body.trim(),
          buttonColor: buttonColor?.trim() || null,
        });
        setStatus("Template salvato correttamente.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Errore durante il salvataggio.");
      }
    });
  };

  const handleSendTest = () => {
    if (!testEmail.trim()) {
      setStatus("Inserisci un indirizzo email per il test.");
      return;
    }
    setStatus(null);
    startSending(async () => {
      try {
        await sendTestEmail({
          to: testEmail.trim(),
          templateName: template.name,
          subject,
          body,
          buttonColor,
        });
        setStatus("Email di test inviata.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Errore durante l'invio.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <PlaceholderGuide placeholders={placeholderCatalog} />

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Editor</p>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{template.title ?? template.name}</h2>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Aggiornamento..." : "Aggiorna"}
          </button>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Oggetto
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Corpo (Markdown semplice)
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={12}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-[1fr,1fr]">
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Colore bottone
            <input
              value={buttonColor}
              onChange={(event) => setButtonColor(event.target.value)}
              className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {placeholderCatalog.map((placeholder) => (
              <button
                key={placeholder.key}
                type="button"
                onClick={() => handleInsert(placeholder.key)}
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
              >
                {`{{${placeholder.key}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Test invio</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="email@esempio.com"
              className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-900/40"
            />
            <button
              type="button"
              disabled={isSending}
              onClick={handleSendTest}
              className="inline-flex h-10 items-center justify-center rounded-full border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-emerald-800 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
            >
              {isSending ? "Invio..." : "Invia test"}
            </button>
          </div>
          {status ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{status}</p> : null}
        </div>
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Anteprima live</h3>
        </div>
        <div className="p-4">
          <iframe title="Preview" className="h-[520px] w-full rounded-xl border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950" srcDoc={previewHtml} />
        </div>
      </div>
    </div>
  );
}
