"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/ErrorState";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { useSession } from "@/components/providers/SessionProvider";
import { queryDoctorBookings } from "@/lib/data/bookings";
import { visitDate } from "@/components/doctor/appointments/model";

interface DoctorPatientRow { id: string; fullName: string; patientCode: string; latestVisitDate: string; latestBookingId: string; sex: string; age: number | null; phone: string; visits: number; }
function ageOf(dob: string | null): number | null { if (!dob) return null; const t = new Date(); const d = new Date(dob); if (Number.isNaN(d.getTime())) return null; let a = t.getFullYear() - d.getFullYear(); if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--; return a; }
export default function DoctorPatientsPage() {
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DoctorPatientRow[]>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (!session?.staffId) return;
    let cancelled = false;
    void (async () => {
      try {
        const bookings = await queryDoctorBookings(null, session.staffId!);
        const byPatient = new Map<string, DoctorPatientRow>();
        for (const booking of [...bookings].sort((a,b) => b.appointment_date.localeCompare(a.appointment_date) || b.created_at.localeCompare(a.created_at))) {
          if (!booking.patient_id || byPatient.has(booking.patient_id) || !booking.patients) continue;
          byPatient.set(booking.patient_id, { id: booking.patient_id, fullName: [booking.patients.first_name, booking.patients.last_name].filter(Boolean).join(" ") || "Patient name unavailable", patientCode: booking.patients.patient_code ?? "", latestVisitDate: booking.appointment_date, latestBookingId: booking.booking_id, sex: booking.patients.sex ?? "", age: ageOf(booking.patients.date_of_birth), phone: booking.patients.contact_number ?? "", visits: 0 });
        }
        for (const booking of bookings) { const r = booking.patient_id ? byPatient.get(booking.patient_id) : undefined; if (r) r.visits += 1; }
        if (!cancelled) { setRows([...byPatient.values()]); setError(false); }
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setPending(false); }
    })();
    return () => { cancelled = true; };
  }, [session?.staffId, attempt]);
  const filtered = rows.filter(row => `${row.fullName} ${row.patientCode}`.toLowerCase().includes(search.trim().toLowerCase()));
  const count = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page,count);
  const actions = (row: DoctorPatientRow) => <div className="flex flex-wrap gap-sm"><Link href={`/doctor/patients/${row.id}`} className={buttonStyles("primary")}>Open chart</Link><Link href={`/doctor/appointments/${row.latestBookingId}`} className={buttonStyles("secondary")}>Latest appointment</Link></div>;
  if (session && !session.staffId) return <AppShell role="doctor"><DoctorPageHeader title="Doctor profile not linked" description="Ask your clinic administrator to link your account to a doctor profile before opening patient records." /></AppShell>;
  return <AppShell role="doctor"><div className="space-y-xl">
    <DoctorPageHeader title="Patient charts" description="Your patients, their latest appointment and clinical records." />
    {error ? <ErrorState title="Patient list unavailable" message="We could not load your patients. Please try again." onRetry={() => { setPending(true); setError(false); setAttempt(a => a+1); }} /> : <>
      <div className="space-y-sm"><label htmlFor="patient-search" className="text-[12px] font-semibold tracking-[0.02em] text-on-surface-variant">Find a patient</label><input id="patient-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Name or patient ID" className="block min-h-[38px] w-full max-w-doctor-search rounded-[6px] border border-outline-variant bg-surface-container-lowest px-md py-sm text-on-surface" /><p className="text-label-sm tabular-nums text-on-surface-variant">{pending ? "Loading patients…" : `${filtered.length} patients`}</p></div>
      <DataTable columns={[{ header: "Patient", render: row => <div className="flex items-center gap-sm"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-md font-semibold text-primary">{row.fullName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span><div><p className="text-body-md font-semibold">{row.fullName}</p><p className="font-mono text-label-sm text-on-surface-variant">{row.patientCode}</p></div></div> }, { header: "Age / sex", render: row => <span>{row.age !== null ? `${row.age}y` : "—"}{row.sex ? ` · ${row.sex}` : ""}</span> }, { header: "Phone", render: row => <span className="tabular-nums">{row.phone || "—"}</span> }, { header: "Visits", align: "right", render: row => <span className="tabular-nums">{row.visits}</span> }, { header: "Last visit", render: row => <span className="tabular-nums">{visitDate(row.latestVisitDate)}</span> }, { header: "", render: actions }]} rows={filtered.slice((currentPage-1)*20,currentPage*20)} rowKey={row => row.id} loading={pending} emptyMessage={search ? "No patients match this search. Try another name or ID." : "Patients will appear here after they book with you."} pagination={{ page: currentPage, pageCount: count, totalLabel: `${filtered.length} patients`, onPageChange: setPage }} renderMobileCard={row => <div className="space-y-md"><div><p className="text-body-md font-semibold">{row.fullName}</p><p className="font-mono text-label-sm text-on-surface-variant">{row.patientCode}</p></div><p className="text-label-md tabular-nums text-on-surface-variant">Latest visit: {visitDate(row.latestVisitDate)}</p>{actions(row)}</div>} />
    </>}
  </div></AppShell>;
}
