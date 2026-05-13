import { describe, expect, it } from "vitest";
import { computeSchedulingWarning } from "@/lib/scheduling-warnings";

const baseParams = {
  doctorId: "doctor-1",
  startsAt: "2026-05-13T10:00",
  endsAt: "2026-05-13T11:00",
  availabilityWindows: [
    {
      doctorId: "doctor-1",
      dayOfWeek: 3,
      startMinute: 9 * 60,
      endMinute: 12 * 60,
    },
  ],
};

describe("computeSchedulingWarning", () => {
  it("can bypass closure warnings while preserving availability warnings", () => {
    const closureBypassWarning = computeSchedulingWarning({
      ...baseParams,
      ignorePracticeClosureWarnings: true,
      practiceClosures: [
        {
          startsAt: "2026-05-13T00:00:00.000Z",
          endsAt: "2026-05-14T00:00:00.000Z",
          title: "Chiusura",
        },
      ],
      practiceWeeklyClosures: [{ dayOfWeek: 3, title: "Chiuso" }],
    });

    expect(closureBypassWarning).toBeNull();

    const closedDayWithoutAvailabilityWarning = computeSchedulingWarning({
      ...baseParams,
      startsAt: "2026-05-14T10:00",
      endsAt: "2026-05-14T11:00",
      ignorePracticeClosureWarnings: true,
      practiceClosures: [],
      practiceWeeklyClosures: [{ dayOfWeek: 4, title: "Chiuso per riposo" }],
    });

    expect(closedDayWithoutAvailabilityWarning).toBeNull();

    const availabilityWarning = computeSchedulingWarning({
      ...baseParams,
      startsAt: "2026-05-13T13:00",
      endsAt: "2026-05-13T14:00",
      ignorePracticeClosureWarnings: true,
      practiceClosures: [],
      practiceWeeklyClosures: [],
    });

    expect(availabilityWarning).toContain("fuori dalla disponibilità del medico");
  });

  it("can bypass doctor availability warnings independently from closure warnings", () => {
    const availabilityBypassWarning = computeSchedulingWarning({
      ...baseParams,
      startsAt: "2026-05-13T13:00",
      endsAt: "2026-05-13T14:00",
      ignoreDoctorAvailabilityWarnings: true,
      practiceClosures: [],
      practiceWeeklyClosures: [],
    });

    expect(availabilityBypassWarning).toBeNull();

    const closureWarning = computeSchedulingWarning({
      ...baseParams,
      ignoreDoctorAvailabilityWarnings: true,
      practiceClosures: [],
      practiceWeeklyClosures: [{ dayOfWeek: 3, title: "Chiuso" }],
    });

    expect(closureWarning).toContain("Lo studio risulta chiuso");
  });
});
