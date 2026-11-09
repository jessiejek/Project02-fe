"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { Icon } from "@/components/ui/Icon";
import { InfoField } from "@/components/ui/InfoField";
import { StatusPill } from "@/components/ui/StatusPill";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatClinicDate, formatClinicDateShort } from "@/lib/format";
import { queryConsultations } from "@/lib/data/clinical";
import { queryPatientById } from "@/lib/data/patients";
import { queryBookings } from "@/lib/data/bookings";


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
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
      let patientData, bookingRows, consultationsRes;
      try {
        [patientData, bookingRows, consultationsRes] = await Promise.all([
          queryPatientById(null as never, id),
          queryBookings(null as never, { patientId: id }),
          queryConsultations(null as never, { patientId: id }),
        ]);
        setLoadError(false);
      } catch {
        setLoadError(true);
        setLoading(false);
        return;
      }

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
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  if (loadError && patient === undefined) {
    return (
      <AppShell role="staff">
        <div className="mx-auto max-w-[48rem]">
          <ErrorState
            title="This patient didn’t load"
            message="Check the connection to the clinic server, then try again."
            retrying={retrying}
            onRetry={async () => { setRetrying(true); await load(); setRetrying(false); }}
          />
        </div>
      </AppShell>
    );
  }

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

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "bookings", label: `Bookings (${bookings.length})` },
    { id: "records", label: `Medical records (${records.length})` },
  ];

  return (
    <AppShell role="staff">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <Link href="/staff/patients" className="inline-flex min-h-11 items-center gap-xs text-label-md font-medium text-primary hover:underline">
          <Icon name="chevron_left" className="text-[14px]" />
          All patients
        </Link>

        <header className="space-y-xs">
          <h1 className="text-balance break-words text-headline-lg-mobile text-on-surface sm:text-headline-lg">{patient.fullName}</h1>
          <p className="text-body-md text-on-surface-variant">
            <span className="font-mono text-body-sm">{patient.patientCode}</span>
            {patient.sex && <> · {patient.sex}</>}
            {patient.dateOfBirth && <> · Born {formatClinicDate(patient.dateOfBirth)}</>}
          </p>
        </header>

        <Card>
          <Tabs tabs={tabs} activeId={tab} onChange={setTab} className="mb-lg" />

          {tab === "overview" && (
            <div className="space-y-lg">
              <dl className="grid grid-cols-1 gap-md sm:grid-cols-2">
                <InfoField label="Contact number" value={patient.contactNumber} />
                <InfoField label="Email" value={patient.email} />
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-md border-t border-outline-variant pt-md">
                <div className="flex items-center gap-sm">
                  <span className="text-label-md text-on-surface-variant">Portal account</span>
                  <StatusPill status={patient.accountStatus} />
                </div>
                {patient.accountStatus === "NoAccount" && !createAccountOpen && (
                  <Button variant="secondary" onClick={() => setCreateAccountOpen(true)}>
                    Create portal account
                  </Button>
                )}
              </div>
              {patient.accountStatus === "NoAccount" && createAccountOpen && (
                <div className="space-y-md rounded-lg border border-outline-variant p-md">
                  <p className="text-body-md text-on-surface-variant">
                    Portal account creation from this page is not wired yet. Use the admin/staff invite flow when available.
                  </p>
                  <Button variant="secondary" onClick={() => setCreateAccountOpen(false)}>Close</Button>
                </div>
              )}
            </div>
          )}

          {tab === "bookings" && (
            bookings.length === 0 ? (
              <EmptyState icon="event_note" message="No bookings yet." />
            ) : (
              <ul className="divide-y divide-outline-variant/40">
                {bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/staff/bookings/${b.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-sm rounded-lg px-sm py-md hover:bg-surface-container-low">
                      <span className="min-w-0">
                        <span className="block text-body-md font-medium tabular-nums text-on-surface">{formatClinicDateShort(b.appointmentDate)}</span>
                        <span className="block text-label-md text-on-surface-variant">{b.doctorName || "—"}</span>
                      </span>
                      <StatusPill status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === "records" && (
            <div className="space-y-md">
              <p className="text-label-md text-on-surface-variant">Read-only. Only the doctor can change medical records.</p>
              {records.length === 0 ? (
                <EmptyState icon="description" message="No medical records yet." />
              ) : (
                <ul className="space-y-sm">
                  {records.map((c) => (
                    <li key={c.id} className="rounded-lg border border-outline-variant p-md">
                      <p className="text-label-md tabular-nums text-on-surface-variant">{formatClinicDate(c.appointmentDate)}</p>
                      <p className="text-body-md font-medium text-on-surface">{c.chiefComplaint || "No chief complaint recorded"}</p>
                      {c.diagnoses.length > 0 && <p className="text-body-md text-on-surface-variant">{c.diagnoses.join(", ")}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
