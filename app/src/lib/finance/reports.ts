import { Prisma } from "@prisma/client";

export type DoctorReportSummary = {
  id: string;
  name: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  entryCount: number;
  patientCount: number;
  serviceCounts: Record<string, number>;
};

type MinimalDoctor = { fullName: string | null };

type MinimalFinanceEntry = {
  doctorId: string | null;
  type: string; // Changed from union to string to match Prisma raw/inferred types
  amount: Prisma.Decimal | number | { toString(): string };
  doctor?: MinimalDoctor | null;
};

type MinimalAppointment = {
  doctorId: string | null;
  patientId: string;
  serviceType: string | null;
  doctor?: MinimalDoctor | null;
};

export type AggregateDoctorReportParams = {
  financeEntries: MinimalFinanceEntry[];
  appointments: MinimalAppointment[];
};

export function aggregateDoctorReport({
  financeEntries,
  appointments,
}: AggregateDoctorReportParams): DoctorReportSummary[] {
  const doctorsMap = new Map<string, DoctorReportSummary>();

  // Helper to get or create summary
  const getOrCreate = (doctorId: string, doctorName?: string | null): DoctorReportSummary => {
    const existing = doctorsMap.get(doctorId);
    if (existing) return existing;

    const summary: DoctorReportSummary = {
      id: doctorId,
      name: doctorName || "Medico Sconosciuto",
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      entryCount: 0,
      patientCount: 0,
      serviceCounts: {},
    };
    doctorsMap.set(doctorId, summary);
    return summary;
  };

  // 1. Process Finance Entries
  for (const entry of financeEntries) {
    if (!entry.doctorId) continue;
    const summary = getOrCreate(entry.doctorId, entry.doctor?.fullName);

    const amount = Number(entry.amount.toString());
    if (entry.type === "INCOME") {
      summary.totalIncome += amount;
    } else if (entry.type === "EXPENSE") {
      summary.totalExpense += amount;
    }
    summary.entryCount += 1;
    summary.balance = summary.totalIncome - summary.totalExpense;
  }

  // 2. Process Appointments
  const doctorPatients = new Map<string, Set<string>>();

  for (const app of appointments) {
    if (!app.doctorId) continue;
    const summary = getOrCreate(app.doctorId, app.doctor?.fullName);

    // Track unique patients
    let patientSet = doctorPatients.get(app.doctorId);
    if (!patientSet) {
      patientSet = new Set<string>();
      doctorPatients.set(app.doctorId, patientSet);
    }
    patientSet.add(app.patientId);

    // Track service types
    const serviceType = app.serviceType || "Altro";
    summary.serviceCounts[serviceType] = (summary.serviceCounts[serviceType] || 0) + 1;
  }

  // 3. Finalize patient counts
  for (const [doctorId, patients] of doctorPatients.entries()) {
    const summary = doctorsMap.get(doctorId);
    if (summary) {
      summary.patientCount = patients.size;
    }
  }

  return Array.from(doctorsMap.values()).sort((a, b) => b.totalIncome - a.totalIncome);
}
