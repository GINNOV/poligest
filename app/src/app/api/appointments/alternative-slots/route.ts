import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/error-response";
import { prisma } from "@/lib/prisma";
import { ASSISTANT_ROLE } from "@/lib/roles";
import { calendarOccupyingAppointmentFilter } from "@/lib/appointments/agenda-domain";
import { findAlternativeSlots } from "@/lib/appointments/find-alternative-slots";
import { parseDateAtMidnightInTimeZone } from "@/lib/user-display-time-zone";
import { DEFAULT_PRACTICE_TIME_ZONE } from "@/lib/practice-time-zone";
import { getOptionalPrismaModel } from "@/lib/prisma-models";

export async function GET(req: Request) {
  await requireUser([Role.ADMIN, Role.MANAGER, ASSISTANT_ROLE, Role.SECRETARY]);

  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId")?.trim() ?? "";
    const date = searchParams.get("date")?.trim() ?? "";
    const durationMinutes = Number.parseInt(searchParams.get("durationMinutes") ?? "", 10);
    const excludeId = searchParams.get("excludeId")?.trim() || undefined;
    const timeZone = searchParams.get("timeZone")?.trim() || DEFAULT_PRACTICE_TIME_ZONE;

    if (!doctorId || !date || Number.isNaN(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json({ slots: [], blockedReason: "Parametri di ricerca non validi." });
    }

    const dayStart = parseDateAtMidnightInTimeZone(date, timeZone);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const availabilityClient = getOptionalPrismaModel<{
      findMany: (args: unknown) => Promise<
        Array<{ doctorId: string; dayOfWeek: number; startMinute: number; endMinute: number }>
      >;
    }>("doctorAvailabilityWindow");
    const closureClient = getOptionalPrismaModel<{
      findMany: (args: unknown) => Promise<
        Array<{ startsAt: Date; endsAt: Date; title: string | null; type: string }>
      >;
    }>("practiceClosure");
    const weeklyClosureClient = getOptionalPrismaModel<{
      findMany: (args: unknown) => Promise<Array<{ dayOfWeek: number; title: string | null }>>;
    }>("practiceWeeklyClosure");
    const timeOffClient = getOptionalPrismaModel<{
      findMany: (args: unknown) => Promise<
        Array<{ doctorId: string; startsAt: Date; endsAt: Date; title: string | null }>
      >;
    }>("doctorTimeOff");

    const [appointments, availabilityWindows, practiceClosures, practiceWeeklyClosures, doctorTimeOffs] =
      await Promise.all([
        prisma.appointment.findMany({
          where: {
            ...calendarOccupyingAppointmentFilter(),
            doctorId,
            id: excludeId ? { not: excludeId } : undefined,
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
          select: { startsAt: true, endsAt: true },
          orderBy: { startsAt: "asc" },
        }),
        availabilityClient?.findMany
          ? availabilityClient.findMany({
              where: { doctorId },
              select: {
                doctorId: true,
                dayOfWeek: true,
                startMinute: true,
                endMinute: true,
              },
            })
          : Promise.resolve([]),
        closureClient?.findMany
          ? closureClient.findMany({
              where: {
                startsAt: { lt: dayEnd },
                endsAt: { gt: dayStart },
              },
              select: { startsAt: true, endsAt: true, title: true, type: true },
            })
          : Promise.resolve([]),
        weeklyClosureClient?.findMany
          ? weeklyClosureClient.findMany({
              where: { isActive: true },
              select: { dayOfWeek: true, title: true },
            })
          : Promise.resolve([]),
        timeOffClient?.findMany
          ? timeOffClient.findMany({
              where: {
                doctorId,
                startsAt: { lt: dayEnd },
                endsAt: { gt: dayStart },
              },
              select: { doctorId: true, startsAt: true, endsAt: true, title: true },
            })
          : Promise.resolve([]),
      ]);

    const result = findAlternativeSlots({
      date,
      durationMinutes,
      doctorId,
      timeZone,
      existingAppointments: appointments,
      availabilityWindows,
      practiceClosures: practiceClosures.map((closure) => ({
        startsAt: closure.startsAt.toISOString(),
        endsAt: closure.endsAt.toISOString(),
        title: closure.title,
        type: closure.type,
      })),
      practiceWeeklyClosures,
      doctorTimeOffs: doctorTimeOffs.map((timeOff) => ({
        doctorId: timeOff.doctorId,
        startsAt: timeOff.startsAt.toISOString(),
        endsAt: timeOff.endsAt.toISOString(),
        title: timeOff.title,
      })),
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse({
      message: "Errore ricerca slot alternativi",
      status: 500,
      source: "appointment_alternative_slots",
      path: new URL(req.url).pathname,
      error,
    });
  }
}