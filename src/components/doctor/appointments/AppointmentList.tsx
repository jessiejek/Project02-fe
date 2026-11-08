import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusPill } from "@/components/ui/StatusPill";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { appointmentAction, visitDate, type Appointment, type AppointmentScope } from "./model";

function OpenAppointment({ row }: { row: Appointment }) {
  const action = appointmentAction(row);
  return <Link href={action.href} className={buttonStyles("secondary", "!px-md !py-sm")} aria-label={`${action.label} for ${row.patientName}`}>{row.status === "InProgress" ? "Resume" : row.status === "CheckedIn" ? "Open consultation" : "View"}<Icon name="arrow_forward" className="h-3.5 w-3.5" /></Link>;
}
function Patient({ row }: { row: Appointment }) {
  return <div className="min-w-0"><p className="break-words text-body-md font-semibold text-on-surface">{row.patientName}</p>{row.patientCode && <p className="mt-xs font-mono text-label-sm text-on-surface-variant">{row.patientCode}</p>}</div>;
}
export function AppointmentList({ rows, scope }: { rows: Appointment[]; scope: AppointmentScope }) {
  return <>
    <div className="hidden overflow-x-auto md:block"><table className="w-full border-collapse text-left"><caption className="sr-only">{scope === "today" ? "Today's appointments" : "Appointment history"}</caption>
      <thead className="border-y border-outline-variant bg-surface-container-low"><tr>{["Queue", "Patient", "Visit", "Status", "Payment", ""].map(label => <th scope="col" key={label} className="px-lg py-md text-label-md font-medium text-on-surface-variant">{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
      <tbody className="divide-y divide-outline-variant">{rows.map(row => <tr key={row.id} className="transition-colors hover:bg-surface-container-low motion-reduce:transition-none"><td className="whitespace-nowrap px-lg py-lg text-body-md font-semibold tabular-nums text-on-surface">{row.queueNumber ?? "—"}</td><td className="min-w-48 px-lg py-lg"><Patient row={row} /></td><td className="whitespace-nowrap px-lg py-lg text-label-md text-on-surface-variant">{scope === "all" && <p className="tabular-nums text-on-surface">{visitDate(row.appointmentDate)}</p>}<p>{row.visitType}</p></td><td className="px-lg py-lg"><StatusPill status={row.status} /></td><td className="px-lg py-lg text-label-md text-on-surface-variant">{row.paymentStatus ?? "Not recorded"}</td><td className="px-lg py-lg text-right"><OpenAppointment row={row} /></td></tr>)}</tbody>
    </table></div>
    <ul className="divide-y divide-outline-variant md:hidden" aria-label="Appointments">{rows.map(row => <li key={row.id} className="space-y-md p-lg"><div className="flex items-start justify-between gap-md"><Patient row={row} /><span className="shrink-0 text-label-md font-semibold tabular-nums text-primary">{row.queueNumber ?? "No queue number"}</span></div><div className="flex flex-wrap items-center justify-between gap-sm"><StatusPill status={row.status} /><span className="text-label-md text-on-surface-variant">{scope === "all" ? visitDate(row.appointmentDate) : row.visitType}</span></div><div className="flex flex-wrap items-center justify-between gap-sm"><p className="text-label-sm text-on-surface-variant">Payment: {row.paymentStatus ?? "Not recorded"}</p><OpenAppointment row={row} /></div></li>)}</ul>
  </>;
}
