-- RenameIndex
ALTER INDEX "doctor_availability_unique" RENAME TO "DoctorAvailabilityWindow_doctorId_dayOfWeek_startMinute_end_key";
