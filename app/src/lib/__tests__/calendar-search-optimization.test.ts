import { describe, expect, it } from "vitest";

type Appt = {
  id: string;
  title: string;
  serviceType: string;
  patientName: string;
  patientId: string;
  notes?: string | null;
};

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
};

function filterAppointments(
  appointments: Appt[],
  patients: Patient[],
  searchQuery: string,
): Appt[] {
  if (!searchQuery) return appointments;
  const tokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return appointments;

  const patientById = new Map<string, Patient>();
  patients.forEach((p) => patientById.set(p.id, p));

  return appointments.filter((appt) => {
    const name = appt.patientName.toLowerCase();
    const notes = (appt.notes || "").toLowerCase();
    const title = (appt.title || "").toLowerCase();
    const serviceType = (appt.serviceType || "").toLowerCase();
    const patient = patientById.get(appt.patientId);
    const email = (patient?.email || "").toLowerCase();
    const phone = (patient?.phone || "").toLowerCase();
    const taxId = (patient?.taxId || "").toLowerCase();

    return tokens.every(
      (token) =>
        name.includes(token) ||
        notes.includes(token) ||
        title.includes(token) ||
        serviceType.includes(token) ||
        email.includes(token) ||
        phone.includes(token) ||
        taxId.includes(token),
    );
  });
}

describe("calendar search filtering", () => {
  const patients: Patient[] = [
    {
      id: "p1",
      firstName: "Mario",
      lastName: "Rossi",
      email: "mario.rossi@example.com",
      phone: "+393331234567",
      taxId: "RSSMRA80A01H501Z",
    },
    {
      id: "p2",
      firstName: "Giuseppe",
      lastName: "Verdi",
      email: "g.verdi@example.com",
      phone: "+393409876543",
      taxId: "VRDGPP75B02F205Y",
    },
  ];

  const appointments: Appt[] = [
    {
      id: "a1",
      title: "Controllo semestrale",
      serviceType: "Igiene",
      patientName: "Rossi Mario",
      patientId: "p1",
      notes: "Paziente ansioso per igiene dentale",
    },
    {
      id: "a2",
      title: "Estrazione dente del giudizio",
      serviceType: "Chirurgia",
      patientName: "Verdi Giuseppe",
      patientId: "p2",
      notes: "Anestesia speciale richiesta",
    },
  ];

  it("filters by patient name", () => {
    const res = filterAppointments(appointments, patients, "Mario");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("a1");
  });

  it("filters by appointment title", () => {
    const res = filterAppointments(appointments, patients, "Estrazione");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("a2");
  });

  it("filters by service type", () => {
    const res = filterAppointments(appointments, patients, "Igiene");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("a1");
  });

  it("filters by patient tax ID", () => {
    const res = filterAppointments(appointments, patients, "VRDGPP75");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("a2");
  });

  it("filters by phone number", () => {
    const res = filterAppointments(appointments, patients, "333123");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("a1");
  });
});
