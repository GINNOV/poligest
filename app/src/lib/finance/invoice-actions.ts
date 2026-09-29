"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DEFAULT_CLINIC_NAME } from "@/lib/brand";
import { sendEmailTemplate, getEmailTemplateByName } from "@/lib/email-templates";
import {
  formatInvoiceLines,
  formatInvoiceNumber,
  resolveInvoiceEmailBody,
} from "@/lib/finance/invoices";
import { InvoiceIssueError, issueStudioInvoice, voidStudioInvoice } from "@/lib/finance/issue-invoice";
import { prisma } from "@/lib/prisma";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { isRedirectError } from "@/lib/utils";
import { formatDateInDisplayTimeZone } from "@/lib/user-display-time-zone";

function messageFrom(error: unknown) {
  if (error instanceof InvoiceIssueError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Non è stato possibile completare l'operazione.";
}

function revalidateInvoicePaths(invoiceId?: string) {
  revalidatePath("/finanza");
  revalidatePath("/finanza/fatture");
  if (invoiceId) revalidatePath(`/finanza/fatture/${invoiceId}`);
}

export async function issueInvoiceAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const patientId = String(formData.get("patientId") ?? "").trim();
  const sourceKeys = formData.getAll("source").map((value) => String(value));
  try {
    const invoice = await issueStudioInvoice({
      patientId,
      sourceKeys,
      userId: user.id,
    });
    await logAudit(user, {
      action: "finance.invoice.issued",
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { number: formatInvoiceNumber(invoice.year, invoice.number) },
    });
    revalidateInvoicePaths(invoice.id);
    redirect(`/finanza/fatture/${invoice.id}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("issueInvoiceAction", error);
    const target = patientId
      ? `/finanza/fatture/nuova?patientId=${encodeURIComponent(patientId)}&error=${encodeURIComponent(messageFrom(error))}`
      : `/finanza/fatture/nuova?error=${encodeURIComponent(messageFrom(error))}`;
    redirect(target);
  }
}

export async function voidInvoiceAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  try {
    await voidStudioInvoice(invoiceId);
    await logAudit(user, {
      action: "finance.invoice.voided",
      entity: "Invoice",
      entityId: invoiceId,
    });
    revalidateInvoicePaths(invoiceId);
    redirect(`/finanza/fatture/${invoiceId}`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("voidInvoiceAction", error);
    redirect(`/finanza/fatture/${invoiceId}?error=${encodeURIComponent(messageFrom(error))}`);
  }
}

export async function emailInvoiceAction(formData: FormData) {
  const user = await requireUser([Role.ADMIN, Role.MANAGER]);
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { createdAt: "asc" } },
        patient: { select: { email: true } },
      },
    });
    if (!invoice || invoice.status !== "ISSUED") {
      throw new InvoiceIssueError("Si può inviare solo una fattura emessa.");
    }
    const email = invoice.patient.email?.trim() ?? "";
    if (!email) {
      throw new InvoiceIssueError("Aggiungi un'email in anagrafica per inviare la fattura.");
    }

    const template = await getEmailTemplateByName("invoice-ready");
    const overrideBody = resolveInvoiceEmailBody(template?.body ?? "");
    const timeZone = await getPracticeTimeZone();
    const number = formatInvoiceNumber(invoice.year, invoice.number);
    await sendEmailTemplate({
      to: email,
      templateName: "invoice-ready",
      data: {
        patientName: invoice.patientName,
        clinicName: DEFAULT_CLINIC_NAME,
        invoiceNumber: number,
        invoiceDate: formatDateInDisplayTimeZone(invoice.issuedAt, { dateStyle: "short" }, timeZone),
        invoiceTotal: Number(invoice.total.toString()).toFixed(2),
        invoiceLines: formatInvoiceLines(
          invoice.lines.map((line) => ({
            serviceName: line.serviceName,
            quantity: line.quantity,
            total: Number(line.total.toString()),
          })),
        ),
      },
      override: overrideBody ? { body: overrideBody } : undefined,
    });
    await logAudit(user, {
      action: "finance.invoice.emailed",
      entity: "Invoice",
      entityId: invoice.id,
      metadata: { to: email },
    });
    revalidateInvoicePaths(invoice.id);
    redirect(`/finanza/fatture/${invoice.id}?sent=1`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("emailInvoiceAction", error);
    redirect(`/finanza/fatture/${invoiceId}?error=${encodeURIComponent(messageFrom(error))}`);
  }
}
