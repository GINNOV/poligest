"use server";

import { requireUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  getAllEmailTemplates as getAll,
  getEmailTemplateByName as getByName,
  updateEmailTemplate as updateTemplate,
  sendTestEmail as sendTest,
} from "@/lib/email-templates";

export async function getAllEmailTemplates() {
  await requireUser([Role.ADMIN]);
  return getAll();
}

export async function getEmailTemplateByName(name: string) {
  await requireUser([Role.ADMIN]);
  return getByName(name);
}

export async function updateEmailTemplate(params: {
  name: string;
  subject: string;
  body: string;
  buttonColor?: string | null;
}) {
  await requireUser([Role.ADMIN]);
  return updateTemplate(params);
}

export async function sendTestEmail(params: {
  to: string;
  templateName: string;
  subject?: string;
  body?: string;
  buttonColor?: string | null;
}) {
  await requireUser([Role.ADMIN]);
  return sendTest(params);
}
