"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportTables } from "@/lib/admin/export-tables";

export function ConfigExportForm() {
  const [exportMode, setExportMode] = useState<"all" | "custom">("all");
  const [showSafeDialog, setShowSafeDialog] = useState(false);

  const categories = Array.from(new Set(exportTables.map(t => t.category)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all ${
          exportMode === "all" 
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" 
            : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950"
        }`}>
          <input
            type="radio"
            name="exportMode"
            value="all"
            checked={exportMode === "all"}
            onChange={() => setExportMode("all")}
            className="h-4 w-4 border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Tutto il database</p>
            <p className="text-xs text-zinc-500">Backup completo di ogni tabella e configurazione.</p>
          </div>
        </label>

        <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all ${
          exportMode === "custom" 
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" 
            : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950"
        }`}>
          <input
            type="radio"
            name="exportMode"
            value="custom"
            checked={exportMode === "custom"}
            onChange={() => setExportMode("custom")}
            className="h-4 w-4 border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Personalizza esportazione</p>
            <p className="text-xs text-zinc-500">Scegli quali dati specifici scaricare.</p>
          </div>
        </label>
      </div>

      <form 
        method="GET" 
        action="/api/admin/export" 
        className="space-y-8"
        onSubmit={() => {
          setTimeout(() => setShowSafeDialog(true), 1000);
        }}
      >
        {exportMode === "custom" && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-top-2 duration-300">
            {categories.map(category => (
              <div key={category} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-2 dark:border-zinc-800">{category}</h3>
                <div className="flex flex-col gap-2">
                  {exportTables.filter(t => t.category === category).map(table => (
                    <label key={table.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-2 transition hover:bg-zinc-100 dark:border-zinc-800/50 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60">
                      <input
                        type="checkbox"
                        name="tables"
                        value={table.key}
                        defaultChecked
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700"
                      />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{table.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <Button type="submit" size="lg" className="gap-2 rounded-full px-8 font-bold shadow-lg shadow-emerald-200/50 dark:shadow-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Genera il backup
          </Button>
        </div>
      </form>

      {showSafeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl dark:bg-zinc-900">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl dark:bg-blue-900/30">
                💾
              </div>
              <h2 className="mt-6 text-xl font-bold text-zinc-900 dark:text-zinc-50">Backup Generato!</h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Il download del file di backup è stato avviato.
              </p>
              <div className="mt-6 rounded-2xl bg-zinc-50 p-4 text-xs font-medium text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <p className="font-bold text-zinc-900 dark:text-zinc-100">⚠️ Importante:</p>
                <p className="mt-1">
                  Questo file contiene dati sensibili di pazienti e dello studio.
                  <strong> Conservalo in un luogo sicuro</strong>, ad esempio una chiavetta USB dedicata o un drive cifrato non accessibile pubblicamente.
                </p>
              </div>
              <Button
                onClick={() => setShowSafeDialog(false)}
                className="mt-8 w-full rounded-full font-bold"
              >
                Ho capito, grazie
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
