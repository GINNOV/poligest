import { describe, expect, it } from "vitest";
import { aggregateDoctorReport } from "../reports";
import { Prisma } from "@prisma/client";

describe("aggregateDoctorReport", () => {
  it("aggregates revenue and patients correctly", () => {
    const financeEntries = [
      {
        doctorId: "doc-1",
        type: "INCOME",
        amount: new Prisma.Decimal(1000),
        doctor: { fullName: "Dr. House" },
      },
      {
        doctorId: "doc-1",
        type: "EXPENSE",
        amount: new Prisma.Decimal(200),
        doctor: { fullName: "Dr. House" },
      },
      {
        doctorId: "doc-2",
        type: "INCOME",
        amount: new Prisma.Decimal(500),
        doctor: { fullName: "Dr. Watson" },
      },
    ];

    const appointments = [
      {
        doctorId: "doc-1",
        patientId: "p-1",
        serviceType: "Igiene",
        doctor: { fullName: "Dr. House" },
      },
      {
        doctorId: "doc-1",
        patientId: "p-1", // Same patient
        serviceType: "Igiene",
        doctor: { fullName: "Dr. House" },
      },
      {
        doctorId: "doc-1",
        patientId: "p-2",
        serviceType: "Chirurgia",
        doctor: { fullName: "Dr. House" },
      },
    ];

    const result = aggregateDoctorReport({ financeEntries, appointments });

    expect(result).toHaveLength(2);
    
    const house = result.find(r => r.id === "doc-1")!;
    expect(house.totalIncome).toBe(1000);
    expect(house.totalExpense).toBe(200);
    expect(house.balance).toBe(800);
    expect(house.patientCount).toBe(2);
    expect(house.serviceCounts["Igiene"]).toBe(2);
    expect(house.serviceCounts["Chirurgia"]).toBe(1);

    const watson = result.find(r => r.id === "doc-2")!;
    expect(watson.totalIncome).toBe(500);
    expect(watson.patientCount).toBe(0); // No appointments in this test data
  });
});
