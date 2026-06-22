import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import {
  WACOM_CONFIG_ID,
  clearWacomConfigCache,
  getWacomLicenseConfig,
} from "@/lib/wacom-config";
import { getWacomMeta } from "@/lib/wacom-meta";
import { WacomAdminPanels } from "./WacomAdminPanels";

async function saveWacomConfig(formData: FormData) {
  "use server";

  await requireUser([Role.ADMIN]);

  const licenseKeyInput = (formData.get("licenseKey") as string)?.trim();
  const licenseSecretInput = (formData.get("licenseSecret") as string)?.trim();

  const existing = await prisma.wacomConfig.findUnique({
    where: { id: WACOM_CONFIG_ID },
  });

  const licenseKey = licenseKeyInput || existing?.licenseKey || "";
  const licenseSecret = licenseSecretInput || existing?.licenseSecret || "";

  if (!licenseKey || !licenseSecret) {
    throw new Error("Inserisci chiave e secret della licenza Wacom.");
  }

  await prisma.wacomConfig.upsert({
    where: { id: WACOM_CONFIG_ID },
    update: {
      ...(licenseKeyInput ? { licenseKey: licenseKeyInput } : {}),
      ...(licenseSecretInput ? { licenseSecret: licenseSecretInput } : {}),
    },
    create: { id: WACOM_CONFIG_ID, licenseKey, licenseSecret },
  });

  clearWacomConfigCache();
  revalidatePath("/admin/wacom");
}

export default async function WacomAdminPage() {
  await requireUser([Role.ADMIN]);

  const [wacomMeta, license] = await Promise.all([getWacomMeta(), getWacomLicenseConfig()]);
  const isReady = wacomMeta.licenseConfigured && wacomMeta.sdkFilesPresent;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white p-6 shadow-sm dark:border-zinc-800 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-950">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-3xl shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
            ✍️
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Integrazione firma digitale
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Wacom STU-430</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              Gestisci la licenza Wacom per acquisire le firme digitali nei consensi informati e nei preventivi.
            </p>
          </div>
        </div>
      </div>

      <WacomAdminPanels
        isConfigured={wacomMeta.licenseConfigured}
        licenseKey={license?.licenseKey ?? ""}
        licenseSecret={license?.licenseSecret ?? ""}
        licenseSource={wacomMeta.licenseSource}
        sdkFilesPresent={wacomMeta.sdkFilesPresent}
        isReady={isReady}
        saveAction={saveWacomConfig}
      />
    </div>
  );
}