"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import { queryDoctors } from "@/lib/data/doctors";
import { queryPatients } from "@/lib/data/patients";
import { parseSlotTo24h, addMinutes } from "@/lib/bookingTime";
import { cn } from "@/lib/cn";
import { printHtml, escapeHtml } from "@/lib/print";

const STEPS = ["Patient", "Slot", "Confirm"];
const SLOTS = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM"];
const BLANK_QUICK_REGISTER = { firstName: "", lastName: "", dateOfBirth: "", contactNumber: "", sex: "" as "" | "Male" | "Female" };

interface PatientRow {
  id: string;
  patientCode: string;
  fullName: string;
  contactNumber: string;
  email: string;
  accountStatus: "LinkedAccount" | "NoAccount" | "AccountUnknown";
}

interface WalkInDoctor {
  id: string;
  name: string;
  consultationFee: number;
  slotDurationMinutes: number;
  dayStatus: string;
}

function accountStatus(userId: string | null, isGuest: boolean): PatientRow["accountStatus"] {
  if (userId) return "LinkedAccount";
  return isGuest ? "NoAccount" : "AccountUnknown";
}

// Stitch walk_in_patient_selection / walk_in_slot_selection /
// walk_in_confirm_create / walk_in_confirmation — same 3-step pattern as
// admin walk-in, wired to real patients + bookings + unpaid payments.
export default function StaffWalkInPage() {
  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [loading, setLoading] = useState(true);
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickRegister, setQuickRegister] = useState(BLANK_QUICK_REGISTER);
  const [preparePortal, setPreparePortal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [doctors, setDoctors] = useState<WalkInDoctor[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [queueNumber, setQueueNumber] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [allPatients, doctorsRes, dayStatusRes] = await Promise.all([
        queryPatients(supabase),
        queryDoctors(supabase),
        supabase.from("doctor_day_statuses").select("doctor_id, status").eq("status_date", today),
      ]);

      setPatients(
        allPatients.map((p) => ({
          id: p.patient_id,
          patientCode: p.patient_code,
          fullName: `${p.first_name} ${p.last_name}`,
          contactNumber: p.contact_number ?? "",
          email: p.email,
          accountStatus: accountStatus(p.user_id, p.is_guest),
        })),
      );

      const dayStatusByDoctor = new Map((dayStatusRes.data ?? []).map((s) => [s.doctor_id, s.status]));
      setDoctors(
        doctorsRes
          .filter((d) => d.staff_accounts?.status !== "Inactive")
          .map((d) => ({
            id: d.doctor_id,
            name: d.staff_accounts?.full_name ?? "",
            consultationFee: Number(d.consultation_fee),
            slotDurationMinutes: d.slot_duration_minutes,
            dayStatus: dayStatusByDoctor.get(d.doctor_id) ?? "Available",
          })),
      );

      setLoading(false);
    }

    load();
  }, []);

  const patient = patients.find((p) => p.id === patientId);
  const doctor = doctors.find((d) => d.id === doctorId);
  const filteredPatients = patients.filter((p) =>
    `${p.fullName} ${p.patientCode} ${p.contactNumber} ${p.email}`.toLowerCase().includes(patientSearch.toLowerCase()),
  );
  const canQuickRegister =
    quickRegister.firstName.trim() !== "" &&
    quickRegister.lastName.trim() !== "" &&
    quickRegister.dateOfBirth.trim() !== "" &&
    quickRegister.sex !== "";
  const today = new Date().toISOString().slice(0, 10);

  async function handleQuickRegister() {
    if (!canQuickRegister) return;
    setRegisterError("");
    setRegistering(true);
    const supabase = createClient();
    const patientCode = `MF-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error } = await supabase
      .from("patients")
      .insert({
        patient_code: patientCode,
        first_name: quickRegister.firstName.trim(),
        last_name: quickRegister.lastName.trim(),
        date_of_birth: quickRegister.dateOfBirth,
        sex: quickRegister.sex as "Male" | "Female",
        contact_number: quickRegister.contactNumber || null,
        email: "",
        is_guest: true,
        user_id: null,
      })
      .select("patient_id, patient_code, first_name, last_name, contact_number, email, user_id, is_guest")
      .single();
    setRegistering(false);
    if (error || !data) {
      setRegisterError("Could not register this patient. Try again.");
      return;
    }
    const created: PatientRow = {
      id: data.patient_id,
      patientCode: data.patient_code,
      fullName: `${data.first_name} ${data.last_name}`,
      contactNumber: data.contact_number ?? "",
      email: data.email,
      accountStatus: accountStatus(data.user_id, data.is_guest),
    };
    setPatients((prev) => [created, ...prev]);
    setPatientId(created.id);
    setQuickRegister(BLANK_QUICK_REGISTER);
    setPreparePortal(false);
    setQuickRegisterOpen(false);
  }

  async function handleCreateBooking() {
    if (!patient || !doctor || !slot) return;
    setCreateError("");
    setCreating(true);
    const supabase = createClient();
    const startTime = parseSlotTo24h(slot);
    const endTime = addMinutes(startTime, doctor.slotDurationMinutes || 30);

    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id)
      .eq("appointment_date", today);
    const newQueueNumber = `${(doctor.name ?? "").trim().charAt(0).toUpperCase() || "Q"}-${(count ?? 0) + 1}`;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: patient.id,
        doctor_id: doctor.id,
        appointment_date: today,
        slot_start_time: startTime,
        slot_end_time: endTime,
        status: "Pending",
        payment_mode: "PayAtClinic",
        queue_number: newQueueNumber,
        consultation_fee_snapshot: doctor.consultationFee,
        total_fee: doctor.consultationFee,
        amount_due: doctor.consultationFee,
        is_walk_in: true,
      })
      .select("booking_id")
      .single();

    if (bookingError || !booking) {
      setCreating(false);
      setCreateError("Could not create this booking. Please try again.");
      return;
    }

    await supabase.from("payments").insert({
      booking_id: booking.booking_id,
      amount: doctor.consultationFee,
      status: "Unpaid",
    });

    setCreating(false);
    setCreatedBookingId(booking.booking_id);
    setQueueNumber(newQueueNumber);
    setStep("done");
  }

  if (loading) {
    return (
      <AppShell role="staff">
        <p className="text-body-md text-on-surface-variant">Loading walk-in setup...</p>
      </AppShell>
    );
  }

  if (step === "done") {
    return (
      <AppShell role="staff">
        <Card className="mx-auto max-w-[26rem] text-center">
          <Icon name="check_circle" className="mb-md text-[48px] text-primary" />
          <h2 className="mb-md text-headline-md text-on-surface">Booking Created</h2>
          <div className="mb-lg rounded-lg border-2 border-dashed border-outline-variant p-lg">
            <p className="text-headline-lg text-primary">Queue #{queueNumber}</p>
            <p className="text-body-md text-on-surface">{patient?.fullName}</p>
            <p className="text-label-md text-on-surface-variant">{doctor?.name} · {slot}</p>
          </div>
          <div className="flex gap-md">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                printHtml(
                  `Queue ${queueNumber ?? ""}`,
                  `<div class="slip">
                    <div class="brand">Walk-in Queue Slip</div>
                    <div class="queue">Queue #${escapeHtml(queueNumber ?? "—")}</div>
                    <p><strong>${escapeHtml(patient?.fullName ?? "Patient")}</strong></p>
                    <p class="muted">${escapeHtml(doctor?.name ?? "Doctor")} · ${escapeHtml(slot ?? "")}</p>
                    <p class="muted">${escapeHtml(new Date().toLocaleDateString())}</p>
                   </div>`,
                );
              }}
            >
              Print Queue Slip
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setStep(1);
                setPatientId(null);
                setDoctorId(null);
                setSlot(null);
                setQueueNumber(null);
                setCreatedBookingId(null);
              }}
            >
              New Walk-In →
            </Button>
          </div>
          {createdBookingId && (
            <Link href={`/staff/bookings/${createdBookingId}`} className="mt-md inline-block text-label-sm text-primary hover:underline">
              View Booking Details
            </Link>
          )}
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell role="staff">
      <div className="mx-auto max-w-[40rem]">
        <StepIndicator steps={STEPS} currentStep={step} />

        {step === 1 && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Select Patient</h2>
            <input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name/code/phone/email"
              className="mb-md w-full rounded-lg border border-outline-variant px-md py-sm"
            />
            <div className="mb-lg space-y-sm">
              {filteredPatients.length === 0 && (
                <p className="text-label-md text-on-surface-variant">No matching patients.</p>
              )}
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPatientId(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-md text-left",
                    patientId === p.id ? "border-primary ring-2 ring-primary/20" : "border-outline-variant",
                  )}
                >
                  <div>
                    <p className="text-body-md text-on-surface">{p.fullName}</p>
                    <p className="text-label-sm text-on-surface-variant">{p.patientCode} · {p.contactNumber}</p>
                  </div>
                  <StatusPill status={p.accountStatus} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setQuickRegisterOpen(!quickRegisterOpen)}
              className="mb-md text-label-md text-primary hover:underline"
            >
              + Quick Register New Patient
            </button>
            {quickRegisterOpen && (
              <div className="mb-lg grid grid-cols-1 gap-md rounded-lg border border-outline-variant p-md sm:grid-cols-2">
                {registerError && (
                  <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container sm:col-span-2">{registerError}</p>
                )}
                <input
                  value={quickRegister.firstName}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First Name*"
                  className="rounded-lg border border-outline-variant px-md py-sm"
                />
                <input
                  value={quickRegister.lastName}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last Name*"
                  className="rounded-lg border border-outline-variant px-md py-sm"
                />
                <input
                  value={quickRegister.dateOfBirth}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                  type="date"
                  className="rounded-lg border border-outline-variant px-md py-sm"
                />
                <select
                  value={quickRegister.sex}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, sex: e.target.value as "" | "Male" | "Female" }))}
                  className="rounded-lg border border-outline-variant px-md py-sm text-on-surface-variant"
                >
                  <option value="">Sex*</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <input
                  value={quickRegister.contactNumber}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, contactNumber: e.target.value }))}
                  placeholder="Contact Number"
                  className="rounded-lg border border-outline-variant px-md py-sm sm:col-span-2"
                />
                <label className="flex items-center gap-sm text-label-md text-on-surface-variant sm:col-span-2">
                  <input type="checkbox" checked={preparePortal} onChange={(e) => setPreparePortal(e.target.checked)} className="h-5 w-5" />
                  Prepare Portal Account — creates login access, patient sets password on first login.
                </label>
                {preparePortal && (
                  <p className="text-label-sm text-on-surface-variant sm:col-span-2">
                    Not wired yet — this registers as a guest record for now; portal invites need an email field this form doesn&apos;t collect.
                  </p>
                )}
                <Button type="button" variant="secondary" onClick={handleQuickRegister} disabled={!canQuickRegister || registering} className="sm:col-span-2">
                  {registering ? "Registering…" : "Register Patient"}
                </Button>
              </div>
            )}
            <Button disabled={!patientId} onClick={() => setStep(2)} className="w-full">
              Continue
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Select Slot</h2>
            <select
              value={doctorId ?? ""}
              onChange={(e) => setDoctorId(e.target.value)}
              className="mb-md w-full rounded-lg border border-outline-variant px-md py-sm"
            >
              <option value="">Select a doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {doctor?.dayStatus !== "Available" && doctor && (
              <p className="mb-md rounded-lg bg-amber-50 px-md py-sm text-label-md text-amber-700">
                {doctor.name} is currently {doctor.dayStatus} — booking is still allowed but confirm with the patient.
              </p>
            )}
            <div className="mb-lg grid grid-cols-2 gap-md sm:grid-cols-4">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={cn(
                    "rounded-lg border p-md text-label-md",
                    slot === s ? "border-primary bg-primary text-on-primary" : "border-outline-variant",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button disabled={!doctor || !slot} onClick={() => setStep(3)} className="flex-1">
                Continue
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && patient && doctor && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Confirm &amp; Create</h2>
            <div className="mb-lg space-y-sm rounded-lg bg-surface-container-low p-md text-body-md">
              <p><strong>Patient:</strong> {patient.fullName}</p>
              <p><strong>Doctor:</strong> {doctor.name}</p>
              <p><strong>Slot:</strong> {slot}</p>
              <p><strong>Total Fee:</strong> ₱{doctor.consultationFee}</p>
              <p className="flex items-center gap-sm">
                <strong>Payment:</strong>
                <span className="rounded-full bg-surface-container-high px-sm py-xs text-label-sm text-on-surface-variant">
                  Pay at Clinic (fixed)
                </span>
              </p>
            </div>
            {createError && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{createError}</p>}
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleCreateBooking} disabled={creating} className="flex-1">
                {creating ? "Creating…" : "Create Booking"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
