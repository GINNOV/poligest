import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_TEMPLATES,
  interpolateCertificateTemplate,
} from "@/lib/certificates/templates";

describe("Medical Certificates", () => {
  it("defines all required certificate templates", () => {
    expect(CERTIFICATE_TEMPLATES.WORK_INCAPACITY).toBeDefined();
    expect(CERTIFICATE_TEMPLATES.ATTENDANCE).toBeDefined();
    expect(CERTIFICATE_TEMPLATES.INSURANCE).toBeDefined();
    expect(CERTIFICATE_TEMPLATES.CUSTOM).toBeDefined();

    expect(CERTIFICATE_TEMPLATES.WORK_INCAPACITY.label).toContain("Malattia");
    expect(CERTIFICATE_TEMPLATES.ATTENDANCE.label).toContain("Presenza");
    expect(CERTIFICATE_TEMPLATES.INSURANCE.label).toContain("Assicurazione");
  });

  it("interpolates WORK_INCAPACITY template with patient data and prognosis", () => {
    const template = CERTIFICATE_TEMPLATES.WORK_INCAPACITY.bodyTemplate;
    const interpolated = interpolateCertificateTemplate(template, {
      patientName: "Mario Rossi",
      patientBirthPlace: "Napoli",
      patientBirthDate: "15/04/1985",
      patientTaxId: "RSSMRA85D15F839X",
      patientAddress: "Via Roma 10 - Napoli",
      diagnosis: "postumi estrazione terzo molare incluso",
      prognosisDays: 3,
      startDate: "01/09/2026",
      endDate: "03/09/2026",
      doctorName: "Dott. Agovino",
    });

    expect(interpolated).toContain("Mario Rossi");
    expect(interpolated).toContain("Napoli");
    expect(interpolated).toContain("15/04/1985");
    expect(interpolated).toContain("RSSMRA85D15F839X");
    expect(interpolated).toContain("postumi estrazione terzo molare incluso");
    expect(interpolated).toContain("giorni **3**");
    expect(interpolated).toContain("01/09/2026");
    expect(interpolated).toContain("03/09/2026");
  });

  it("interpolates ATTENDANCE template with hours and patient data", () => {
    const template = CERTIFICATE_TEMPLATES.ATTENDANCE.bodyTemplate;
    const interpolated = interpolateCertificateTemplate(template, {
      patientName: "Giulia Bianchi",
      patientBirthPlace: "Salerno",
      patientBirthDate: "20/10/1990",
      patientTaxId: "BNCGLI90R60H703Y",
      startTime: "14:30",
      endTime: "16:00",
    });

    expect(interpolated).toContain("Giulia Bianchi");
    expect(interpolated).toContain("BNCGLI90R60H703Y");
    expect(interpolated).toContain("14:30");
    expect(interpolated).toContain("16:00");
  });

  it("interpolates INSURANCE template with clinic information", () => {
    const template = CERTIFICATE_TEMPLATES.INSURANCE.bodyTemplate;
    const interpolated = interpolateCertificateTemplate(template, {
      patientName: "Luca Verdi",
      patientTaxId: "VRDLCU75C10F839Z",
      diagnosis: "terapia canalare e corona protesica",
    });

    expect(interpolated).toContain("Luca Verdi");
    expect(interpolated).toContain("VRDLCU75C10F839Z");
    expect(interpolated).toContain("terapia canalare e corona protesica");
  });

  it("handles empty/missing fields gracefully with fallbacks", () => {
    const template = CERTIFICATE_TEMPLATES.CUSTOM.bodyTemplate;
    const interpolated = interpolateCertificateTemplate(template, {});

    expect(interpolated).not.toContain("{{patientName}}");
    expect(interpolated).toContain("—");
  });
});
