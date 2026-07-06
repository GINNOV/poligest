import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecallDeliveryFailureAlerts } from "@/components/recall-delivery-failure-alerts";

async function dismissAction() {}

describe("RecallDeliveryFailureAlerts", () => {
  it("renders stacked persistent alerts with dismiss controls", () => {
    const html = renderToStaticMarkup(
      <RecallDeliveryFailureAlerts
        dismissAction={dismissAction}
        alerts={[
          {
            id: "recall-1",
            patientName: "Rossi Mario",
            ruleName: "Igiene",
            channelLabel: "WhatsApp",
            dueAt: new Date("2026-07-06T08:00:00.000Z"),
            lastContactAt: null,
          },
          {
            id: "recall-2",
            patientName: "Bianchi Anna",
            ruleName: "Controllo",
            channelLabel: "Email",
            dueAt: new Date("2026-07-07T08:00:00.000Z"),
            lastContactAt: null,
          },
        ]}
      />,
    );

    expect(html.match(/role="alert"/g)).toHaveLength(2);
    expect(html).toContain("Invio automatico non riuscito per Rossi Mario");
    expect(html).toContain("Invio automatico non riuscito per Bianchi Anna");
    expect(html.match(/name="recallId"/g)).toHaveLength(2);
    expect(html.match(/Chiudi/g)).toHaveLength(2);
  });
});
