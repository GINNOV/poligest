import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  parseCreateRecallRulePayload: vi.fn(),
  parseAppointmentReminderRulePayload: vi.fn(),
  parseScheduledRecallPayload: vi.fn(),
  parseRecurringMessagePayload: vi.fn(),
  parseUpdateRecallRulePayload: vi.fn(),
  parseManualNotificationPayload: vi.fn(),
  createRecallRuleRecord: vi.fn(),
  upsertAppointmentReminderRuleRecord: vi.fn(),
  createScheduledRecallRecord: vi.fn(),
  deleteRecallRuleRecord: vi.fn(),
  upsertRecurringMessageConfigRecord: vi.fn(),
  updateRecallRuleRecord: vi.fn(),
  deleteScheduledRecallRecord: vi.fn(),
  loadManualNotificationContext: vi.fn(),
  formatManualNotificationMessage: vi.fn(),
  deliverManualNotification: vi.fn(),
  revalidateRichiami: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/recalls/payload", () => ({
  parseCreateRecallRulePayload: mocks.parseCreateRecallRulePayload,
  parseAppointmentReminderRulePayload: mocks.parseAppointmentReminderRulePayload,
  parseScheduledRecallPayload: mocks.parseScheduledRecallPayload,
  parseRecurringMessagePayload: mocks.parseRecurringMessagePayload,
  parseUpdateRecallRulePayload: mocks.parseUpdateRecallRulePayload,
  parseManualNotificationPayload: mocks.parseManualNotificationPayload,
}));

vi.mock("@/lib/recalls/persistence", () => ({
  createRecallRuleRecord: mocks.createRecallRuleRecord,
  upsertAppointmentReminderRuleRecord: mocks.upsertAppointmentReminderRuleRecord,
  createScheduledRecallRecord: mocks.createScheduledRecallRecord,
  deleteRecallRuleRecord: mocks.deleteRecallRuleRecord,
  upsertRecurringMessageConfigRecord: mocks.upsertRecurringMessageConfigRecord,
  updateRecallRuleRecord: mocks.updateRecallRuleRecord,
  deleteScheduledRecallRecord: mocks.deleteScheduledRecallRecord,
  buildManualNotificationContext: mocks.loadManualNotificationContext,
  buildManualNotificationMessage: mocks.formatManualNotificationMessage,
}));

vi.mock("@/lib/recalls/side-effects", () => ({
  deliverManualNotification: mocks.deliverManualNotification,
  revalidateRichiami: mocks.revalidateRichiami,
}));

import {
  createRecallRule,
  deleteRecallRule,
  sendManualNotification,
  updateAppointmentReminderRule,
  updateRecurringConfig,
  updateRecallRule,
  scheduleRecall,
  deleteScheduledRecall,
} from "@/app/[locale]/(app)/richiami/actions";

describe("richiami actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((url: string) => {
      throw { digest: `NEXT_REDIRECT:${url}` };
    });
    mocks.requireUser.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    mocks.createRecallRuleRecord.mockResolvedValue(undefined);
    mocks.upsertAppointmentReminderRuleRecord.mockResolvedValue(undefined);
    mocks.createScheduledRecallRecord.mockResolvedValue(undefined);
    mocks.deleteRecallRuleRecord.mockResolvedValue(undefined);
    mocks.upsertRecurringMessageConfigRecord.mockResolvedValue(undefined);
    mocks.updateRecallRuleRecord.mockResolvedValue(undefined);
    mocks.deleteScheduledRecallRecord.mockResolvedValue(undefined);
    mocks.deliverManualNotification.mockResolvedValue(undefined);
  });

  it("persists rule/config mutations and revalidates the richiami area", async () => {
    const createPayload = { rule: "create" };
    const reminderPayload = { rule: "reminder" };
    const scheduledPayload = { recall: "scheduled" };
    const recurringPayload = { recurring: true };
    const updatePayload = { rule: "update" };

    mocks.parseCreateRecallRulePayload.mockReturnValue(createPayload);
    mocks.parseAppointmentReminderRulePayload.mockReturnValue(reminderPayload);
    mocks.parseScheduledRecallPayload.mockReturnValue(scheduledPayload);
    mocks.parseRecurringMessagePayload.mockReturnValue(recurringPayload);
    mocks.parseUpdateRecallRulePayload.mockReturnValue(updatePayload);

    await createRecallRule(new FormData());
    await updateAppointmentReminderRule(new FormData());
    await scheduleRecall(new FormData());
    await updateRecurringConfig(new FormData());
    await updateRecallRule(new FormData());

    expect(mocks.createRecallRuleRecord).toHaveBeenCalledWith(createPayload);
    expect(mocks.upsertAppointmentReminderRuleRecord).toHaveBeenCalledWith(reminderPayload);
    expect(mocks.createScheduledRecallRecord).toHaveBeenCalledWith(scheduledPayload);
    expect(mocks.upsertRecurringMessageConfigRecord).toHaveBeenCalledWith(recurringPayload);
    expect(mocks.updateRecallRuleRecord).toHaveBeenCalledWith(updatePayload);
    expect(mocks.revalidateRichiami).toHaveBeenCalledTimes(5);
  });

  it("validates delete actions before calling persistence", async () => {
    const ruleForm = new FormData();
    const recallForm = new FormData();

    await expect(deleteRecallRule(ruleForm)).rejects.toThrow("Regola non valida");
    await expect(deleteScheduledRecall(recallForm)).rejects.toThrow("Richiamo non valido");

    ruleForm.set("ruleId", "rule-1");
    recallForm.set("recallId", "recall-1");

    await deleteRecallRule(ruleForm);
    await deleteScheduledRecall(recallForm);

    expect(mocks.deleteRecallRuleRecord).toHaveBeenCalledWith("rule-1");
    expect(mocks.deleteScheduledRecallRecord).toHaveBeenCalledWith("recall-1");
    expect(mocks.revalidateRichiami).toHaveBeenCalledTimes(2);
  });

  it("delivers manual notifications and redirects with success state", async () => {
    const formData = new FormData();
    formData.set("returnTo", "/richiami/manuale");

    mocks.parseManualNotificationPayload.mockReturnValue({
      channel: "SMS",
      notificationType: "appointment",
      returnTo: "/richiami/manuale",
    });
    mocks.loadManualNotificationContext.mockResolvedValue({
      patient: {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "+39123456789",
        email: null,
      },
      eventLabel: "Richiamo",
      eventDate: "2026-04-08",
      message: "Promemoria",
      emailSubject: "Avviso",
    });
    mocks.formatManualNotificationMessage.mockReturnValue("Messaggio pronto");

    await expect(sendManualNotification(formData)).rejects.toMatchObject({
      digest: "NEXT_REDIRECT:/richiami/manuale?manualSuccess=Notifica%20inviata%20con%20successo.",
    });

    expect(mocks.deliverManualNotification).toHaveBeenCalledWith({
      user: { id: "user-1", role: "ADMIN" },
      patient: {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "+39123456789",
        email: null,
      },
      channel: "SMS",
      message: "Messaggio pronto",
      emailSubject: "Avviso",
      notificationType: "appointment",
    });
    expect(mocks.revalidateRichiami).toHaveBeenCalledTimes(1);
  });

  it("redirects back with an encoded error when manual delivery fails", async () => {
    const formData = new FormData();
    formData.set("returnTo", "/richiami/manuale");

    mocks.parseManualNotificationPayload.mockReturnValue({
      channel: "SMS",
      notificationType: "appointment",
      returnTo: "/richiami/manuale",
    });
    mocks.loadManualNotificationContext.mockResolvedValue({
      patient: {
        id: "patient-1",
        firstName: "Mario",
        lastName: "Rossi",
        phone: "+39123456789",
        email: null,
      },
      eventLabel: "Richiamo",
      eventDate: "2026-04-08",
      message: "Promemoria",
      emailSubject: "Avviso",
    });
    mocks.formatManualNotificationMessage.mockReturnValue("Messaggio pronto");
    mocks.deliverManualNotification.mockRejectedValue(new Error("Numero paziente mancante"));

    await expect(sendManualNotification(formData)).rejects.toMatchObject({
      digest: "NEXT_REDIRECT:/richiami/manuale?manualError=Numero%20paziente%20mancante",
    });
  });
});
