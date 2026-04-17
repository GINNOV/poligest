import { describe, expect, it } from "vitest";
import { buildPositionedAppointments, CalendarAppointment } from "../layout-engine";

const mockAppt = (id: string, start: string, end: string): CalendarAppointment => ({
  id,
  title: `Appt ${id}`,
  startsAt: start,
  endsAt: end,
  serviceType: "visita",
  patientName: "Patient X",
  patientId: "p1",
  doctorId: "d1",
  status: "CONFIRMED",
});

describe("Calendar Layout Engine", () => {
  it("handles a single appointment correctly", () => {
    const appts = [mockAppt("1", "2026-04-16T10:00:00", "2026-04-16T11:00:00")];
    const positioned = buildPositionedAppointments(appts);
    expect(positioned).toHaveLength(1);
    expect(positioned[0].columnIndex).toBe(0);
    expect(positioned[0].columnCount).toBe(1);
  });

  it("positions non-overlapping appointments in the same column index 0", () => {
    const appts = [
      mockAppt("1", "2026-04-16T09:00:00", "2026-04-16T10:00:00"),
      mockAppt("2", "2026-04-16T10:00:00", "2026-04-16T11:00:00"),
    ];
    const positioned = buildPositionedAppointments(appts);
    expect(positioned[0].columnIndex).toBe(0);
    expect(positioned[1].columnIndex).toBe(0);
    expect(positioned[0].columnCount).toBe(1);
    expect(positioned[1].columnCount).toBe(1);
  });

  it("detects simple overlap and splits into two columns", () => {
    const appts = [
      mockAppt("1", "2026-04-16T10:00:00", "2026-04-16T11:00:00"),
      mockAppt("2", "2026-04-16T10:30:00", "2026-04-16T11:30:00"),
    ];
    const positioned = buildPositionedAppointments(appts);
    expect(positioned[0].columnCount).toBe(2);
    expect(positioned[1].columnCount).toBe(2);
    expect(positioned[0].columnIndex).not.toBe(positioned[1].columnIndex);
  });

  it("handles complex cascading overlaps", () => {
    // A: 10:00 - 11:00
    // B: 10:30 - 11:30 (overlaps A)
    // C: 11:15 - 12:15 (overlaps B, but NOT A)
    const appts = [
      mockAppt("A", "2026-04-16T10:00:00", "2026-04-16T11:00:00"),
      mockAppt("B", "2026-04-16T10:30:00", "2026-04-16T11:30:00"),
      mockAppt("C", "2026-04-16T11:15:00", "2026-04-16T12:15:00"),
    ];
    const positioned = buildPositionedAppointments(appts);
    
    // They are all in the same "component" because they cascade
    expect(positioned[0].columnCount).toBe(2);
    expect(positioned[1].columnCount).toBe(2);
    expect(positioned[2].columnCount).toBe(2);

    // C should take column 0 because A is finished
    const apptA = positioned.find(p => p.id === "A")!;
    const apptC = positioned.find(p => p.id === "C")!;
    expect(apptA.columnIndex).toBe(0);
    expect(apptC.columnIndex).toBe(0);
  });

  it("calculates correct columnCount for three simultaneous overlaps", () => {
    const appts = [
      mockAppt("1", "2026-04-16T10:00:00", "2026-04-16T11:00:00"),
      mockAppt("2", "2026-04-16T10:00:00", "2026-04-16T11:00:00"),
      mockAppt("3", "2026-04-16T10:00:00", "2026-04-16T11:00:00"),
    ];
    const positioned = buildPositionedAppointments(appts);
    expect(positioned[0].columnCount).toBe(3);
    expect(new Set(positioned.map(p => p.columnIndex)).size).toBe(3);
  });
});
