"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { useSession } from "@/components/providers/SessionProvider";
import { queryDoctorBookings } from "@/lib/data/bookings";

interface DoctorPatientRow {
  id: string;
  fullName: string;
  patientCode: string;
  latestVisitDate: string | null;
  latestBookingId: string | null;
}

// Stitch patients_list_doctor — de-duplicated roster from booking history,
// paginated per Addendum D10 (fixes the original's hard 50-item cap).
export default function DoctorPatientsPage() {
  const { session, loading } = useSession();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DoctorPatientRow[]>([]);

  useEffect(() => {
    if (!session?.staffId) return;
    const doctorId = session.staffId;

    async function load() {
      const supabase = null as never;
      const bookings = await queryDoctorBookings(supabase, doctorId);

      const byPatient = new Map<string, DoctorPatientRow>();
      for (const booking of bookings) {
        if (!booking.patient_id || byPatient.has(booking.patient_id)) continue;
        const patient = booking.patients;
        if (!patient) continue;
        byPatient.set(booking.patient_id, {
          id: booking.patient_id,
          fullName: `${patient.first_name} ${patient.last_name}`,
          patientCode: patient.patient_code ?? "",
          latestVisitDate: booking.appointment_date,
          latestBookingId: booking.booking_id,
        });
      }

      setRows([...byPatient.values()]);
    }
    load();
  }, [session?.staffId]);

  if (loading || !session?.staffId) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading patients...</p>
      </AppShell>
    );
  }

  const filteredRows = rows.filter((p) =>
    `${p.fullName} ${p.patientCode}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell role="doctor">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">My Patients</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm sm:w-80"
        />
        <DataTable
          columns={[
            { header: "Code", render: (p) => p.patientCode },
            { header: "Full Name", render: (p) => p.fullName },
            { header: "Latest Appointment", render: (p) => p.latestVisitDate ?? "—" },
            {
              header: "Actions",
              align: "right",
              render: (p) => (
                <div className="flex justify-end gap-sm">
                  <Link href={`/doctor/patients/${p.id}`}>
                    <Button variant="secondary" className="!px-sm !py-xs text-label-sm">
                      View Chart
                    </Button>
                  </Link>
                  {p.latestBookingId && (
                    <Link href={`/doctor/appointments/${p.latestBookingId}`}>
                      <Button className="!px-sm !py-xs text-label-sm">Open Appointment</Button>
                    </Link>
                  )}
                </div>
              ),
            },
          ]}
          rows={filteredRows}
          rowKey={(p) => p.id}
          emptyMessage="No patients yet."
          renderMobileCard={(p) => (
            <div className="space-y-xs">
              <p className="text-body-md font-medium text-on-surface">{p.fullName}</p>
              <p className="text-label-sm text-on-surface-variant">
                {p.patientCode}
                {p.latestVisitDate && ` · Latest appointment: ${p.latestVisitDate}`}
              </p>
              <div className="flex gap-sm">
                <Link href={`/doctor/patients/${p.id}`} className="flex-1">
                  <Button variant="secondary" className="w-full">
                    View Chart
                  </Button>
                </Link>
                {p.latestBookingId && (
                  <Link href={`/doctor/appointments/${p.latestBookingId}`} className="flex-1">
                    <Button className="w-full">Open Appointment</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
