/** Supabase nested selects are typed as `T | T[]`; normalize to one row. */
export function one<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

type Named = { name?: string | null };
type ServiceLink = { services?: Named | Named[] | null };

/** Extract service names from a booking_services(services(name)) join. */
export function serviceNames(links: ServiceLink[] | null | undefined): string[] {
  return (links ?? []).map((bs) => one(bs.services)?.name ?? "");
}

type StaffLite = { full_name?: string | null; status?: string | null; email?: string | null };
type DoctorWithStaff = { staff_accounts?: StaffLite | StaffLite[] | null };

/** Doctor join → staff row. */
export function doctorStaff(doctor: DoctorWithStaff | DoctorWithStaff[] | null | undefined): StaffLite | undefined {
  return one(one(doctor)?.staff_accounts);
}
