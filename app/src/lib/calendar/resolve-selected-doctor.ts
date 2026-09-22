export function resolveSelectedDoctorId(input: {
  doctorParam: string | undefined;
  doctorIds: string[];
  linkedDoctorId?: string | null;
  preferLinkedDoctor: boolean;
}): { showAllDoctors: boolean; selectedDoctorId: string | undefined } {
  if (input.doctorParam === "all") {
    return { showAllDoctors: true, selectedDoctorId: undefined };
  }

  const explicit =
    input.doctorParam && input.doctorIds.includes(input.doctorParam)
      ? input.doctorParam
      : undefined;
  const linked =
    input.preferLinkedDoctor &&
    input.linkedDoctorId &&
    input.doctorIds.includes(input.linkedDoctorId)
      ? input.linkedDoctorId
      : undefined;

  return {
    showAllDoctors: false,
    selectedDoctorId: explicit ?? linked ?? input.doctorIds[0],
  };
}
