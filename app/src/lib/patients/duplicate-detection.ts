import { parsePatientStructuredNotes } from "@/lib/patients/page-data-domain";
import { normalizeItalianPhone } from "@/lib/phone";
import { isValidDate } from "@/lib/date";

export type DuplicatePatientInput = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  notes: string | null;
  createdAt: Date;
};

export type DuplicateMatchKind = "taxId" | "email" | "phone" | "nameBirthDate";

export type DuplicateMatchSignal = {
  kind: DuplicateMatchKind;
  label: string;
  value: string;
  patientIds: string[];
};

export type DuplicatePatientRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  taxId: string | null;
  createdAt: Date;
};

export type PotentialDuplicateGroup = {
  id: string;
  matchSignals: DuplicateMatchSignal[];
  patients: DuplicatePatientRecord[];
};

type SignalSeed = Omit<DuplicateMatchSignal, "patientIds"> & { patientId: string };

function normalizeLooseText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCompactText(value: string | null | undefined) {
  return normalizeLooseText(value).replace(/\s+/g, "");
}

function normalizeSearchText(value: string | null | undefined) {
  return normalizeLooseText(value);
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("it");
}

function normalizeTaxId(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleUpperCase("it");
}

function getBirthDateKey(value: Date | null | undefined) {
  if (!isValidDate(value)) return "";
  return value.toISOString().slice(0, 10);
}

function buildFullNameKey(firstName: string | null, lastName: string | null) {
  const first = normalizeCompactText(firstName);
  const last = normalizeCompactText(lastName);
  if (!first || !last) return "";
  return `${last}|${first}`;
}

function formatSignalLabel(kind: DuplicateMatchKind) {
  switch (kind) {
    case "taxId":
      return "Codice fiscale";
    case "email":
      return "Email";
    case "phone":
      return "Telefono";
    case "nameBirthDate":
      return "Nome + data di nascita";
  }
}

function sortPatients(a: DuplicatePatientRecord, b: DuplicatePatientRecord) {
  const last = (a.lastName ?? "").localeCompare(b.lastName ?? "", "it", { sensitivity: "base" });
  if (last !== 0) return last;
  const first = (a.firstName ?? "").localeCompare(b.firstName ?? "", "it", { sensitivity: "base" });
  if (first !== 0) return first;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function findPotentialPatientDuplicates(patients: DuplicatePatientInput[]): PotentialDuplicateGroup[] {
  const normalizedPatients = patients.map((patient) => {
    const parsed = parsePatientStructuredNotes(patient.notes);
    return {
      ...patient,
      taxId: normalizeTaxId(parsed.parsedTaxId) || null,
    };
  });

  const patientById = new Map(
    normalizedPatients.map((patient) => [
      patient.id,
      {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        birthDate: patient.birthDate,
        taxId: patient.taxId,
        createdAt: patient.createdAt,
      } satisfies DuplicatePatientRecord,
    ]),
  );

  const bucketMap = new Map<string, SignalSeed[]>();

  const addSignal = (signal: SignalSeed | null) => {
    if (!signal) return;
    const key = `${signal.kind}:${signal.value}`;
    const current = bucketMap.get(key) ?? [];
    current.push(signal);
    bucketMap.set(key, current);
  };

  for (const patient of normalizedPatients) {
    if (patient.taxId) {
      addSignal({
        kind: "taxId",
        label: formatSignalLabel("taxId"),
        value: patient.taxId,
        patientId: patient.id,
      });
    }

    const email = normalizeEmail(patient.email);
    if (email) {
      addSignal({
        kind: "email",
        label: formatSignalLabel("email"),
        value: email,
        patientId: patient.id,
      });
    }

    const phone = normalizeItalianPhone(patient.phone);
    if (phone) {
      addSignal({
        kind: "phone",
        label: formatSignalLabel("phone"),
        value: phone,
        patientId: patient.id,
      });
    }

    const fullNameKey = buildFullNameKey(patient.firstName, patient.lastName);
    const birthDateKey = getBirthDateKey(patient.birthDate);
    if (fullNameKey && birthDateKey) {
      addSignal({
        kind: "nameBirthDate",
        label: formatSignalLabel("nameBirthDate"),
        value: `${fullNameKey}|${birthDateKey}`,
        patientId: patient.id,
      });
    }
  }

  const duplicateSignals = Array.from(bucketMap.values())
    .filter((signals) => new Set(signals.map((signal) => signal.patientId)).size > 1)
    .map((signals) => {
      const first = signals[0];
      const patientIds = Array.from(new Set(signals.map((signal) => signal.patientId))).sort();
      return {
        kind: first.kind,
        label: first.label,
        value: first.value,
        patientIds,
      } satisfies DuplicateMatchSignal;
    });

  if (duplicateSignals.length === 0) {
    return [];
  }

  const parent = new Map<string, string>();

  const find = (id: string): string => {
    const currentParent = parent.get(id);
    if (!currentParent) {
      parent.set(id, id);
      return id;
    }
    if (currentParent === id) return id;
    const root = find(currentParent);
    parent.set(id, root);
    return root;
  };

  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  for (const signal of duplicateSignals) {
    const [firstId, ...restIds] = signal.patientIds;
    find(firstId);
    for (const patientId of restIds) {
      find(patientId);
      union(firstId, patientId);
    }
  }

  const groups = new Map<
    string,
    {
      patientIds: Set<string>;
      signals: DuplicateMatchSignal[];
    }
  >();

  for (const signal of duplicateSignals) {
    const root = find(signal.patientIds[0]);
    const group = groups.get(root) ?? { patientIds: new Set<string>(), signals: [] };
    signal.patientIds.forEach((patientId) => group.patientIds.add(patientId));
    group.signals.push(signal);
    groups.set(root, group);
  }

  return Array.from(groups.entries())
    .map(([root, group]) => ({
      id: root,
      matchSignals: group.signals.sort((a, b) => a.label.localeCompare(b.label, "it")),
      patients: Array.from(group.patientIds)
        .map((patientId) => patientById.get(patientId))
        .filter((patient): patient is DuplicatePatientRecord => Boolean(patient))
        .sort(sortPatients),
    }))
    .filter((group) => group.patients.length > 1)
    .sort((a, b) => {
      if (b.matchSignals.length !== a.matchSignals.length) {
        return b.matchSignals.length - a.matchSignals.length;
      }
      if (b.patients.length !== a.patients.length) {
        return b.patients.length - a.patients.length;
      }
      const left = `${a.patients[0]?.lastName ?? ""} ${a.patients[0]?.firstName ?? ""}`;
      const right = `${b.patients[0]?.lastName ?? ""} ${b.patients[0]?.firstName ?? ""}`;
      return left.localeCompare(right, "it", { sensitivity: "base" });
    });
}

export function filterPotentialDuplicateGroups(groups: PotentialDuplicateGroup[], query: string | null | undefined) {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return groups;
  }

  return groups.filter((group) => {
    const searchableText = normalizeSearchText(
      [
        group.id,
        ...group.matchSignals.flatMap((signal) => [signal.label, signal.value]),
        ...group.patients.flatMap((patient) => [
          patient.id,
          patient.firstName,
          patient.lastName,
          [patient.firstName, patient.lastName].filter(Boolean).join(" "),
          [patient.lastName, patient.firstName].filter(Boolean).join(" "),
          patient.email,
          patient.phone,
          patient.taxId,
          getBirthDateKey(patient.birthDate),
          isValidDate(patient.birthDate)
            ? new Intl.DateTimeFormat("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                timeZone: "UTC",
              }).format(patient.birthDate)
            : null,
        ]),
      ]
        .filter(Boolean)
        .join(" "),
    );

    return tokens.every((token) => searchableText.includes(token));
  });
}
