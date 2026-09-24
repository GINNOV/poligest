import { getCurrentUser } from "@/lib/auth";

export async function DemoRealmBanner() {
  const user = await getCurrentUser();
  if (!user?.isDemo) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      Studio dimostrativo. I dati non sono quelli dello studio.
    </div>
  );
}
