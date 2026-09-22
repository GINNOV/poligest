import { revalidatePath } from "next/cache";

export function revalidateRichiami() {
  revalidatePath("/richiami");
  revalidatePath("/richiami/programmati");
  revalidatePath("/richiami/programmati/non-inviati");
  revalidatePath("/richiami/regole");
  revalidatePath("/richiami/ricorrenti");
}