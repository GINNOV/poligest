export type PlaceholderDefinition = {
  key: string;
  label: string;
  description: string;
  example: string;
};

type PlaceholderCopy = Omit<PlaceholderDefinition, "key">;

const definitions = {
  patientName: {
    label: "Nome paziente",
    description: "Nome e cognome del paziente.",
    example: "Mario Rossi",
  },
  patientFirstName: {
    label: "Nome",
    description: "Solo il nome del paziente.",
    example: "Mario",
  },
  patientLastName: {
    label: "Cognome",
    description: "Solo il cognome del paziente.",
    example: "Rossi",
  },
  staffRole: {
    label: "Ruolo staff",
    description: "Ruolo assegnato al nuovo membro dello staff.",
    example: "Segreteria",
  },
  doctorName: {
    label: "Nome medico",
    description: "Nome completo del medico.",
    example: "Dr. Giulia Bianchi",
  },
  appointmentDate: {
    label: "Data appuntamento",
    description: "Data dell'appuntamento.",
    example: "12/03/2026",
  },
  appointmentTime: {
    label: "Ora appuntamento",
    description: "Ora dell'appuntamento.",
    example: "09:30",
  },
  serviceType: {
    label: "Prestazione",
    description: "Servizio che ha generato il richiamo.",
    example: "Igiene",
  },
  clinicName: {
    label: "Nome studio",
    description: "Nome dello studio o clinica.",
    example: "Studio Agovino & Angrisano",
  },
  websiteUrl: {
    label: "Sito web",
    description: "Link al sito dello studio.",
    example: "https://sorrisosplendente.com",
  },
  button: {
    label: "Bottone CTA",
    description: "Bottone call-to-action HTML.",
    example: "<a href=\"https://...\">Apri</a>",
  },
  customNote: {
    label: "Nota personalizzata",
    description: "Messaggio aggiuntivo facoltativo.",
    example: "Ricorda di portare i referti.",
  },
  firstName: {
    label: "Nome",
    description: "Nome del paziente.",
    example: "Mario",
  },
  lastName: {
    label: "Cognome",
    description: "Cognome del paziente.",
    example: "Rossi",
  },
  holidayName: {
    label: "Festività",
    description: "Nome della festività.",
    example: "Natale",
  },
  holidayDate: {
    label: "Data festività",
    description: "Data della festività.",
    example: "25/12/2026",
  },
  closureTitle: {
    label: "Titolo chiusura",
    description: "Motivo o titolo della chiusura.",
    example: "Ferie estive",
  },
  closureStart: {
    label: "Inizio chiusura",
    description: "Primo giorno di chiusura.",
    example: "10/08/2026",
  },
  closureEnd: {
    label: "Fine chiusura",
    description: "Ultimo giorno di chiusura.",
    example: "20/08/2026",
  },
  birthdayDate: {
    label: "Data compleanno",
    description: "Data del compleanno nell'anno corrente.",
    example: "12/03/2026",
  },
  nome: {
    label: "Nome",
    description: "Nome del paziente.",
    example: "Mario",
  },
  cognome: {
    label: "Cognome",
    description: "Cognome del paziente.",
    example: "Rossi",
  },
  dottore: {
    label: "Dottore",
    description: "Medico assegnato all'appuntamento.",
    example: "Dr. Bianchi",
  },
  data_appuntamento: {
    label: "Data appuntamento",
    description: "Data e ora del prossimo appuntamento.",
    example: "12/03/2026, 09:30",
  },
  motivo_visita: {
    label: "Motivo visita",
    description: "Tipo di trattamento o visita.",
    example: "Igiene",
  },
  note: {
    label: "Note",
    description: "Note dell'appuntamento, se presenti.",
    example: "Portare gli esami",
  },
} satisfies Record<string, PlaceholderCopy>;

function define(keys: readonly string[]): PlaceholderDefinition[] {
  return keys.map((key) => {
    const copy = definitions[key as keyof typeof definitions];
    if (!copy) {
      throw new Error(`Manca la descrizione del segnaposto ${key}.`);
    }
    return { key, ...copy };
  });
}

export const EMAIL_PLACEHOLDER_KEYS = [
  "patientName",
  "staffRole",
  "doctorName",
  "appointmentDate",
  "appointmentTime",
  "clinicName",
  "websiteUrl",
  "button",
  "customNote",
] as const;

export const MESSAGE_PLACEHOLDER_KEYS = [
  "nome",
  "cognome",
  "dottore",
  "data_appuntamento",
  "motivo_visita",
  "note",
] as const;

export const RECALL_PLACEHOLDER_KEYS = [
  "patientName",
  "patientFirstName",
  "patientLastName",
  "serviceType",
  "clinicName",
  "websiteUrl",
  "customNote",
] as const;

export const APPOINTMENT_REMINDER_PLACEHOLDER_KEYS = [
  "patientName",
  "appointmentDate",
  "appointmentTime",
  "doctorName",
  "clinicName",
  "websiteUrl",
  "customNote",
] as const;

export const RECURRING_PLACEHOLDER_KEYS = {
  HOLIDAY: ["firstName", "lastName", "holidayName", "holidayDate"],
  CLOSURE: ["firstName", "lastName", "closureTitle", "closureStart", "closureEnd"],
  BIRTHDAY: ["firstName", "lastName", "birthdayDate"],
} as const;

export type RecurringPlaceholderKind = keyof typeof RECURRING_PLACEHOLDER_KEYS;

export function placeholderValues<const T extends readonly string[]>(
  _keys: T,
  values: Record<T[number], string>,
) {
  return values;
}

export const placeholderCatalog = define(EMAIL_PLACEHOLDER_KEYS);
export const messagePlaceholders = define(MESSAGE_PLACEHOLDER_KEYS);
export const recallPlaceholders = define(RECALL_PLACEHOLDER_KEYS);
export const appointmentReminderPlaceholders = define(APPOINTMENT_REMINDER_PLACEHOLDER_KEYS);

export function recurringPlaceholders(kind: RecurringPlaceholderKind) {
  return define(RECURRING_PLACEHOLDER_KEYS[kind]);
}

export const previewData: Record<string, string> = {
  patientName: "Mario Rossi",
  staffRole: "Segreteria",
  doctorName: "Dr. Giulia Bianchi",
  appointmentDate: "12/03/2026",
  appointmentTime: "09:30",
  clinicName: "Studio Agovino & Angrisano",
  websiteUrl: "https://sorrisosplendente.com",
  customNote: "Ricorda di arrivare 10 minuti prima.",
};

export function insertPlaceholderToken(value: string, start: number, end: number, key: string) {
  const token = `{{${key}}}`;
  return {
    value: value.slice(0, start) + token + value.slice(end),
    cursor: start + token.length,
  };
}
