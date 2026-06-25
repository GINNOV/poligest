export type PatientSearchOption = {
  id: string;
  fullName: string;
  phone?: string | null;
  taxId?: string | null;
};

export function getPatientOptionValue(patient: PatientSearchOption): string {
  const details = [patient.phone, patient.taxId].filter(Boolean).join(" - ");
  return details ? `${patient.fullName} (${details})` : patient.fullName;
}

export function resolvePatientFromQuery(
  query: string,
  patients: PatientSearchOption[],
): PatientSearchOption | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const exactDisplayMatch = patients.find(
    (patient) => getPatientOptionValue(patient).toLowerCase() === normalizedQuery,
  );
  if (exactDisplayMatch) return exactDisplayMatch;

  const nameMatches = patients.filter(
    (patient) => patient.fullName.toLowerCase() === normalizedQuery,
  );
  if (nameMatches.length === 1) return nameMatches[0];

  return null;
}