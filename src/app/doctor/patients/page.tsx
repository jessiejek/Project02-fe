"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { one, serviceNames } from "@/lib/one";

interface DoctorPatientRow {
  id: string;
  fullName: string;
  patientCode: string;
  latestVisitDate: string | null;
  latestVisitServices: string[];
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
      const supabase = createClient();
      const { data: bookings } = await supabase
        .from("bookings")
        .select("booking_id, patient_id, appointment_date, patients(first_name, last_name, patient_code), booking_services(services(name))")
        .eq("doctor_id", doctorId)
        .order("appointment_date", { ascending: false })
        .order("created_at", { ascending: false });

      const byPatient = new Map<string, DoctorPatientRow>();
      for (const booking of bookings ?? []) {
        if (!booking.patient_id || byPatient.has(booking.patient_id)) continue;
        const patient = one(booking.patients);
        if (!patient) continue;
        byPatient.set(booking.patient_id, {
          id: booking.patient_id,
          fullName: `${patient.first_name} ${patient.last_name}`,
          patientCode: patient.patient_code,
          latestVisitDate: booking.appointment_date,
          latestVisitServices: serviceNames(booking.booking_services),
          latestBookingId: booking.booking_id,
        });
      }

      setRows(Array.from(byPatient.values()));
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
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((p) => {
            return (
              <Card key={p.id}>
                <h3 className="text-headline-sm text-on-surface">{p.fullName}</h3>
                <p className="mb-md text-label-sm text-on-surface-variant">{p.patientCode}</p>
                {p.latestVisitDate && (
                  <p className="mb-md text-label-md text-on-surface-variant">
                    Latest visit: {p.latestVisitDate} — {p.latestVisitServices.join(", ")}
                  </p>
                )}
                <div className="flex flex-wrap gap-sm">
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
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
