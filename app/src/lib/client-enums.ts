export const APPOINTMENT_TITLES = [
  "Altro",
  "Continuazione",
  "Prima visita",
  "Richiamo",
  "Urgenza",
] as const;

export type AppointmentTitle = (typeof APPOINTMENT_TITLES)[number];

export const DEFAULT_APPOINTMENT_TITLE: Exclude<AppointmentTitle, "Altro"> = "Prima visita";

export const PREDEFINED_APPOINTMENT_TITLES = APPOINTMENT_TITLES.filter(
  (title): title is Exclude<AppointmentTitle, "Altro"> => title !== "Altro"
);

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
