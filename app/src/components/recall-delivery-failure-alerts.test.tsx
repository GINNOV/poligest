import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecallDeliveryFailureSummary } from "@/components/recall-delivery-failure-alerts";

describe("RecallDeliveryFailureSummary", () => {
  it("renders one card with the failure count and a link to the list", () => {
    const html = renderToStaticMarkup(<RecallDeliveryFailureSummary count={12} />);

    expect(html).toContain("12 invii non riusciti");
    expect(html).toContain('href="/richiami/programmati/non-inviati"');
    expect(html).toContain("Apri elenco");
    expect(html).not.toContain("Chiudi");
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("stays off the page when nothing failed", () => {
    expect(renderToStaticMarkup(<RecallDeliveryFailureSummary count={0} />)).toBe("");
  });
});
