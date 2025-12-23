export type HolidayDefinition = {
  key: string;
  name: string;
  date: Date;
};

export type RecurringMessageDefaults = {
  kind: "HOLIDAY" | "CLOSURE" | "BIRTHDAY";
  subject: string;
  body: string;
  daysBefore?: number;
};

function easterSunday(year: number) {
  // Anonymous Gregorian algorithm.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getItalianHolidays(year: number): HolidayDefinition[] {
  const easter = easterSunday(year);
  const easterMonday = addDays(easter, 1);
  return [
    { key: "capodanno", name: "Capodanno", date: new Date(year, 0, 1) },
    { key: "epifania", name: "Epifania", date: new Date(year, 0, 6) },
    { key: "pasqua", name: "Pasqua", date: easter },
    { key: "pasquetta", name: "Pasquetta", date: easterMonday },
    { key: "liberazione", name: "Festa della Liberazione", date: new Date(year, 3, 25) },
    { key: "lavoro", name: "Festa del Lavoro", date: new Date(year, 4, 1) },
    { key: "repubblica", name: "Festa della Repubblica", date: new Date(year, 5, 2) },
    { key: "ferragosto", name: "Ferragosto", date: new Date(year, 7, 15) },
    { key: "ognissanti", name: "Ognissanti", date: new Date(year, 10, 1) },
    { key: "immacolata", name: "Immacolata Concezione", date: new Date(year, 11, 8) },
    { key: "natale", name: "Natale", date: new Date(year, 11, 25) },
    { key: "santo-stefano", name: "Santo Stefano", date: new Date(year, 11, 26) },
  ];
}

export const RECURRING_MESSAGE_DEFAULTS: RecurringMessageDefaults[] = [
  {
    kind: "HOLIDAY",
    subject: "Auguri per {{holidayName}}",
    body: "Lo studio vi augura una serena {{holidayName}}. Restiamo a disposizione per ogni necessità.",
  },
  {
    kind: "CLOSURE",
    subject: "Chiusura studio: {{closureTitle}}",
    body: "Vi informiamo che lo studio resterà chiuso dal {{closureStart}} al {{closureEnd}} per {{closureTitle}}.",
    daysBefore: 7,
  },
  {
    kind: "BIRTHDAY",
    subject: "Buon compleanno, {{firstName}}!",
    body: "Da parte di tutto il team, tanti auguri di buon compleanno {{firstName}}.",
  },
];

export const TEMPLATE_TOKENS = [
  "firstName",
  "lastName",
  "holidayName",
  "holidayDate",
  "closureTitle",
  "closureStart",
  "closureEnd",
  "birthdayDate",
] as const;

export function applyTemplate(template: string, values: Record<string, string>) {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }
  return output;
}

export function normalizeBirthday(base: Date, year: number) {
  const month = base.getMonth();
  const day = base.getDate();
  if (month === 1 && day === 29) {
    return new Date(year, 1, 28);
  }
  return new Date(year, month, day);
}
