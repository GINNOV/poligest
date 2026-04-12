import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PRACTICE_TIME_ZONE,
  PRACTICE_SETTINGS_ID,
  isPracticeTimeZone,
} from "@/lib/practice-time-zone";

export const getPracticeTimeZone = cache(async () => {
  const settings = await prisma.practiceSetting.findUnique({
    where: { id: PRACTICE_SETTINGS_ID },
    select: { timeZone: true },
  });

  return isPracticeTimeZone(settings?.timeZone) ? settings.timeZone : DEFAULT_PRACTICE_TIME_ZONE;
});

export async function savePracticeTimeZone(timeZone: string) {
  const normalized = isPracticeTimeZone(timeZone) ? timeZone : DEFAULT_PRACTICE_TIME_ZONE;

  await prisma.practiceSetting.upsert({
    where: { id: PRACTICE_SETTINGS_ID },
    create: {
      id: PRACTICE_SETTINGS_ID,
      timeZone: normalized,
    },
    update: {
      timeZone: normalized,
    },
  });

  return normalized;
}
