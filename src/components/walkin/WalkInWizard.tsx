"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { queryPatients, createPatient } from "@/lib/data/patients";
import { checkInWalkIn, type QueueTicket } from "@/lib/data/queue";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/nav-config";
import { printHtml, escapeHtml } from "@/lib/print";

// §16.3 — no appointment slots. Walk-in FCFS queue: pick the patient, confirm
// the visit type / discount, check in → queue ticket.
const STEPS = ["Patient", "Confirm"];
const BLANK_QUICK_REGISTER = {
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  contactNumber: "",
  address: "",
  sex: "" as "" | "Male" | "Female",
};

interface PatientRow {
  id: string;
  patientCode: string;
  fullName: string;
  contactNumber: string;
  email: string;
  accountStatus: "LinkedAccount" | "NoAccount" | "AccountUnknown";
}

function accountStatus(userId: string | null, isGuest: boolean): PatientRow["accountStatus"] {
  if (userId) return "LinkedAccount";
  return isGuest ? "NoAccount" : "AccountUnknown";
}

export function WalkInWizard({ role }: { role: Extract<Role, "staff" | "admin"> }) {
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [loading, setLoading] = useState(true);
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickRegister, setQuickRegister] = useState(BLANK_QUICK_REGISTER);
  const [preparePortal, setPreparePortal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);

  const [visitType, setVisitType] = useState<"New" | "FollowUp">("New");
  const [discountCategory, setDiscountCategory] = useState<"Senior" | "PWD" | "">("");
  const [medCertRequested, setMedCertRequested] = useState(false);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [ticket, setTicket] = useState<QueueTicket | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      const allPatients = await queryPatients(supabase);
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
      setLoading(false);
    }
    load();
  }, []);

  const patient = patients.find((p) => p.id === patientId);
  const filteredPatients = patients.filter((p) =>
    `${p.fullName} ${p.patientCode} ${p.contactNumber} ${p.email}`.toLowerCase().includes(patientSearch.toLowerCase()),
  );
  const canQuickRegister =
    quickRegister.firstName.trim() !== "" &&
    quickRegister.lastName.trim() !== "" &&
    quickRegister.dateOfBirth.trim() !== "" &&
    quickRegister.sex !== "";

  async function handleQuickRegister() {
    if (!canQuickRegister) return;
    setRegisterError("");
    setRegistering(true);
    const supabase = null as never;
    let data;
    try {
      data = await createPatient(supabase, {
        first_name: quickRegister.firstName,
        middle_name: quickRegister.middleName || null,
        last_name: quickRegister.lastName,
        date_of_birth: quickRegister.dateOfBirth,
        sex: quickRegister.sex as "Male" | "Female",
        contact_number: quickRegister.contactNumber || null,
        address: quickRegister.address || null,
      });
    } catch {
      setRegistering(false);
      setRegisterError("Could not register this patient. Try again.");
      return;
    }
    setRegistering(false);
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

  async function handleCheckIn() {
    if (!patient) return;
    setCreateError("");
    setCreating(true);
    const supabase = null as never;
    try {
      const t = await checkInWalkIn(supabase, {
        patient_id: patient.id,
        visit_type: visitType,
        med_cert_requested: medCertRequested,
        discount_category: discountCategory || null,
      });
      setTicket(t);
      setStep("done");
    } catch {
      setCreateError("Could not check this patient in. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  function resetForNext() {
    setStep(1);
    setPatientId(null);
    setVisitType("New");
    setDiscountCategory("");
    setMedCertRequested(false);
    setTicket(null);
    setPatientSearch("");
  }

  if (loading) {
    return (
      <AppShell role={role}>
        <p className="text-body-md text-on-surface-variant">Loading walk-in setup...</p>
      </AppShell>
    );
  }

  if (step === "done" && ticket) {
    return (
      <AppShell role={role}>
        <Card className="mx-auto max-w-[26rem] text-center">
          <Icon name="check_circle" className="mb-md text-[48px] text-primary" />
          <h2 className="mb-md text-headline-md text-on-surface">Checked In</h2>
          <div className="mb-lg rounded-lg border-2 border-dashed border-outline-variant p-lg">
            <p className="text-display-sm text-primary">{ticket.queue_number}</p>
            <p className="text-body-md text-on-surface">{ticket.patient_name}</p>
            <p className="text-label-md text-on-surface-variant">{ticket.patient_code}</p>
            <p className="mt-sm text-label-md text-on-surface-variant">
              {ticket.visit_type === "FollowUp" ? "Follow-up" : "New"} · provisional fee ₱{ticket.provisional_fee}
            </p>
          </div>
          <div className="flex gap-md">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() =>
                printHtml(
                  `Queue ${ticket.queue_number}`,
                  `<div class="slip">
                    <div class="brand">${escapeHtml(ticket.clinic_name)}</div>
                    <p class="muted">${escapeHtml(ticket.clinic_address)}</p>
                    <div class="queue">${escapeHtml(ticket.queue_number)}</div>
                    <p><strong>${escapeHtml(ticket.patient_name)}</strong> (${escapeHtml(ticket.patient_code)})</p>
                    <p class="muted">${escapeHtml(ticket.doctor_name)}</p>
                    <p class="muted">${escapeHtml(ticket.visit_type === "FollowUp" ? "Follow-up" : "New")} · provisional ₱${ticket.provisional_fee}</p>
                    <p class="muted">${escapeHtml(new Date(ticket.issued_at).toLocaleString())}</p>
                   </div>`,
                )
              }
            >
              Print Queue Slip
            </Button>
            <Button className="flex-1" onClick={resetForNext}>
              New Walk-In →
            </Button>
          </div>
          <Link href={`/${role}/bookings/${ticket.booking_id}`} className="mt-md inline-block text-label-sm text-primary hover:underline">
            View Booking Details
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <div className="mx-auto max-w-[40rem]">
        <StepIndicator steps={STEPS} currentStep={step === "done" ? STEPS.length : step} />

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
                  value={quickRegister.middleName}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, middleName: e.target.value }))}
                  placeholder="Middle Name"
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
                  className="rounded-lg border border-outline-variant px-md py-sm"
                />
                <input
                  value={quickRegister.address}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Address"
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

        {step === 2 && patient && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Confirm &amp; Check In</h2>
            <div className="mb-lg space-y-md rounded-lg bg-surface-container-low p-md text-body-md">
              <p><strong>Patient:</strong> {patient.fullName} <span className="text-on-surface-variant">({patient.patientCode})</span></p>

              <div className="flex flex-wrap items-center gap-sm">
                <span className="text-label-md text-on-surface-variant">Visit type</span>
                {(["New", "FollowUp"] as const).map((vt) => (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => setVisitType(vt)}
                    className={cn(
                      "rounded-full border px-md py-xs text-label-md",
                      visitType === vt ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
                    )}
                  >
                    {vt === "New" ? "New" : "Follow-up"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-sm">
                <span className="text-label-md text-on-surface-variant">Discount</span>
                <select
                  value={discountCategory}
                  onChange={(e) => setDiscountCategory(e.target.value as "Senior" | "PWD" | "")}
                  className="rounded-lg border border-outline-variant px-md py-xs text-label-md"
                >
                  <option value="">None</option>
                  <option value="Senior">Senior citizen</option>
                  <option value="PWD">PWD</option>
                </select>
              </div>

              <label className="flex items-center gap-sm text-body-md text-on-surface-variant">
                <input type="checkbox" checked={medCertRequested} onChange={(e) => setMedCertRequested(e.target.checked)} className="h-5 w-5" />
                Medical certificate requested
              </label>

              <p className="flex items-center gap-sm">
                <strong>Payment:</strong>
                <span className="rounded-full bg-surface-container-high px-sm py-xs text-label-sm text-on-surface-variant">
                  Pay at Clinic — provisional fee computed at check-in, finalised at consultation
                </span>
              </p>
            </div>
            {createError && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{createError}</p>}
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleCheckIn} disabled={creating} className="flex-1">
                {creating ? "Checking in…" : "Check In"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
