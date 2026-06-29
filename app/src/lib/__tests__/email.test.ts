import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminBackupReminderBody,
  buildAdminBackupReminderHtml,
} from "@/lib/recurring-messages/domain";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: sendMock,
    },
  })),
}));

const appRoot = resolve(__dirname, "../../..");
const recurringRoutePath = resolve(
  appRoot,
  "src/app/api/notifications/recurring/route.ts",
);

describe("email rendering contract", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "test-key");
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  it("documents sendEmail antipattern: multiline plain text is wrapped in a single <p>", async () => {
    const { sendEmail } = await import("@/lib/email");
    const body = ["Line one", "", "Line two", "1. First step", "2. Second step"].join("\n");

    await sendEmail("admin@example.com", "Backup reminder", body);

    expect(sendMock).toHaveBeenCalledOnce();
    const payload = sendMock.mock.calls[0][0];
    expect(payload.text).toBe(body);
    expect(payload.html).toBe(`<p>${body}</p>`);
    expect(payload.html).toMatch(/^<p>[\s\S]*<\/p>$/);
    expect(payload.html).not.toMatch(/<br\s*\/?>/i);
    expect(payload.html).not.toMatch(/<ol[\s>]/i);
    expect(payload.html).not.toMatch(/<li[\s>]/i);
  });

  it("materializeTransactionalEmail renders HTML and plain-text bodies", async () => {
    const { materializeTransactionalEmail, buildTransactionalButton } = await import(
      "@/lib/email-template-utils"
    );

    const materialized = materializeTransactionalEmail({
      subjectSource: "Promemoria {{appointmentDate}}",
      bodySource: "Ciao {{patientName}},\n\n{{button}}\n\n{{clinicName}}",
      data: {
        patientName: "Mario Rossi",
        appointmentDate: "30/06/2026",
        clinicName: "SORRISO",
        button: buildTransactionalButton("#059669"),
      },
      buttonColor: "#059669",
      clinicName: "SORRISO",
    });

    expect(materialized.subject).toBe("Promemoria 30/06/2026");
    expect(materialized.html).toMatch(/<table role="presentation"/);
    expect(materialized.html).toMatch(/studio_agovinoangrisano_logo\.png/);
    expect(materialized.html).toMatch(/Apri dettaglio/);
    expect(materialized.html).toMatch(/tramite SORRISO/);
    expect(materialized.body).toContain("Mario Rossi");
    expect(materialized.body).not.toMatch(/<a[\s>]/i);
  });

  it("renders welcome-patient emails with branded header and centered CTA", async () => {
    const { materializeTransactionalEmail, buildTransactionalButton } = await import(
      "@/lib/email-template-utils"
    );

    const materialized = materializeTransactionalEmail({
      subjectSource: "Benvenuto in {{clinicName}}",
      bodySource:
        "Gentile {{patientName}},\n\nLa informiamo che l'accesso alla Sua area paziente è stato attivato.\n\n{{button}}\n\nCordiali saluti,\n{{clinicName}}",
      data: {
        patientName: "Maria Rossi",
        clinicName: "Studio Agovino & Angrisano",
        button: buildTransactionalButton("#047857", "Accedi all'area paziente", "https://sorrisosplendente.com"),
      },
      templateName: "welcome-patient",
      clinicName: "Studio Agovino & Angrisano",
    });

    expect(materialized.subject).toBe("Benvenuto in Studio Agovino & Angrisano");
    expect(materialized.html).toContain("studio_agovinoangrisano_logo.png");
    expect(materialized.html).toContain("Benvenuto");
    expect(materialized.html).toContain("Area paziente");
    expect(materialized.html).toContain("Studio Agovino &amp; Angrisano");
    expect(materialized.html).toContain("Accedi all'area paziente");
    expect(materialized.html).toMatch(/text-align:center/);
  });

  it("uses the SORRISO display name for outbound email sender", async () => {
    const { sendEmail } = await import("@/lib/email");

    await sendEmail("doctor@example.com", "Test", "Body");

    const payload = sendMock.mock.calls[0][0];
    expect(payload.from).toBe("SORRISO <noreply@sorrisosplendente.com>");
  });

  it("sendEmailWithHtml supports optional BCC recipients", async () => {
    const { sendEmailWithHtml } = await import("@/lib/email");

    await sendEmailWithHtml(
      "doctor@example.com",
      "Agenda di domani",
      "Plain body",
      "<p>HTML body</p>",
      { bcc: "studio.agovino.angrisano@gmail.com" },
    );

    const payload = sendMock.mock.calls[0][0];
    expect(payload.bcc).toBe("studio.agovino.angrisano@gmail.com");
  });

  it("sendEmailWithHtml preserves structured HTML for transactional emails", async () => {
    const { sendEmailWithHtml } = await import("@/lib/email");
    const body = "Plain fallback\nwith newlines";
    const html = [
      "<div>",
      "  <p>Intro</p>",
      "  <ol><li>Step one</li><li>Step two</li></ol>",
      '  <a href="https://example.com/admin/reset">Open admin</a>',
      "</div>",
    ].join("\n");

    await sendEmailWithHtml("admin@example.com", "Backup reminder", body, html);

    const payload = sendMock.mock.calls[0][0];
    expect(payload.text).toBe(body);
    expect(payload.html).toBe(html);
    expect(payload.html).toMatch(/<ol[\s>]/i);
    expect(payload.html).toMatch(/href="https:\/\/example\.com\/admin\/reset"/);
  });
});

describe("buildAdminBackupReminderHtml", () => {
  const reminderParams = {
    adminName: "Mario Rossi",
    adminResetUrl: "https://poligest.example.com/admin/reset",
    monthLabel: "giugno 2026",
  };

  it("renders structured HTML with ordered steps and links", () => {
    const html = buildAdminBackupReminderHtml(reminderParams);

    expect(html).toMatch(/<ol[\s>]/i);
    expect(html.match(/<li[\s>]/gi)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(html).toMatch(/href="https:\/\/poligest\.example\.com\/admin\/reset"/);
    expect(html).toContain("Apri Admin &gt; Sistema: Database");
    expect(html).toContain("Ciao <strong>Mario Rossi</strong>,");
  });

  it("does not rely on newline-only plain-text layout for numbered instructions", () => {
    const body = buildAdminBackupReminderBody(reminderParams);
    const html = buildAdminBackupReminderHtml(reminderParams);

    expect(body).toContain("\n");
    expect(body).toMatch(/1\. Accedi alla dashboard amministrativa di SORRISO\./);

    expect(html).not.toMatch(/1\. Accedi alla dashboard amministrativa di SORRISO\./);
    expect(html).toMatch(/<li[^>]*>Accedi alla dashboard amministrativa di SORRISO\.<\/li>/);
    expect(html).not.toMatch(/Passaggi consigliati:\n1\./);
  });
});

describe("recurring notifications route email contract", () => {
  it("sends admin backup reminders with sendEmailWithHtml, not bare sendEmail", () => {
    const source = readFileSync(recurringRoutePath, "utf8");

    expect(source).toMatch(
      /import\s*\{[^}]*sendEmailWithHtml[^}]*\}\s*from\s*["']@\/lib\/email["']/,
    );

    const adminBackupLoop = source.match(
      /for\s*\(\s*const\s+candidate\s+of\s+adminBackupCandidates\s*\)\s*\{[\s\S]*?\n\s*\}/,
    )?.[0];

    expect(adminBackupLoop, "admin backup loop should exist in recurring route").toBeDefined();
    expect(adminBackupLoop).toMatch(/sendEmailWithHtml\s*\(/);
    expect(adminBackupLoop).not.toMatch(/\bsendEmail\s*\(/);
  });

  it("keeps plain sendEmail only for materialized recurring patient messages", () => {
    const source = readFileSync(recurringRoutePath, "utf8");

    const recurringPatientLoop = source.match(
      /for\s*\(\s*const\s+candidate\s+of\s+selectedCandidates\s*\)\s*\{[\s\S]*?\n\s*\}/,
    )?.[0];

    expect(recurringPatientLoop, "recurring patient loop should exist in recurring route").toBeDefined();
    expect(recurringPatientLoop).toMatch(/materializeRecurringDelivery\s*\(/);
    expect(recurringPatientLoop).toMatch(/\bsendEmail\s*\(/);
    expect(recurringPatientLoop).not.toMatch(/sendEmailWithHtml\s*\(/);
  });
});