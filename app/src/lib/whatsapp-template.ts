export const WHATSAPP_TEMPLATE_NAME = "Promemoria WhatsApp";

import { APP_BRAND_NAME } from "@/lib/brand";

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

export function renderWhatsappTemplate(template: string, data: WhatsappTemplateData) {
  return template
    .replaceAll("{{nome}}", data.firstName)
    .replaceAll("{{cognome}}", data.lastName)
    .replaceAll("{{dottore}}", data.doctorName)
    .replaceAll("{{data_appuntamento}}", data.appointmentDate)
    .replaceAll("{{motivo_visita}}", data.serviceType)
    .replaceAll("{{note}}", data.notes);
}
