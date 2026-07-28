import { describe, expect, it } from "vitest";
import {
  AppointmentShiftHoverCallout,
  useAppointmentShiftHover,
} from "@/components/appointment-shift-hover-callout";

describe("AppointmentShiftHoverCallout and hook", () => {
  it("exports hook and component functions", () => {
    expect(typeof useAppointmentShiftHover).toBe("function");
    expect(typeof AppointmentShiftHoverCallout).toBe("function");
  });

  it("does not throw when rendered with empty state", () => {
    const res = AppointmentShiftHoverCallout({
      hoveredAppt: null,
      isShiftPressed: false,
      mousePos: { x: 100, y: 100 },
    });
    expect(res).toBeNull();
  });

  it("does not render if shift is not pressed", () => {
    const appt = {
      id: "a1",
      title: "Controllo",
      startsAt: "2026-07-28T10:00:00.000Z",
      endsAt: "2026-07-28T10:30:00.000Z",
      hStart: 10,
      mStart: 0,
      hEnd: 10,
      mEnd: 30,
      serviceType: "Igiene",
      patientName: "Mario Rossi",
      patientId: "p1",
      doctorId: "d1",
      status: "CONFIRMED",
    };

    const res = AppointmentShiftHoverCallout({
      hoveredAppt: appt,
      isShiftPressed: false,
      mousePos: { x: 100, y: 100 },
    });
    expect(res).toBeNull();
  });
});
