"use client";

import { Button } from "@/components/ui/button";

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
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="px-3 font-semibold"
      >
        Archivia
      </Button>
    </form>
  );
}
