"use client";

export type CalendarAppointment = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  hStart: number;
  mStart: number;
  hEnd: number;
  mEnd: number;
  serviceType: string;
  patientName: string;
  patientId: string;
  doctorId: string | null;
  status: string;
  notes?: string | null;
};

export type PositionedAppointment = CalendarAppointment & {
  startMinute: number;
  endMinute: number;
  columnIndex: number;
  columnCount: number;
};

export const overlaps = (a: { startMinute: number; endMinute: number }, b: { startMinute: number; endMinute: number }) =>
  a.startMinute < b.endMinute && b.startMinute < a.endMinute;

export const buildPositionedAppointments = (appointments: CalendarAppointment[]): PositionedAppointment[] => {
  const items = appointments.map((appt, index) => {
    const startMinute = appt.hStart * 60 + appt.mStart;
    const endMinute = appt.hEnd * 60 + appt.mEnd;
    return { appt, index, startMinute, endMinute };
  });

  const layout = new Map<number, { columnIndex: number; columnCount: number }>();
  const visited = new Set<number>();

  for (let i = 0; i < items.length; i += 1) {
    const seed = items[i];
    if (visited.has(seed.index)) continue;
    const stack = [seed];
    const component: typeof items = [];
    visited.add(seed.index);

    while (stack.length) {
      const current = stack.pop();
      if (!current) break;
      component.push(current);
      for (const candidate of items) {
        if (visited.has(candidate.index)) continue;
        if (overlaps(current, candidate)) {
          visited.add(candidate.index);
          stack.push(candidate);
        }
      }
    }

    component.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
    const columnEnds: number[] = [];
    const assigned = new Map<number, number>();

    component.forEach((item) => {
      let columnIndex = columnEnds.findIndex((end) => end <= item.startMinute);
      if (columnIndex === -1) {
        columnIndex = columnEnds.length;
        columnEnds.push(item.endMinute);
      } else {
        columnEnds[columnIndex] = item.endMinute;
      }
      assigned.set(item.index, columnIndex);
    });

    const columnCount = Math.max(1, columnEnds.length);
    assigned.forEach((columnIndex, index) => {
      layout.set(index, { columnIndex, columnCount });
    });
  }

  return items.map((item) => {
    const placement = layout.get(item.index) ?? { columnIndex: 0, columnCount: 1 };
    return {
      ...item.appt,
      startMinute: item.startMinute,
      endMinute: item.endMinute,
      columnIndex: placement.columnIndex,
      columnCount: placement.columnCount,
    };
  });
};
