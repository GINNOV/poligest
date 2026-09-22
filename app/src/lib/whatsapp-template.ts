export const WHATSAPP_TEMPLATE_NAME = "Promemoria WhatsApp";

import { APP_BRAND_NAME } from "@/lib/brand";
import { MESSAGE_PLACEHOLDER_KEYS } from "@/lib/placeholder-data";

export const DEFAULT_WHATSAPP_TEMPLATE =
  `Ciao {{nome}}, ti ricordiamo il tuo appuntamento presso lo studio. E' fissato per {{data_appuntamento}} con il dottore {{dottore}}. Per maggiori informazioni visita https://sorrisosplendente.com. A presto e ricordati: ${APP_BRAND_NAME} con noi!`;

export type WhatsappTemplateData = {
  firstName: string;
  lastName: string;
  doctorName: string;
  appointmentDate: string;
  serviceType: string;
  notes: string;
};

const messageTokens = {
  nome: (data: WhatsappTemplateData) => data.firstName,
  cognome: (data: WhatsappTemplateData) => data.lastName,
  dottore: (data: WhatsappTemplateData) => data.doctorName,
  data_appuntamento: (data: WhatsappTemplateData) => data.appointmentDate,
  motivo_visita: (data: WhatsappTemplateData) => data.serviceType,
  note: (data: WhatsappTemplateData) => data.notes,
} satisfies Record<(typeof MESSAGE_PLACEHOLDER_KEYS)[number], (data: WhatsappTemplateData) => string>;

export function renderWhatsappTemplate(template: string, data: WhatsappTemplateData) {
  return MESSAGE_PLACEHOLDER_KEYS.reduce(
    (output, key) => output.replaceAll(`{{${key}}}`, messageTokens[key](data)),
    template,
  );
}
