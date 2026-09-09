"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { queryConsultations, queryRxGroups } from "@/lib/data/clinical";
import { one } from "@/lib/one";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "bookings", label: "Bookings" },
  { id: "records", label: "Medical Records" },
];

interface PatientDetail {
  id: string;
  fullName: string;
  patientCode: string;
  sex: string;
  dateOfBirth: string;
  contactNumber: string;
  email: string;
  accountStatus: "LinkedAccount" | "NoAccount" | "AccountUnknown";
}

interface BookingRow {
  id: string;
  doctorName: string;
  appointmentDate: string;
  status: string;
}

interface RecordRow {
  id: string;
  appointmentDate: string;
  chiefComplaint: string;
  diagnoses: string[];
}

// Stitch patient_detail_staff_view — 3 tabs per Staff.md §7.
export default function StaffPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientDetail | null | undefined>(undefined);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [tab, setTab] = useState("overview");
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [patientRes, bookingsRes, consultationsRes] = await Promise.all([
        supabase
          .from("patients")
          .select("patient_id, patient_code, first_name, last_name, sex, date_of_birth, contact_number, email, user_id, is_guest")
          .eq("patient_id", id)
          .maybeSingle(),
        supabase
          .from("bookings")
          .select("booking_id, appointment_date, status, doctors(staff_accounts(full_name))")
          .eq("patient_id", id)
          .order("appointment_date", { ascending: false }),
        queryConsultations(supabase, { patientId: id }),
      ]);

      if (!patientRes.data) {
        setPatient(null);
        setLoading(false);
        return;
      }

      setPatient({
        id: patientRes.data.patient_id,
        fullName: `${patientRes.data.first_name} ${patientRes.data.last_name}`,
        patientCode: patientRes.data.patient_code,
        sex: patientRes.data.sex,
        dateOfBirth: patientRes.data.date_of_birth,
        contactNumber: patientRes.data.contact_number ?? "",
        email: patientRes.data.email,
        accountStatus: patientRes.data.user_id ? "LinkedAccount" : patientRes.data.is_guest ? "NoAccount" : "AccountUnknown",
      });

      setBookings(
        (bookingsRes.data ?? []).map((b) => {
          const staff = one(one(b.doctors)?.staff_accounts);
          return {
            id: b.booking_id,
            doctorName: staff?.full_name ?? "",
            appointmentDate: b.appointment_date,
            status: b.status,
          };
        }),
      );

      setRecords(
        consultationsRes.map((c) => ({
          id: c.consultation_id,
          appointmentDate: c.bookings?.appointment_date ?? "",
          chiefComplaint: c.chief_complaint ?? "",
          diagnoses: (c.consultation_diagnoses ?? []).map((d) => d.custom_description ?? "").filter(Boolean),
        })),
      );

      setLoading(false);
    }

    load();
  }, [id]);

  if (loading || patient === undefined) {
    return (
      <AppShell role="staff">
        <p className="text-body-md text-on-surface-variant">Loading patient...</p>
      </AppShell>
    );
  }

  if (patient === null) notFound();

  return (
    <AppShell role="staff">
      <div className="mx-auto max-w-[44rem] space-y-lg">
        <Card>
          <h1 className="text-headline-md text-on-surface">{patient.fullName}</h1>
          <p className="text-label-md text-on-surface-variant">{patient.patientCode}</p>
        </Card>

        <Card>
          <Tabs tabs={TABS} activeId={tab} onChange={setTab} className="mb-lg" />

          {tab === "overview" && (
            <div className="space-y-lg">
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                <Info label="Sex" value={patient.sex} />
                <Info label="Date of Birth" value={patient.dateOfBirth} />
                <Info label="Contact Number" value={patient.contactNumber} />
                <Info label="Email" value={patient.email} />
              </div>
              {patient.accountStatus === "NoAccount" ? (
                <>
                  {!createAccountOpen ? (
                    <Button variant="secondary" onClick={() => setCreateAccountOpen(true)}>
                      Create Portal Account
                    </Button>
                  ) : (
                    <div className="space-y-md rounded-lg border border-outline-variant p-md">
                      <p className="text-body-md text-on-surface-variant">
                        Portal account creation from this page is not wired yet. Use the admin/staff invite flow when available.
                      </p>
                      <Button variant="secondary" onClick={() => setCreateAccountOpen(false)}>Close</Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
                  Portal account: {patient.accountStatus === "LinkedAccount" ? "created" : "pending"}
                </p>
              )}
            </div>
          )}

          {tab === "bookings" && (
            <div className="space-y-sm">
              {bookings.map((b) => (
                <div key={b.id} className="rounded-lg border border-outline-variant p-md text-body-md">
                  {b.doctorName} — {b.appointmentDate} ({b.status})
                </div>
              ))}
              {bookings.length === 0 && (
                <p className="text-body-md text-on-surface-variant">No bookings yet.</p>
              )}
            </div>
          )}

          {tab === "records" && (
            <div className="space-y-sm">
              <p className="mb-sm inline-block rounded-full bg-surface-container-high px-sm py-xs text-label-sm text-on-surface-variant">
                Read-only
              </p>
              {records.map((c) => (
                <div key={c.id} className="rounded-lg border border-outline-variant p-md text-body-md text-on-surface-variant">
                  <p><strong>{c.appointmentDate}</strong> — {c.chiefComplaint}</p>
                  <p>{c.diagnoses.join(", ")}</p>
                </div>
              ))}
              {records.length === 0 && (
                <p className="text-body-md text-on-surface-variant">No medical records yet.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-body-md text-on-surface">{value}</p>
    </div>
  );
}
