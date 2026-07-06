import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  parseCreateRecallRulePayload: vi.fn(),
  parseAppointmentReminderRulePayload: vi.fn(),
  parseScheduledRecallPayload: vi.fn(),
  parseRecurringMessagePayload: vi.fn(),
  parseUpdateRecallRulePayload: vi.fn(),
  createRecallRuleRecord: vi.fn(),
  upsertAppointmentReminderRuleRecord: vi.fn(),
  createScheduledRecallRecord: vi.fn(),
  deleteRecallRuleRecord: vi.fn(),
  upsertRecurringMessageConfigRecord: vi.fn(),
  updateRecallRuleRecord: vi.fn(),
  deleteScheduledRecallRecord: vi.fn(),
  dismissRecallDeliveryFailureRecord: vi.fn(),
  revalidateRichiami: vi.fn(),
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
}));

vi.mock("@/lib/recalls/persistence", () => ({
  createRecallRuleRecord: mocks.createRecallRuleRecord,
  upsertAppointmentReminderRuleRecord: mocks.upsertAppointmentReminderRuleRecord,
  createScheduledRecallRecord: mocks.createScheduledRecallRecord,
  deleteRecallRuleRecord: mocks.deleteRecallRuleRecord,
  upsertRecurringMessageConfigRecord: mocks.upsertRecurringMessageConfigRecord,
  updateRecallRuleRecord: mocks.updateRecallRuleRecord,
  deleteScheduledRecallRecord: mocks.deleteScheduledRecallRecord,
  dismissRecallDeliveryFailureRecord: mocks.dismissRecallDeliveryFailureRecord,
}));

vi.mock("@/lib/recalls/side-effects", () => ({
  revalidateRichiami: mocks.revalidateRichiami,
}));

import {
  createRecallRule,
  deleteRecallRule,
  updateAppointmentReminderRule,
  updateRecurringConfig,
  updateRecallRule,
  scheduleRecall,
  deleteScheduledRecall,
  dismissRecallDeliveryFailure,
} from "@/app/[locale]/(app)/richiami/actions";

describe("richiami actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    mocks.createRecallRuleRecord.mockResolvedValue(undefined);
    mocks.upsertAppointmentReminderRuleRecord.mockResolvedValue(undefined);
    mocks.createScheduledRecallRecord.mockResolvedValue(undefined);
    mocks.deleteRecallRuleRecord.mockResolvedValue(undefined);
    mocks.upsertRecurringMessageConfigRecord.mockResolvedValue(undefined);
    mocks.updateRecallRuleRecord.mockResolvedValue(undefined);
    mocks.deleteScheduledRecallRecord.mockResolvedValue(undefined);
    mocks.dismissRecallDeliveryFailureRecord.mockResolvedValue(undefined);
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

  it("dismisses a failed delivery notification and revalidates richiami", async () => {
    const form = new FormData();
    form.set("recallId", "recall-1");

    await dismissRecallDeliveryFailure(form);

    expect(mocks.dismissRecallDeliveryFailureRecord).toHaveBeenCalledWith("recall-1");
    expect(mocks.revalidateRichiami).toHaveBeenCalledTimes(1);
  });

  it("rejects failed delivery dismissal without a recall id", async () => {
    await expect(dismissRecallDeliveryFailure(new FormData())).rejects.toThrow("Richiamo non valido");

    expect(mocks.dismissRecallDeliveryFailureRecord).not.toHaveBeenCalled();
  });
});
