"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { Icon } from "@/components/ui/Icon";
import { queryPatients, createPatient } from "@/lib/data/patients";
import { clientPage } from "@/lib/data/paging";
import { checkInWalkIn, type QueueTicket } from "@/lib/data/queue";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/nav-config";
import { printHtml, escapeHtml } from "@/lib/print";
import { todayManila } from "@/lib/clock";

function computeAge(dateOfBirth: string): number {
  const [ty, tm, td] = todayManila().split("-").map(Number);
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

// PH senior-citizen threshold — 60 years old and above (RA 9994).
function isSeniorCitizen(dateOfBirth: string): boolean {
  return computeAge(dateOfBirth) >= 60;
}

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
  sex: "Male" | "Female";
  dateOfBirth: string;
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
          sex: p.sex,
          dateOfBirth: p.date_of_birth,
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

  // Auto-tag Senior from the patient's own date of birth (RA 9994, 60+) the
  // moment they're picked/registered — staff can still change it (e.g. PWD
  // instead, or the patient doesn't want to claim the discount).
  useEffect(() => {
    if (patient?.dateOfBirth) {
      setDiscountCategory(isSeniorCitizen(patient.dateOfBirth) ? "Senior" : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const filteredPatients = patients.filter((p) =>
    `${p.fullName} ${p.patientCode} ${p.contactNumber} ${p.email}`.toLowerCase().includes(patientSearch.toLowerCase()),
  );
  const PATIENTS_PAGE_SIZE = 10;
  const [patientPage, setPatientPage] = useState(1);
  // Back to page 1 whenever the search narrows/widens the list — staying on
  // page 6 of a 2-result search would just show an empty page.
  useEffect(() => setPatientPage(1), [patientSearch]);
  const pagedPatients = clientPage(filteredPatients, { page: patientPage }, PATIENTS_PAGE_SIZE);
  const patientPageCount = Math.max(1, Math.ceil(pagedPatients.totalCount / PATIENTS_PAGE_SIZE));
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
      sex: data.sex,
      dateOfBirth: data.date_of_birth,
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
      <div className={cn("pb-28", step === 1 ? "w-full" : "mx-auto max-w-[40rem]")}>
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
            <div className="mb-md overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
              {filteredPatients.length === 0 ? (
                <p className="px-md py-lg text-center text-label-md text-on-surface-variant">No matching patients.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] border-collapse text-label-sm">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low">
                        <th className="whitespace-nowrap px-md py-xs text-left font-medium text-on-surface-variant">Patient</th>
                        <th className="whitespace-nowrap px-md py-xs text-left font-medium text-on-surface-variant">Contact</th>
                        {/* Staff.md ask: name alone doesn't identify a patient — two
                            "Juan Dela Cruz" walk in on the same day. Sex/age/DOB do
                            (the MF-code did too, but staff don't work off it). */}
                        <th className="whitespace-nowrap px-md py-xs text-left font-medium text-on-surface-variant">Sex</th>
                        <th className="whitespace-nowrap px-md py-xs text-left font-medium text-on-surface-variant">Age</th>
                        <th className="whitespace-nowrap px-md py-xs text-left font-medium text-on-surface-variant">Date of Birth</th>
                        <th className="whitespace-nowrap px-md py-xs text-left font-medium text-on-surface-variant">Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {pagedPatients.items.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setPatientId(p.id)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            patientId === p.id ? "bg-primary/10" : "hover:bg-surface-container-low",
                          )}
                        >
                          <td className="whitespace-nowrap px-md py-xs text-on-surface">{p.fullName}</td>
                          <td className="whitespace-nowrap px-md py-xs text-on-surface-variant">{p.contactNumber}</td>
                          <td className="whitespace-nowrap px-md py-xs text-on-surface-variant">{p.sex}</td>
                          <td className="whitespace-nowrap px-md py-xs text-on-surface-variant">{computeAge(p.dateOfBirth)}</td>
                          <td className="whitespace-nowrap px-md py-xs text-on-surface-variant">{p.dateOfBirth}</td>
                          <td
                            className={cn(
                              "whitespace-nowrap px-md py-xs font-medium",
                              p.accountStatus === "LinkedAccount" && "text-green-700",
                              p.accountStatus === "NoAccount" && "text-on-surface-variant",
                              p.accountStatus === "AccountUnknown" && "text-amber-700",
                            )}
                          >
                            {p.accountStatus === "LinkedAccount"
                              ? "Linked account"
                              : p.accountStatus === "NoAccount"
                                ? "No account"
                                : "Account unknown"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {filteredPatients.length > 0 && (
              <div className="mb-lg flex items-center justify-between text-label-md text-on-surface-variant">
                <span>
                  {(patientPage - 1) * PATIENTS_PAGE_SIZE + 1}–
                  {Math.min(patientPage * PATIENTS_PAGE_SIZE, filteredPatients.length)} of {filteredPatients.length}
                </span>
                <div className="flex items-center gap-sm">
                  <Button
                    variant="secondary"
                    className="!px-sm !py-xs text-label-sm"
                    disabled={patientPage <= 1}
                    onClick={() => setPatientPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span>{patientPage} / {patientPageCount}</span>
                  <Button
                    variant="secondary"
                    className="!px-sm !py-xs text-label-sm"
                    disabled={patientPage >= patientPageCount}
                    onClick={() => setPatientPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Sticky, not buried below a potentially-long patient list — Continue
            stays reachable at any scroll position instead of requiring a
            scroll past the whole list + pagination to find it. */}
        {step === 1 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant bg-surface-container-lowest p-md md:left-sidebar">
            <div className="w-full">
              <Button disabled={!patientId} onClick={() => setStep(2)} className="w-full">
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Floating above the sticky Continue bar — opens the registration
            form in its own modal instead of pushing content around inline. */}
        {step === 1 && (
          <Button
            onClick={() => setQuickRegisterOpen(true)}
            className="fixed bottom-[88px] right-lg z-40 shadow-lg"
          >
            <Icon name="add_circle" className="text-[18px]" />
            Add New Patient
          </Button>
        )}

        <Modal
          isOpen={quickRegisterOpen}
          onClose={() => setQuickRegisterOpen(false)}
          title="Register New Patient"
          footer={
            <>
              <Button variant="secondary" onClick={() => setQuickRegisterOpen(false)} disabled={registering}>
                Cancel
              </Button>
              <Button onClick={handleQuickRegister} disabled={!canQuickRegister || registering}>
                {registering ? "Registering…" : "Register Patient"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
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
          </div>
        </Modal>

        {step === 2 && patient && (
          <Card>
            <h2 className="mb-lg text-headline-md text-on-surface">Confirm &amp; Check In</h2>

            {/* Patient identity — avatar + name up front, the way a receipt or
                ticket leads with who it's for. */}
            <div className="mb-lg flex items-center gap-md rounded-xl bg-surface-container-low p-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon name="person" className="text-[20px]" />
              </div>
              <div>
                <p className="text-body-lg font-medium text-on-surface">{patient.fullName}</p>
                <p className="text-label-sm text-on-surface-variant">{patient.patientCode}</p>
              </div>
            </div>

            <div className="mb-lg space-y-lg">
              <div>
                <p className="mb-sm text-label-md font-medium text-on-surface-variant">Appointment type</p>
                <div className="inline-flex rounded-full border border-outline-variant bg-surface-container-lowest p-[3px]">
                  {(["New", "FollowUp"] as const).map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      onClick={() => setVisitType(vt)}
                      className={cn(
                        "rounded-full px-lg py-sm text-label-md transition-colors",
                        visitType === vt
                          ? "bg-primary text-on-primary shadow-sm"
                          : "text-on-surface-variant hover:text-on-surface",
                      )}
                    >
                      {vt === "New" ? "New" : "Follow-up"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-sm text-label-md font-medium text-on-surface-variant">Discount</p>
                <div className="flex flex-wrap items-center gap-sm">
                  <select
                    value={discountCategory}
                    onChange={(e) => setDiscountCategory(e.target.value as "Senior" | "PWD" | "")}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm text-body-md text-on-surface"
                  >
                    <option value="">None</option>
                    <option value="Senior">Senior citizen</option>
                    <option value="PWD">PWD</option>
                  </select>
                  {discountCategory === "Senior" && patient?.dateOfBirth && isSeniorCitizen(patient.dateOfBirth) && (
                    <span className="inline-flex items-center gap-xs rounded-full bg-primary/10 px-sm py-xs text-label-sm text-primary">
                      <Icon name="star" className="text-[12px]" />
                      Auto-detected from date of birth
                    </span>
                  )}
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-md rounded-xl border border-outline-variant p-md">
                <span className="flex items-center gap-sm text-body-md text-on-surface">
                  <Icon name="description" className="text-[18px] text-on-surface-variant" />
                  Medical certificate requested
                </span>
                <input
                  type="checkbox"
                  checked={medCertRequested}
                  onChange={(e) => setMedCertRequested(e.target.checked)}
                  className="h-5 w-5 accent-primary"
                />
              </label>

              <div className="flex items-start gap-sm rounded-xl bg-primary/5 p-md">
                <Icon name="payments" className="mt-[2px] text-[18px] text-primary" />
                <div>
                  <p className="text-label-md font-medium text-on-surface">Pay at Clinic</p>
                  <p className="text-label-sm text-on-surface-variant">
                    Provisional fee computed at check-in, finalised at consultation.
                  </p>
                </div>
              </div>
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
