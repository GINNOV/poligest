import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { APPOINTMENT_STATUSES } from "@/lib/client-enums";
import { AgendaFilters } from "@/components/agenda-filters";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const statusLabels = Object.fromEntries(
  APPOINTMENT_STATUSES.map((status) => [status, status]),
) as Record<(typeof APPOINTMENT_STATUSES)[number], string>;

describe("AgendaFilters", () => {
  it("renders doctor filtering as a bounded doctor-name combobox", () => {
    const html = renderToStaticMarkup(
      <AgendaFilters
        statusLabels={statusLabels}
        doctors={[
          { id: "doctor-1", fullName: "Dr. Monica Rossi" },
          { id: "doctor-2", fullName: "Dr. Luca Verdi" },
        ]}
        doctorValue="Dr. Monica Rossi"
      />,
    );

    expect(html).toContain('<select name="doctor"');
    expect(html).toContain('value="Dr. Monica Rossi" selected="">Dr. Monica Rossi');
    expect(html).toContain('value="Dr. Luca Verdi">Dr. Luca Verdi');
    expect(html).not.toContain('<input type="text" name="doctor"');
  });
});
