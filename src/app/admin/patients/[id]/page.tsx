"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toast } from "@/components/ui/Toast";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { InfoField } from "@/components/ui/InfoField";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate, formatClinicDateShort } from "@/lib/format";
import { queryConsultations, queryRxGroups } from "@/lib/data/clinical";
import { queryPatientById, updatePatient, toTitleCase } from "@/lib/data/patients";
import { queryBookings } from "@/lib/data/bookings";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "bookings", label: "Bookings" },
  { id: "records", label: "Consultations" },
];

interface PatientDetail {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  contactNumber: string;
  email: string;
}

interface BookingRow {
  id: string;
  doctorName: string;
  appointmentDate: string;
  status: string;
}

interface ConsultationRow {
  id: string;
  appointmentDate: string;
  chiefComplaint: string;
}

// Stitch patient_detail_admin — full identity editable, unlike Staff's
// limited view, per admin.md §10. Rewired off mocks (truthDare 4.1).
export default function AdminPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [patient, setPatient] = useState<PatientDetail | null | undefined>(undefined);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRow[]>([]);
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    contactNumber: "",
    email: "",
    sex: "Male" as "Male" | "Female",
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = null as never;
      let patientRow, bookingRows, consultRes;
      try {
        [patientRow, bookingRows, consultRes] = await Promise.all([
          queryPatientById(supabase, id),
          queryBookings(supabase, { patientId: id }),
          queryConsultations(supabase, { patientId: id }),
        ]);
      } catch {
        if (!cancelled) setLoadError(true);
        return;
      }
      if (cancelled) return;
      setLoadError(false);

      if (!patientRow) {
        setPatient(null);
        return;
      }

      setPatient({
        id: patientRow.patient_id,
        patientCode: patientRow.patient_code,
        firstName: patientRow.first_name,
        lastName: patientRow.last_name,
        sex: patientRow.sex,
        dateOfBirth: patientRow.date_of_birth,
        contactNumber: patientRow.contact_number ?? "",
        email: patientRow.email,
      });

      setBookings(
        bookingRows.map((b) => ({
          id: b.booking_id,
          doctorName: b.doctors?.staff_accounts?.full_name ?? "Unknown doctor",
          appointmentDate: b.appointment_date,
          status: b.status,
        })),
      );

      setConsultations(
        consultRes.map((c) => ({
          id: c.consultation_id,
          appointmentDate: c.bookings?.appointment_date ?? "",
          chiefComplaint: c.chief_complaint ?? "",
        })),
      );
    }
    load();
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  if (patient === null) notFound();
  if (patient === undefined) {
    return (
      <AppShell role="admin">
        <div className="mx-auto max-w-doctor-record">
          {loadError
            ? <ErrorState title="Patient unavailable" message="This patient's record could not be loaded. Nothing has changed; try again." onRetry={() => { setLoadError(false); setReloadKey((k) => k + 1); }} />
            : <><p className="sr-only" role="status">Loading patient…</p><SkeletonCard lines={4} /></>}
        </div>
      </AppShell>
    );
  }

  function openEdit() {
    setEditForm({
      firstName: patient!.firstName,
      lastName: patient!.lastName,
      dateOfBirth: patient!.dateOfBirth,
      contactNumber: patient!.contactNumber,
      email: patient!.email,
      sex: patient!.sex === "Female" ? "Female" : "Male",
    });
    setSaveError("");
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.dateOfBirth) {
      setSaveError("First name, last name, and date of birth are required.");
      return;
    }
    setSaving(true);
    setSaveError("");
    const supabase = null as never;
    try {
      await updatePatient(supabase, patient!.id, {
        first_name: toTitleCase(editForm.firstName.trim()),
        last_name: toTitleCase(editForm.lastName.trim()),
        date_of_birth: editForm.dateOfBirth,
        sex: editForm.sex,
        contact_number: editForm.contactNumber.trim() || null,
        email: editForm.email.trim(),
      });
    } catch {
      setSaving(false);
      setSaveError("Could not save patient. Please try again.");
      return;
    }
    setSaving(false);

    setPatient({
      ...patient!,
      firstName: toTitleCase(editForm.firstName.trim()),
      lastName: toTitleCase(editForm.lastName.trim()),
      dateOfBirth: editForm.dateOfBirth,
      sex: editForm.sex,
      contactNumber: editForm.contactNumber.trim(),
      email: editForm.email.trim(),
    });
    setEditOpen(false);
    setSavedAt(new Date().toLocaleTimeString());
  }

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const tabs = TABS.map((t) => t.id === "bookings" ? { ...t, label: `Bookings (${bookings.length})` } : t.id === "records" ? { ...t, label: `Consultations (${consultations.length})` } : t);
  const field = (key: keyof typeof editForm) => `edit-patient-${key}`;

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-doctor-record space-y-lg">
        {savedAt && <Toast key={savedAt} variant="success" message={`Patient saved at ${savedAt}.`} />}
        <Link href="/admin/patients" className="inline-flex min-h-11 items-center gap-xs text-label-md font-medium text-primary hover:underline">
          <Icon name="chevron_left" className="text-[14px]" />All patients
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0 space-y-xs">
            <h1 className="break-words text-headline-lg-mobile text-on-surface sm:text-headline-lg">{fullName}</h1>
            <p className="text-body-md text-on-surface-variant">
              <span className="font-mono text-body-sm">{patient.patientCode}</span> · {patient.sex} · Born {formatClinicDate(patient.dateOfBirth)}
            </p>
          </div>
          <Button variant="secondary" onClick={openEdit}>
            <Icon name="edit" className="text-[14px]" />Edit details
          </Button>
        </header>

        <Card>
          <Tabs tabs={tabs} activeId={tab} onChange={setTab} className="mb-lg" />
          {tab === "overview" && (
            <dl className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <InfoField label="Sex" value={patient.sex} />
              <InfoField label="Date of birth" value={formatClinicDate(patient.dateOfBirth)} />
              <InfoField label="Contact number" value={patient.contactNumber} />
              <InfoField label="Email" value={patient.email} className="break-all" />
            </dl>
          )}
          {tab === "bookings" && (
            <ul className="divide-y divide-outline-variant">
              {bookings.length === 0 ? (
                <li className="py-md text-body-md text-on-surface-variant">No bookings for this patient yet.</li>
              ) : (
                bookings.map((b) => (
                  <li key={b.id}>
                    <Link href={`/admin/bookings/${b.id}`} className="-mx-sm flex min-h-11 flex-wrap items-center justify-between gap-sm rounded-md px-sm py-sm hover:bg-surface-container-low">
                      <span className="min-w-0">
                        <span className="block text-body-md font-medium tabular-nums text-on-surface">{formatClinicDate(b.appointmentDate)}</span>
                        <span className="block text-label-md text-on-surface-variant">{b.doctorName}</span>
                      </span>
                      <StatusPill status={b.status} />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
          {tab === "records" && (
            <ul className="divide-y divide-outline-variant">
              {consultations.length === 0 ? (
                <li className="py-md text-body-md text-on-surface-variant">No consultations recorded for this patient.</li>
              ) : (
                consultations.map((c) => (
                  <li key={c.id} className="py-sm">
                    <p className="text-label-md tabular-nums text-on-surface-variant">{formatClinicDateShort(c.appointmentDate, "Date not recorded")}</p>
                    <p className="text-body-md text-on-surface">{c.chiefComplaint || "No chief complaint recorded"}</p>
                  </li>
                ))
              )}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        isOpen={editOpen}
        onClose={() => { if (!saving) setEditOpen(false); }}
        title="Edit patient details"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {saveError && <FormAlert className="sm:col-span-2">{saveError}</FormAlert>}
          <div className="space-y-xs">
            <label htmlFor={field("firstName")} className={labelStyles}>First name</label>
            <input id={field("firstName")} value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className={inputStyles()} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={field("lastName")} className={labelStyles}>Last name</label>
            <input id={field("lastName")} value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className={inputStyles()} />
          </div>
          <div className="space-y-xs">
            <span className={labelStyles}>Date of birth</span>
            <DatePicker value={editForm.dateOfBirth} onChange={(v) => setEditForm((f) => ({ ...f, dateOfBirth: v }))} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={field("sex")} className={labelStyles}>Sex</label>
            <select id={field("sex")} value={editForm.sex} onChange={(e) => setEditForm((f) => ({ ...f, sex: e.target.value as "Male" | "Female" }))} className={inputStyles()}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="space-y-xs">
            <label htmlFor={field("contactNumber")} className={labelStyles}>Contact number</label>
            <input id={field("contactNumber")} type="tel" value={editForm.contactNumber} onChange={(e) => setEditForm((f) => ({ ...f, contactNumber: e.target.value }))} className={inputStyles()} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={field("email")} className={labelStyles}>Email</label>
            <input id={field("email")} type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputStyles()} />
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
