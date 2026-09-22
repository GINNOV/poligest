import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarWeekView } from "@/components/calendar-week-view";
import { DAY_SLOT_RAIL_PX } from "@/lib/calendar/layout-engine";

describe("calendar week slot rail", () => {
  it("keeps a 36px click rail to the left of appointment cards", () => {
    const html = renderToStaticMarkup(
      <CalendarWeekView
        weekDays={[
          {
            date: "2026-09-22",
            label: "Mar 22",
            isToday: true,
            availabilityWindows: [{ startMinute: 9 * 60, endMinute: 13 * 60, color: "#a78bfa" }],
            appointments: [
              {
                id: "1",
                title: "Devitalizzazione",
                startsAt: "2026-09-22T09:00",
                endsAt: "2026-09-22T10:00",
                hStart: 9,
                mStart: 0,
                hEnd: 10,
                mEnd: 0,
                serviceType: "devitalizzazione",
                patientName: "Rossi",
                patientId: "p1",
                doctorId: null,
                status: "CONFIRMED",
              },
            ],
          },
        ]}
        patients={[]}
        doctors={[]}
        serviceOptions={[]}
        services={[]}
        availabilityWindows={[]}
        practiceClosures={[]}
        practiceWeeklyClosures={[]}
        doctorTimeOffs={[]}
        action={async () => {}}
        updateAction={async () => {}}
        deleteAction={async () => {}}
        displayTimeZone="Europe/Rome"
        returnTo="/calendar"
      />,
    );

    expect(DAY_SLOT_RAIL_PX).toBe(36);
    expect(html).toContain("width:36px");
    expect(html).toContain("36px + (100% - 36px)");
  });
});
