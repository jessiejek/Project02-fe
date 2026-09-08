"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "bookings", label: "Bookings" },
  { id: "records", label: "Medical Records" },
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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [patientRes, bookingsRes, consultRes] = await Promise.all([
        supabase.from("patients").select("*").eq("patient_id", id).maybeSingle(),
        supabase
          .from("bookings")
          .select("booking_id, appointment_date, status, doctors(staff_accounts(full_name))")
          .eq("patient_id", id)
          .order("appointment_date", { ascending: false }),
        supabase
          .from("consultations")
          .select("consultation_id, chief_complaint, bookings(appointment_date)")
          .eq("patient_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (!patientRes.data) {
        setPatient(null);
        return;
      }

      const p = patientRes.data;
      setPatient({
        id: p.patient_id,
        patientCode: p.patient_code,
        firstName: p.first_name,
        lastName: p.last_name,
        sex: p.sex,
        dateOfBirth: p.date_of_birth,
        contactNumber: p.contact_number ?? "",
        email: p.email,
      });

      setBookings(
        (bookingsRes.data ?? []).map((b) => {
          const doctor = Array.isArray(b.doctors) ? b.doctors[0] : b.doctors;
          const staff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
          return {
            id: b.booking_id,
            doctorName: staff?.full_name ?? "Unknown doctor",
            appointmentDate: b.appointment_date,
            status: b.status,
          };
        }),
      );

      setConsultations(
        (consultRes.data ?? []).map((c) => {
          const booking = Array.isArray(c.bookings) ? c.bookings[0] : c.bookings;
          return {
            id: c.consultation_id,
            appointmentDate: booking?.appointment_date ?? "",
            chiefComplaint: c.chief_complaint ?? "",
          };
        }),
      );
    }
    load();
  }, [id]);

  if (patient === null) notFound();
  if (patient === undefined) {
    return (
      <AppShell role="admin">
        <p className="text-body-md text-on-surface-variant">Loading patient…</p>
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
    const supabase = createClient();
    const { error } = await supabase
      .from("patients")
      .update({
        first_name: editForm.firstName.trim(),
        last_name: editForm.lastName.trim(),
        date_of_birth: editForm.dateOfBirth,
        sex: editForm.sex,
        contact_number: editForm.contactNumber.trim() || null,
        email: editForm.email.trim(),
      })
      .eq("patient_id", patient!.id);

    setSaving(false);
    if (error) {
      setSaveError("Could not save patient. Please try again.");
      return;
    }

    setPatient({
      ...patient!,
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      dateOfBirth: editForm.dateOfBirth,
      sex: editForm.sex,
      contactNumber: editForm.contactNumber.trim(),
      email: editForm.email.trim(),
    });
    setEditOpen(false);
    setSavedAt(new Date().toLocaleTimeString());
  }

  const fullName = `${patient.firstName} ${patient.lastName}`;

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-[44rem] space-y-lg">
        {savedAt && <Toast key={savedAt} variant="success" message={`Patient saved at ${savedAt}.`} />}
        <Card className="flex flex-wrap items-center justify-between gap-md">
          <div>
            <h1 className="text-headline-md text-on-surface">{fullName}</h1>
            <p className="text-label-md text-on-surface-variant">{patient.patientCode}</p>
          </div>
          <Button variant="secondary" onClick={openEdit}>
            Edit Patient
          </Button>
        </Card>

        <Card>
          <Tabs tabs={TABS} activeId={tab} onChange={setTab} className="mb-lg" />
          {tab === "overview" && (
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
              <Info label="Sex" value={patient.sex} />
              <Info label="Date of Birth" value={patient.dateOfBirth} />
              <Info label="Contact Number" value={patient.contactNumber || "—"} />
              <Info label="Email" value={patient.email || "—"} />
            </div>
          )}
          {tab === "bookings" && (
            <div className="space-y-sm">
              {bookings.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">No bookings for this patient.</p>
              ) : (
                bookings.map((b) => (
                  <div key={b.id} className="rounded-lg border border-outline-variant p-md text-body-md">
                    {b.doctorName} — {b.appointmentDate} ({b.status})
                  </div>
                ))
              )}
            </div>
          )}
          {tab === "records" && (
            <div className="space-y-sm">
              {consultations.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">No medical records for this patient.</p>
              ) : (
                consultations.map((c) => (
                  <div key={c.id} className="rounded-lg border border-outline-variant p-md text-body-md text-on-surface-variant">
                    {c.appointmentDate || "—"} — {c.chiefComplaint || "No chief complaint"}
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Patient"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          {saveError && (
            <p className="sm:col-span-2 rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{saveError}</p>
          )}
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">First Name</label>
            <input
              value={editForm.firstName}
              onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">Last Name</label>
            <input
              value={editForm.lastName}
              onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">Date of Birth</label>
            <DatePicker value={editForm.dateOfBirth} onChange={(v) => setEditForm((f) => ({ ...f, dateOfBirth: v }))} />
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">Sex</label>
            <select
              value={editForm.sex}
              onChange={(e) => setEditForm((f) => ({ ...f, sex: e.target.value as "Male" | "Female" }))}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">Contact Number</label>
            <input
              value={editForm.contactNumber}
              onChange={(e) => setEditForm((f) => ({ ...f, contactNumber: e.target.value }))}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          </div>
          <div className="space-y-xs">
            <label className="text-label-md text-on-surface-variant">Email</label>
            <input
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          </div>
        </div>
      </Modal>
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
