import { revalidatePath } from "next/cache";

export function revalidateRichiami() {
  revalidatePath("/richiami");
  revalidatePath("/richiami/programmati");
  revalidatePath("/richiami/regole");
  revalidatePath("/richiami/ricorrenti");
}