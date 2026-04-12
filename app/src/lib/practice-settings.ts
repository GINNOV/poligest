import { cache } from "react";
import {
  DEFAULT_PRACTICE_TIME_ZONE,
  PRACTICE_SETTINGS_ID,
  isPracticeTimeZone,
} from "@/lib/practice-time-zone";
import {
  getOptionalPrismaModel,
  isMissingPrismaModelError,
  runOptionalPrismaQuery,
} from "@/lib/prisma-models";

export const getPracticeTimeZone = cache(async () => {
  const practiceSettingClient = getOptionalPrismaModel<{
    findUnique?: (args: {
      where: { id: string };
      select: { timeZone: true };
    }) => Promise<{ timeZone: string } | null>;
  }>("practiceSetting");

  const result = await runOptionalPrismaQuery(
    practiceSettingClient?.findUnique
      ? () =>
          practiceSettingClient.findUnique!({
            where: { id: PRACTICE_SETTINGS_ID },
            select: { timeZone: true },
          })
      : undefined,
    null,
  );

  const settings = result.value;

  return isPracticeTimeZone(settings?.timeZone) ? settings.timeZone : DEFAULT_PRACTICE_TIME_ZONE;
});

export async function savePracticeTimeZone(timeZone: string) {
  const normalized = isPracticeTimeZone(timeZone) ? timeZone : DEFAULT_PRACTICE_TIME_ZONE;
  const practiceSettingClient = getOptionalPrismaModel<{
    upsert?: (args: {
      where: { id: string };
      create: { id: string; timeZone: string };
      update: { timeZone: string };
    }) => Promise<unknown>;
  }>("practiceSetting");

  if (!practiceSettingClient?.upsert) {
    return normalized;
  }

  try {
    await practiceSettingClient.upsert({
      where: { id: PRACTICE_SETTINGS_ID },
      create: {
        id: PRACTICE_SETTINGS_ID,
        timeZone: normalized,
      },
      update: {
        timeZone: normalized,
      },
    });
  } catch (error) {
    if (!isMissingPrismaModelError(error)) {
      throw error;
    }
  }

  return normalized;
}
