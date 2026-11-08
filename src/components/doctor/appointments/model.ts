import type { BookingRow } from "@/lib/data/bookings";

export type AppointmentScope = "today" | "all";
export type AppointmentFilter = "all" | "active" | "waiting" | "in-progress" | "completed";
export interface Appointment {
  id: string; patientName: string; patientCode: string | null; appointmentDate: string;
  queueNumber: string | null; status: string; paymentStatus: string | null; visitType: string;
}
const collator = new Intl.Collator("en", { numeric: true });
export function mapAppointments(rows: BookingRow[]): Appointment[] {
  return rows.map(b => ({ id: b.booking_id, patientName: [b.patients?.first_name, b.patients?.last_name].filter(Boolean).join(" ") || "Patient name unavailable",
    patientCode: b.patients?.patient_code ?? null, appointmentDate: b.appointment_date, queueNumber: b.queue_number,
    status: b.status, paymentStatus: b.payments?.status ?? null, visitType: b.visit_type === "FollowUp" ? "Follow-up" : "Consultation" }));
}
export function orderedAppointments(rows: Appointment[], scope: AppointmentScope): Appointment[] {
  return [...rows].sort((a,b) => (scope === "all" ? b.appointmentDate.localeCompare(a.appointmentDate) : 0) ||
    (a.queueNumber === b.queueNumber ? 0 : a.queueNumber === null ? 1 : b.queueNumber === null ? -1 : collator.compare(a.queueNumber, b.queueNumber)) || a.patientName.localeCompare(b.patientName));
}
export function filterAppointments(rows: Appointment[], filter: AppointmentFilter, search: string): Appointment[] {
  const statuses: Record<AppointmentFilter, string[] | null> = { all: null, active: ["CheckedIn", "InProgress"], waiting: ["CheckedIn"], "in-progress": ["InProgress"], completed: ["Completed"] };
  const query = search.trim().toLowerCase();
  return rows.filter(row => (!statuses[filter] || statuses[filter]!.includes(row.status)) &&
    `${row.patientName} ${row.patientCode ?? ""} ${row.queueNumber ?? ""}`.toLowerCase().includes(query));
}
export function focusAppointment(rows: Appointment[]): Appointment | undefined {
  return rows.find(row => row.status === "InProgress") ?? rows.find(row => row.status === "CheckedIn");
}
export function visitDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Date unavailable";
  const [year, month, day] = date.split("-").map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return "Date unavailable";
  const parsed = new Date(date + "T12:00:00+08:00");
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(parsed);
}
export function appointmentAction(row: Appointment) {
  const clinical = row.status === "CheckedIn" || row.status === "InProgress";
  return { href: clinical ? `/doctor/consultation2/${row.id}` : `/doctor/appointments/${row.id}`, label: row.status === "InProgress" ? "Resume consultation" : clinical ? "Start consultation" : "View appointment" };
}
