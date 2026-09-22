import { describe, expect, it } from "vitest";
import { resolveSelectedDoctorId } from "../resolve-selected-doctor";

const doctorIds = ["alessandro", "olga"];

describe("resolveSelectedDoctorId", () => {
  it("opens a linked doctor's own calendar when the URL does not name one", () => {
    expect(
      resolveSelectedDoctorId({
        doctorParam: undefined,
        doctorIds,
        linkedDoctorId: "olga",
        preferLinkedDoctor: true,
      }),
    ).toEqual({ showAllDoctors: false, selectedDoctorId: "olga" });
  });

  it("keeps an explicit doctor, including another doctor's calendar", () => {
    expect(
      resolveSelectedDoctorId({
        doctorParam: "alessandro",
        doctorIds,
        linkedDoctorId: "olga",
        preferLinkedDoctor: true,
      }).selectedDoctorId,
    ).toBe("alessandro");
  });

  it("honours the all-doctors view", () => {
    expect(
      resolveSelectedDoctorId({
        doctorParam: "all",
        doctorIds,
        linkedDoctorId: "olga",
        preferLinkedDoctor: true,
      }),
    ).toEqual({ showAllDoctors: true, selectedDoctorId: undefined });
  });

  it("leaves admins on the first doctor when they have no explicit choice", () => {
    expect(
      resolveSelectedDoctorId({
        doctorParam: undefined,
        doctorIds,
        linkedDoctorId: "olga",
        preferLinkedDoctor: false,
      }).selectedDoctorId,
    ).toBe("alessandro");
  });
});
