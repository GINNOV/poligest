export const APPOINTMENT_STATUSES = [
  "TO_CONFIRM",
  "CONFIRMED",
  "IN_WAITING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
