import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecallDeliveryFailureList } from "@/components/recall-delivery-failure-list";

async function dismissAction() {}

const alert = {
  id: "recall-1",
  patientId: "patient-9",
  patientName: "Rossi Mario",
  ruleName: "Igiene",
  channelLabel: "WhatsApp",
  dueAt: new Date("2026-07-06T08:00:00.000Z"),
  lastContactAt: null,
  contactGap: "Manca il numero di telefono.",
};

describe("RecallDeliveryFailureList", () => {
  it("links the patient file and keeps dismiss on each row", () => {
    const html = renderToStaticMarkup(
      <RecallDeliveryFailureList alerts={[alert]} dismissAction={dismissAction} showPatientLink />,
    );

    expect(html).toContain("Rossi Mario");
    expect(html).toContain("Manca il numero di telefono.");
    expect(html).toContain('href="/pazienti/patient-9?openContact=1#contact-info"');
    expect(html).toContain("Scheda paziente");
    expect(html).toContain('name="recallId"');
    expect(html).toContain('value="recall-1"');
  });

  it("hides the patient link when the staff role cannot open patient files", () => {
    const html = renderToStaticMarkup(
      <RecallDeliveryFailureList alerts={[alert]} dismissAction={dismissAction} showPatientLink={false} />,
    );

    expect(html).not.toContain("/pazienti/");
    expect(html).toContain("Chiudi");
  });
});
