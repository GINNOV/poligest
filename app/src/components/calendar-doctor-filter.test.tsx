import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarDoctorFilter, doctorSwatchColor } from "@/components/calendar-doctor-filter";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("doctorSwatchColor", () => {
  it("keeps a saved color and gives each unset doctor a different swatch", () => {
    expect(doctorSwatchColor("#e11d48", 0)).toBe("#e11d48");
    expect(doctorSwatchColor(null, 0)).not.toBe(doctorSwatchColor(null, 1));
  });
});

describe("CalendarDoctorFilter", () => {
  it("shows a color swatch beside each doctor name", () => {
    const html = renderToStaticMarkup(
      <CalendarDoctorFilter
        showAll
        doctors={[
          { id: "olga", label: "Olga Corvo", color: "#e11d48" },
          { id: "monica", label: "Monica Agovino", color: null },
        ]}
      />,
    );

    expect(html).toContain("Olga Corvo");
    expect(html).toContain("Monica Agovino");
    expect(html).toContain("background-color:#e11d48");
    expect(html).toContain("Tutto lo staff");
  });
});
