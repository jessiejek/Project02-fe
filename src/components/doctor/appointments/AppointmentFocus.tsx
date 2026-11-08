import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusPill } from "@/components/ui/StatusPill";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { Skeleton } from "@/components/ui/Skeleton";
import { appointmentAction, type Appointment } from "./model";

export function AppointmentFocus({ appointment, loading, onHistory }: { appointment?: Appointment; loading: boolean; onHistory: () => void }) {
  return <section aria-label="Consultation focus" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg sm:p-xl">
    {loading ? <div role="status" aria-label="Loading today's queue" className="space-y-md"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-11 w-48" /></div> : appointment ? <div className="flex flex-wrap items-center justify-between gap-xl">
      <div className="flex min-w-0 flex-1 items-start gap-lg">
        <div className="shrink-0 border-r border-outline-variant pr-lg"><p className="text-label-sm text-on-surface-variant">Queue</p><p className="mt-xs text-headline-lg font-semibold tabular-nums text-primary">{appointment.queueNumber ?? "—"}</p></div>
        <div className="min-w-0 space-y-sm"><p className="text-label-md font-medium text-on-surface-variant">{appointment.status === "InProgress" ? "Continue your consultation" : "Next in today's queue"}</p><h2 className="break-words text-balance text-headline-lg font-semibold text-on-surface">{appointment.patientName}</h2><StatusPill status={appointment.status} /></div>
      </div>
      <Link href={appointmentAction(appointment).href} className={buttonStyles("primary", "w-full sm:w-auto")} aria-label={`${appointmentAction(appointment).label} for ${appointment.patientName}`}><Icon name="medical_services" className="h-4 w-4" />{appointmentAction(appointment).label}<Icon name="arrow_forward" className="h-4 w-4" /></Link>
    </div> : <div className="flex flex-wrap items-center justify-between gap-lg"><div className="space-y-sm"><h2 className="text-headline-md font-semibold text-on-surface">No patients waiting right now</h2><p className="max-w-doctor-copy text-body-md text-on-surface-variant">Checked-in patients will appear here. You can still review appointments below or look through previous visits.</p></div><button type="button" onClick={onHistory} className={buttonStyles("secondary")}>Review appointment history<Icon name="arrow_forward" className="h-4 w-4" /></button></div>}
  </section>;
}
