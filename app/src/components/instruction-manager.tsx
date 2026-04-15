"use client";

import { useState } from "react";
import { Role } from "@prisma/client";
import { upsertInstructionAction, deleteInstructionAction } from "@/lib/instructions/actions";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";

type Step = {
  id?: string;
  title: string;
  content: string;
  sortOrder: number;
};

type Instruction = {
  id?: string;
  title: string;
  description?: string | null;
  pathPattern: string;
  role: Role | null;
  isActive: boolean;
  steps: Step[];
};

type Props = {
  instructions: Instruction[];
};

export function InstructionManager({ instructions }: Props) {
  const [editing, setEditing] = useState<Instruction | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddInstruction = () => {
    setEditing({
      title: "",
      pathPattern: "",
      role: null,
      isActive: true,
      steps: [{ title: "", content: "", sortOrder: 0 }],
    });
  };

  const handleAddStep = () => {
    if (!editing) return;
    const nextOrder = editing.steps.length > 0 
      ? Math.max(...editing.steps.map(s => s.sortOrder)) + 1 
      : 0;
    setEditing({
      ...editing,
      steps: [...editing.steps, { title: "", content: "", sortOrder: nextOrder }],
    });
  };

  const handleRemoveStep = (index: number) => {
    if (!editing) return;
    const nextSteps = editing.steps.filter((_, i) => i !== index);
    setEditing({ ...editing, steps: nextSteps });
  };

  const handleUpdateStep = (index: number, data: Partial<Step>) => {
    if (!editing) return;
    const nextSteps = editing.steps.map((s, i) => (i === index ? { ...s, ...data } : s));
    setEditing({ ...editing, steps: nextSteps });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Istruzioni Configurate</h2>
        <Button onClick={handleAddInstruction}>+ Nuova Istruzione</Button>
      </div>

      <div className="grid gap-4">
        {instructions.map((ins) => (
          <div 
            key={ins.id} 
            className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-between"
          >
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{ins.title}</h3>
              <p className="text-sm text-zinc-500">{ins.pathPattern} • {ins.role || "Tutti i ruoli"}</p>
              <p className="text-xs text-zinc-400">{ins.steps.length} passaggi</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                ins.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600"
              )}>
                {ins.isActive ? "Attiva" : "Inattiva"}
              </span>
              <button 
                onClick={() => setEditing(ins)}
                className="p-2 text-zinc-400 hover:text-emerald-600 transition"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              </button>
              <button 
                onClick={() => setIsDeleting(ins.id!)}
                className="p-2 text-zinc-400 hover:text-rose-600 transition"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        ))}
        {instructions.length === 0 && (
          <p className="text-center py-8 text-zinc-500 italic">Nessuna istruzione configurata.</p>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950 border dark:border-zinc-800">
            <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
              {editing.id ? "Modifica Istruzione" : "Nuova Istruzione"}
            </h2>
            
            <form action={async (fd) => {
              const res = await upsertInstructionAction(fd);
              if (res.success) setEditing(null);
            }} className="space-y-4">
              <input type="hidden" name="id" value={editing.id || ""} />
              <input type="hidden" name="stepsJson" value={JSON.stringify(editing.steps)} />
              
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Titolo
                  <input 
                    name="title" 
                    defaultValue={editing.title} 
                    className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                    required 
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Pattern Percorso (Regex/Prefix)
                  <input 
                    name="pathPattern" 
                    defaultValue={editing.pathPattern} 
                    placeholder="/pazienti/.*"
                    className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                    required 
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Ruolo (opzionale)
                  <select 
                    name="role" 
                    defaultValue={editing.role || ""} 
                    className="h-10 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <option value="">Tutti</option>
                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-2 pt-6">
                  <input 
                    type="checkbox" 
                    name="isActive" 
                    defaultChecked={editing.isActive}
                    id="isActive"
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">Attiva</label>
                </div>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Descrizione breve
                <textarea 
                  name="description" 
                  defaultValue={editing.description || ""} 
                  rows={2}
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                />
              </label>

              <div className="space-y-4 pt-4 border-t dark:border-zinc-800">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 uppercase text-xs tracking-wider">Passaggi</h3>
                  <button 
                    type="button" 
                    onClick={handleAddStep}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-500 uppercase"
                  >
                    + Aggiungi passaggio
                  </button>
                </div>

                <div className="space-y-3">
                  {editing.steps.map((step, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <input 
                          placeholder="Titolo passaggio"
                          value={step.title}
                          onChange={(e) => handleUpdateStep(idx, { title: e.target.value })}
                          className="flex-1 h-9 bg-transparent border-b border-zinc-200 dark:border-zinc-700 focus:border-emerald-500 outline-none font-medium text-sm"
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1 text-zinc-400 hover:text-rose-500 transition"
                          disabled={editing.steps.length === 1}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                      <textarea 
                        placeholder="Contenuto (Markdown supportato)"
                        value={step.content}
                        onChange={(e) => handleUpdateStep(idx, { content: e.target.value })}
                        rows={3}
                        className="w-full bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t dark:border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
                <Button type="submit">Salva Istruzione</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950 border dark:border-zinc-800">
            <h2 className="text-xl font-semibold mb-2">Conferma eliminazione</h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
              Sei sicuro di voler eliminare questa istruzione? Questa azione non può essere annullata.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDeleting(null)}>Annulla</Button>
              <form action={async (fd) => {
                await deleteInstructionAction(fd);
                setIsDeleting(null);
              }}>
                <input type="hidden" name="id" value={isDeleting} />
                <Button type="submit" variant="destructive">Elimina</Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
