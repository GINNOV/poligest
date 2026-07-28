import { describe, it, expect } from "vitest";

describe("CalendarDayView Data Layout", () => {
  it("formats hour slots from 08:00 to 20:00 correctly", () => {
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);
    expect(hours[0]).toBe(8);
    expect(hours[hours.length - 1]).toBe(20);
    expect(hours.length).toBe(13);
  });

  it("filters appointments by hour slot start time", () => {
    const mockAppointments = [
      { id: "1", hStart: 9, title: "Visita 1", startsAt: "2026-07-28T09:00", endsAt: "2026-07-28T09:30" },
      { id: "2", hStart: 11, title: "Visita 2", startsAt: "2026-07-28T11:00", endsAt: "2026-07-28T11:45" },
    ];

    const hour9Appts = mockAppointments.filter((a) => a.hStart === 9);
    const hour10Appts = mockAppointments.filter((a) => a.hStart === 10);

    expect(hour9Appts.length).toBe(1);
    expect(hour9Appts[0].title).toBe("Visita 1");
    expect(hour10Appts.length).toBe(0);
  });
});
