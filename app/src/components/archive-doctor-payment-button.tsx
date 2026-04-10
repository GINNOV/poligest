"use client";

type Props = {
  entryId: string;
  action: (formData: FormData) => Promise<void>;
};

export function ArchiveDoctorPaymentButton({ entryId, action }: Props) {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (window.confirm("Sei sicuro di voler archiviare questo pagamento? L'azione non può essere annullata.")) {
      const formData = new FormData(event.currentTarget);
      await action(formData);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="entryId" value={entryId} />
      <button
        type="submit"
        className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Archivia
      </button>
    </form>
  );
}
