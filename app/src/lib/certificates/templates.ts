export type CertificateType =
  | "WORK_INCAPACITY" // Riposo lavorativo / Malattia
  | "ATTENDANCE" // Presenza per cure
  | "INSURANCE" // Assicurazione / Rimborso
  | "CUSTOM"; // Personalizzato

export interface CertificateTemplate {
  id: CertificateType;
  label: string;
  defaultTitle: string;
  description: string;
  bodyTemplate: string;
}

export const CERTIFICATE_TEMPLATES: Record<CertificateType, CertificateTemplate> = {
  WORK_INCAPACITY: {
    id: "WORK_INCAPACITY",
    label: "Certificato di Malattia / Riposo Lavorativo",
    defaultTitle: "Certificato di Inabilità Temporanea al Lavoro e Riposo Medico",
    description:
      "Per il datore di lavoro o enti previdenziali. Attesta l'inabilità temporanea al lavoro con periodo di riposo e cure.",
    bodyTemplate: `Si certifica che il/la Sig./Sig.ra **{{patientName}}**, nato/a a **{{patientBirthPlace}}** il **{{patientBirthDate}}** (C.F. **{{patientTaxId}}**), residente in **{{patientAddress}}**, è stato/a da me visitato/a in data odierna presso questa struttura odontoiatrica.

A seguito della visita clinica e delle terapie praticate per **{{diagnosis}}**, si riscontra una condizione di inabilità temporanea allo svolgimento della normale attività lavorativa.

Si prescrive pertanto un periodo di **riposo e cure mediche** per giorni **{{prognosisDays}}**, a decorrere dal **{{startDate}}** al **{{endDate}}** compresi.

Il/La paziente viene invitato/a a nuovo controllo clinico al termine del periodo indicato o in caso di persistenza della sintomatologia.`,
  },
  ATTENDANCE: {
    id: "ATTENDANCE",
    label: "Certificato di Presenza per Cure Odontoiatriche",
    defaultTitle: "Certificato di Giustificazione Presenza per Cure Odontoiatriche",
    description:
      "Attesta la presenza del paziente presso lo studio per sottoporsi a prestazioni odontoiatriche non differibili.",
    bodyTemplate: `Si attesta che il/la Sig./Sig.ra **{{patientName}}**, nato/a a **{{patientBirthPlace}}** il **{{patientBirthDate}}** (C.F. **{{patientTaxId}}**), si è recato/a in data odierna presso questa struttura odontoiatrica dalle ore **{{startTime}}** alle ore **{{endTime}}**.

Durante tale permanenza è stato/a sottoposto/a a prestazioni e cure odontoiatriche specialistiche non differibili.

Il presente certificato viene rilasciato su richiesta dell'interessato/a per gli usi consentiti dalla legge e per la giustificazione dell'assenza dal lavoro.`,
  },
  INSURANCE: {
    id: "INSURANCE",
    label: "Certificato per Assicurazione / Rimborso Spese",
    defaultTitle: "Relazione Clinica Odontoiatrica per Rimborso Assicurativo",
    description:
      "Per compagnie assicurative o fondi integrativi. Descrive la necessità terapeutica e le cure eseguite/in corso.",
    bodyTemplate: `A richiesta dell'interessato/a ai fini assicurativi e di rimborso spese sanitarie, si certifica che il/la Sig./Sig.ra **{{patientName}}**, nato/a a **{{patientBirthPlace}}** il **{{patientBirthDate}}** (C.F. **{{patientTaxId}}**), è in cura presso questo studio per **{{diagnosis}}**.

Le prestazioni e terapie odontoiatriche eseguite e programmate si sono rese necessarie per il ripristino funzionale ed estetico dell'apparato stomatognatico e non rivestono carattere meramente voluttuario.

Si rilascia il presente documento per i soli fini amministrativi e assicurativi previsti dalla polizza sanitaria in essere.`,
  },
  CUSTOM: {
    id: "CUSTOM",
    label: "Certificato Generico / Personalizzato",
    defaultTitle: "Certificato Medico Odontoiatrico",
    description: "Modello libero interamente personalizzabile.",
    bodyTemplate: `Si certifica che il/la Sig./Sig.ra **{{patientName}}**, nato/a a **{{patientBirthPlace}}** il **{{patientBirthDate}}** (C.F. **{{patientTaxId}}**), è attualmente seguito/a presso questo studio odontoiatrico per le necessarie cure specialistiche.

{{diagnosis}}

Si rilascia su richiesta dell'interessato/a per tutti gli usi consentiti dalla legge.`,
  },
};

export interface CertificateInterpolationParams {
  patientName?: string;
  patientBirthPlace?: string;
  patientBirthDate?: string;
  patientTaxId?: string;
  patientAddress?: string;
  diagnosis?: string;
  prognosisDays?: number | string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  doctorName?: string;
  place?: string;
}

export function interpolateCertificateTemplate(
  template: string,
  params: CertificateInterpolationParams
): string {
  let result = template;
  result = result.replace(/\{\{patientName\}\}/g, params.patientName || "—");
  result = result.replace(/\{\{patientBirthPlace\}\}/g, params.patientBirthPlace || "—");
  result = result.replace(/\{\{patientBirthDate\}\}/g, params.patientBirthDate || "—");
  result = result.replace(/\{\{patientTaxId\}\}/g, params.patientTaxId || "—");
  result = result.replace(/\{\{patientAddress\}\}/g, params.patientAddress || "—");
  result = result.replace(/\{\{diagnosis\}\}/g, params.diagnosis || "patologia odontoiatrica in trattamento");
  result = result.replace(/\{\{prognosisDays\}\}/g, String(params.prognosisDays ?? "1"));
  result = result.replace(/\{\{startDate\}\}/g, params.startDate || "—");
  result = result.replace(/\{\{endDate\}\}/g, params.endDate || "—");
  result = result.replace(/\{\{startTime\}\}/g, params.startTime || "09:00");
  result = result.replace(/\{\{endTime\}\}/g, params.endTime || "10:30");
  result = result.replace(/\{\{doctorName\}\}/g, params.doctorName || "—");
  result = result.replace(/\{\{place\}\}/g, params.place || "San Valentino Torio (SA)");
  return result;
}
