"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { queryConsultations } from "@/lib/data/clinical";
import { queryPatientById } from "@/lib/data/patients";
import { queryBookings } from "@/lib/data/bookings";

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
      const [patientData, bookingRows, consultationsRes] = await Promise.all([
        queryPatientById(null as never, id),
        queryBookings(null as never, { patientId: id }),
        queryConsultations(null as never, { patientId: id }),
      ]);

      if (!patientData) {
        setPatient(null);
        setLoading(false);
        return;
      }

      setPatient({
        id: patientData.patient_id,
        fullName: `${patientData.first_name} ${patientData.last_name}`,
        patientCode: patientData.patient_code,
        sex: patientData.sex,
        dateOfBirth: patientData.date_of_birth,
        contactNumber: patientData.contact_number ?? "",
        email: patientData.email,
        accountStatus: patientData.user_id ? "LinkedAccount" : patientData.is_guest ? "NoAccount" : "AccountUnknown",
      });

      setBookings(
        bookingRows.map((b) => ({
          id: b.booking_id,
          doctorName: b.doctors?.staff_accounts?.full_name ?? "",
          appointmentDate: b.appointment_date,
          status: b.status,
        })),
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
        <div className="space-y-md">
          <SkeletonCard lines={3} />
          <SkeletonTable rows={4} columns={3} />
        </div>
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
