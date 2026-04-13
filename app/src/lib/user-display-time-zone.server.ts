import { cookies } from "next/headers";
import { USER_TIME_ZONE_COOKIE } from "@/lib/app-preferences";
import { getPracticeTimeZone } from "@/lib/practice-settings";
import { resolveUserDisplayTimeZone } from "@/lib/user-display-time-zone";

export async function getUserDisplayTimeZone() {
  const fallback = await getPracticeTimeZone();
  const cookieStore = await cookies();
  return resolveUserDisplayTimeZone(cookieStore.get(USER_TIME_ZONE_COOKIE)?.value, fallback);
}
