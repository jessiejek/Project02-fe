// Shared day-name <-> day_of_week mapping — clinic_operating_hours and
// doctor_schedules both use `day_of_week smallint 0-6` (0 = Sunday) while the
// frontend uses "Sun".."Sat" strings throughout (DoctorScheduleDay,
// OperatingHours). One mapping, reused everywhere instead of duplicated.
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function dayNameToIndex(day: string): number {
  return DAYS.indexOf(day as (typeof DAYS)[number]);
}

export function indexToDayName(index: number): string {
  return DAYS[index];
}
