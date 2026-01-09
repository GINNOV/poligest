export type PlaceholderDefinition = {
  key: string;
  label: string;
  description: string;
  example: string;
};

export const placeholderCatalog: PlaceholderDefinition[] = [
  {
    key: "patientName",
    label: "Nome paziente",
    description: "Nome completo del paziente.",
    example: "Mario Rossi",
  },
  {
    key: "doctorName",
    label: "Nome medico",
    description: "Nome completo del medico.",
    example: "Dr. Giulia Bianchi",
  },
  {
    key: "appointmentDate",
    label: "Data appuntamento",
    description: "Data dell'appuntamento.",
    example: "12/03/2026",
  },
  {
    key: "appointmentTime",
    label: "Ora appuntamento",
    description: "Ora dell'appuntamento.",
    example: "09:30",
  },
  {
    key: "clinicName",
    label: "Nome studio",
    description: "Nome dello studio o clinica.",
    example: "Sorriso Splendente",
  },
  {
    key: "websiteUrl",
    label: "Sito web",
    description: "Link al sito dello studio.",
    example: "https://sorrisosplendente.com",
  },
  {
    key: "button",
    label: "Bottone CTA",
    description: "Bottone call-to-action HTML.",
    example: "<a href=\"https://...\">Apri</a>",
  },
  {
    key: "customNote",
    label: "Nota personalizzata",
    description: "Messaggio aggiuntivo facoltativo.",
    example: "Ricorda di portare i referti.",
  },
];

export const previewData: Record<string, string> = {
  patientName: "Mario Rossi",
  doctorName: "Dr. Giulia Bianchi",
  appointmentDate: "12/03/2026",
  appointmentTime: "09:30",
  clinicName: "Sorriso Splendente",
  websiteUrl: "https://sorrisosplendente.com",
  customNote: "Ricorda di arrivare 10 minuti prima.",
};
