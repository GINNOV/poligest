import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getEmailTemplateByName } from "@/lib/email-templates";
import { EmailTemplateForm } from "@/components/EmailTemplateForm";

export const dynamic = "force-dynamic";

export default async function EmailTemplateEditPage({
  params,
}: {
  params: { templateName: string };
}) {
  await requireUser([Role.ADMIN]);
  const template = await getEmailTemplateByName(params.templateName);

  if (!template) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-zinc-600">Template non trovato.</p>
        <Link
          href="/admin/emails"
          className="mt-4 inline-flex rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-emerald-800"
        >
          Torna ai template
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Template email
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{template.name}</h1>
        </div>
        <Link
          href="/admin/emails"
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          Torna ai template
        </Link>
      </div>

      <EmailTemplateForm
        template={{
          name: template.name,
          title: template.description ?? template.name,
          subject: template.subject,
          body: template.body,
          buttonColor: template.buttonColor,
        }}
      />
    </div>
  );
}
