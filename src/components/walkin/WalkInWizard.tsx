"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { Icon } from "@/components/ui/Icon";
import { StatusPill } from "@/components/ui/StatusPill";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { hintStyles, inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { formatClinicDateShort, formatPeso, orDash } from "@/lib/format";
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
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      let allPatients;
      try {
        allPatients = await queryPatients(supabase);
      } catch {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setLoadError(false);
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
  }, [reloadKey]);

  const patient = patients.find((p) => p.id === patientId);

  // Auto-tag Senior from the patient's own date of birth (RA 9994, 60+) the
  // moment they're picked/registered — staff can still change it (e.g. PWD
  // instead, or the patient doesn't want to claim the discount).
  const [discountPatientId, setDiscountPatientId] = useState<string | null>(null);
  //JJQR - AI (Oct 31, 2026)
  if (patientId !== discountPatientId) {
    setDiscountPatientId(patientId);
    const dob = patient?.dateOfBirth;
    setDiscountCategory(dob && isSeniorCitizen(dob) ? "Senior" : "");
  }
  //JJQR - END

  const filteredPatients = patients.filter((p) =>
    `${p.fullName} ${p.patientCode} ${p.contactNumber} ${p.email}`.toLowerCase().includes(patientSearch.toLowerCase()),
  );
  const PATIENTS_PAGE_SIZE = 10;
  const [patientPage, setPatientPage] = useState(1);
  const [patientPageSearch, setPatientPageSearch] = useState(patientSearch);
  // Back to page 1 whenever the search narrows/widens the list — staying on
  // page 6 of a 2-result search would just show an empty page.
  //JJQR - AI (Oct 31, 2026)
  if (patientSearch !== patientPageSearch) {
    setPatientPageSearch(patientSearch);
    setPatientPage(1);
  }
  //JJQR - END
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

  const header = (
    <PageHeader
      title="Walk-in check-in"
      description="Find the patient (or register them), confirm the visit, and hand them a queue number."
    />
  );

  if (loading || loadError) {
    return (
      <AppShell role={role}>
        <div className="space-y-lg">
          {header}
          {loadError
            ? <ErrorState title="Patients unavailable" message="The patient list could not be loaded, so check-in can't start yet. Try again." onRetry={() => { setLoading(true); setReloadKey((k) => k + 1); }} />
            : <><p className="sr-only" role="status">Loading patients…</p><SkeletonTable rows={6} columns={4} /></>}
        </div>
      </AppShell>
    );
  }

  if (step === "done" && ticket) {
    return (
      <AppShell role={role}>
        <Card className="animate-surface-in mx-auto max-w-auth text-center" role="status">
          <Icon name="check_circle" className="mb-sm text-[32px] text-status-success" />
          <h1 className="mb-md text-headline-md text-on-surface">{ticket.patient_name} is checked in</h1>
          <div className="mb-lg rounded-lg border border-outline-variant bg-surface-container-low p-lg">
            <p className="text-label-md text-on-surface-variant">Queue number</p>
            <p className="text-display-sm tabular-nums text-primary">{ticket.queue_number}</p>
            <p className="font-mono text-body-sm text-on-surface-variant">{ticket.patient_code}</p>
            <p className="mt-sm text-label-md text-on-surface-variant">
              {ticket.visit_type === "FollowUp" ? "Follow-up" : "New visit"} · provisional fee <span className="tabular-nums">{formatPeso(ticket.provisional_fee)}</span>
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
              <Icon name="print" className="text-[14px]" />Print slip
            </Button>
            <Button className="flex-1" onClick={resetForNext}>
              Next walk-in<Icon name="chevron_right" className="text-[14px]" />
            </Button>
          </div>
          <Link href={`/${role}/bookings/${ticket.booking_id}`} className="mt-md inline-flex min-h-11 items-center text-label-md font-medium text-primary hover:underline">
            View booking details
          </Link>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <div className={cn("space-y-lg pb-28", step === 1 ? "w-full" : "mx-auto max-w-doctor-record")}>
        {header}
        <StepIndicator steps={STEPS} currentStep={step === "done" ? STEPS.length : step} />

        {step === 1 && (
          <Card>
            <div className="mb-md flex flex-wrap items-end justify-between gap-md">
              <h2 className="text-headline-md text-on-surface">Who is checking in?</h2>
              <Button variant="secondary" onClick={() => setQuickRegisterOpen(true)}>
                <Icon name="add_circle" className="text-[16px]" />
                Register new patient
              </Button>
            </div>
            <label className="mb-md block space-y-xs">
              <span className="text-label-md text-on-surface-variant">Search patients</span>
              <input
                type="search"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Name, patient code, phone or email"
                className={inputStyles()}
              />
            </label>
            <fieldset className="mb-md min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
              <legend className="sr-only">Select a patient</legend>
              {filteredPatients.length === 0 ? (
                <div className="space-y-sm px-md py-lg text-center">
                  <p className="text-body-md text-on-surface-variant">{patientSearch.trim() ? `No patients match “${patientSearch.trim()}”.` : "No patients registered yet."}</p>
                  <Button variant="ghost" onClick={() => setQuickRegisterOpen(true)}>Register them as a new patient</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] border-collapse text-body-md">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low">
                        <th className="whitespace-nowrap px-md py-sm text-left text-label-md font-medium text-on-surface-variant">Patient</th>
                        <th className="whitespace-nowrap px-md py-sm text-left text-label-md font-medium text-on-surface-variant">Contact</th>
                        {/* Staff.md ask: name alone doesn't identify a patient — two
                            "Juan Dela Cruz" walk in on the same day. Sex/age/DOB do. */}
                        <th className="whitespace-nowrap px-md py-sm text-left text-label-md font-medium text-on-surface-variant">Sex</th>
                        <th className="whitespace-nowrap px-md py-sm text-right text-label-md font-medium text-on-surface-variant">Age</th>
                        <th className="whitespace-nowrap px-md py-sm text-left text-label-md font-medium text-on-surface-variant">Date of birth</th>
                        <th className="whitespace-nowrap px-md py-sm text-left text-label-md font-medium text-on-surface-variant">Account</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {pagedPatients.items.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setPatientId(p.id)}
                          className={cn(
                            "cursor-pointer transition-colors",
                            patientId === p.id ? "bg-primary/10" : "hover:bg-surface-container-low",
                          )}
                        >
                          <td className="px-md py-sm">
                            <label className="flex min-h-11 cursor-pointer items-center gap-sm">
                              <input type="radio" name="walkin-patient" checked={patientId === p.id} onChange={() => setPatientId(p.id)} className="h-4 w-4 shrink-0 accent-primary" />
                              <span>
                                <span className="block font-medium text-on-surface">{p.fullName}</span>
                                <span className="block font-mono text-body-sm text-on-surface-variant">{p.patientCode}</span>
                              </span>
                            </label>
                          </td>
                          <td className="whitespace-nowrap px-md py-sm tabular-nums text-on-surface-variant">{orDash(p.contactNumber)}</td>
                          <td className="whitespace-nowrap px-md py-sm text-on-surface-variant">{p.sex}</td>
                          <td className="whitespace-nowrap px-md py-sm text-right tabular-nums text-on-surface">{computeAge(p.dateOfBirth)}</td>
                          <td className="whitespace-nowrap px-md py-sm tabular-nums text-on-surface-variant">{formatClinicDateShort(p.dateOfBirth)}</td>
                          <td className="whitespace-nowrap px-md py-sm"><StatusPill status={p.accountStatus} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </fieldset>
            {filteredPatients.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-md text-label-md text-on-surface-variant">
                <span className="tabular-nums">
                  {(patientPage - 1) * PATIENTS_PAGE_SIZE + 1}–
                  {Math.min(patientPage * PATIENTS_PAGE_SIZE, filteredPatients.length)} of {filteredPatients.length}
                </span>
                <div className="flex items-center gap-sm">
                  <Button variant="secondary" className="px-md" disabled={patientPage <= 1} onClick={() => setPatientPage((p) => p - 1)}>
                    <Icon name="chevron_left" className="text-[14px]" />Previous
                  </Button>
                  <span className="tabular-nums">{patientPage} of {patientPageCount}</span>
                  <Button variant="secondary" className="px-md" disabled={patientPage >= patientPageCount} onClick={() => setPatientPage((p) => p + 1)}>
                    Next<Icon name="chevron_right" className="text-[14px]" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Sticky, not buried below a potentially-long patient list — Continue
            stays reachable at any scroll position. Names the selection so the
            receptionist can confirm who they picked without scrolling back. */}
        {step === 1 && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant bg-surface-container-lowest p-md md:left-sidebar">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <p className="min-w-0 text-body-md text-on-surface-variant" aria-live="polite">
                {patient ? <>Selected: <span className="font-medium text-on-surface">{patient.fullName}</span></> : "Select a patient to continue."}
              </p>
              <Button disabled={!patientId} onClick={() => setStep(2)} className="w-full sm:w-auto sm:min-w-48">
                Continue<Icon name="chevron_right" className="text-[14px]" />
              </Button>
            </div>
          </div>
        )}

        <Modal
          isOpen={quickRegisterOpen}
          onClose={() => { if (!registering) setQuickRegisterOpen(false); }}
          title="Register a new patient"
          footer={
            <>
              <Button variant="secondary" onClick={() => setQuickRegisterOpen(false)} disabled={registering}>
                Cancel
              </Button>
              <Button onClick={handleQuickRegister} disabled={!canQuickRegister} loading={registering}>
                {registering ? "Registering…" : "Register and select"}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            {registerError && <FormAlert className="sm:col-span-2">{registerError}</FormAlert>}
            {([
              ["firstName", "First name", true],
              ["middleName", "Middle name", false],
              ["lastName", "Last name", true],
            ] as const).map(([key, label, required]) => (
              <div key={key} className="space-y-xs">
                <label htmlFor={`qr-${key}`} className={labelStyles}>{label}{!required && <span className="font-normal text-on-surface-variant"> (optional)</span>}</label>
                <input id={`qr-${key}`} required={required} value={quickRegister[key]}
                  onChange={(e) => setQuickRegister((prev) => ({ ...prev, [key]: e.target.value }))} className={inputStyles()} />
              </div>
            ))}
            <div className="space-y-xs">
              <label htmlFor="qr-dob" className={labelStyles}>Date of birth</label>
              <input id="qr-dob" type="date" required max={todayManila()} value={quickRegister.dateOfBirth}
                onChange={(e) => setQuickRegister((prev) => ({ ...prev, dateOfBirth: e.target.value }))} className={inputStyles()} />
            </div>
            <div className="space-y-xs">
              <label htmlFor="qr-sex" className={labelStyles}>Sex</label>
              <select id="qr-sex" required value={quickRegister.sex}
                onChange={(e) => setQuickRegister((prev) => ({ ...prev, sex: e.target.value as "" | "Male" | "Female" }))} className={inputStyles()}>
                <option value="" disabled>Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="space-y-xs">
              <label htmlFor="qr-contact" className={labelStyles}>Contact number <span className="font-normal text-on-surface-variant">(optional)</span></label>
              <input id="qr-contact" type="tel" value={quickRegister.contactNumber}
                onChange={(e) => setQuickRegister((prev) => ({ ...prev, contactNumber: e.target.value }))} className={inputStyles()} />
            </div>
            <div className="space-y-xs sm:col-span-2">
              <label htmlFor="qr-address" className={labelStyles}>Address <span className="font-normal text-on-surface-variant">(optional)</span></label>
              <input id="qr-address" value={quickRegister.address}
                onChange={(e) => setQuickRegister((prev) => ({ ...prev, address: e.target.value }))} className={inputStyles()} />
            </div>
            <label className="flex min-h-11 items-start gap-sm text-body-md text-on-surface sm:col-span-2">
              <input type="checkbox" checked={preparePortal} onChange={(e) => setPreparePortal(e.target.checked)} className="mt-0.5 h-5 w-5 accent-primary" />
              <span>Prepare portal account <span className={`block ${hintStyles}`}>Creates login access; the patient sets a password on first login.</span></span>
            </label>
            {preparePortal && (
              <FormAlert tone="info" className="sm:col-span-2">
                Not wired yet — this registers as a guest record for now; portal invites need an email field this form doesn&apos;t collect.
              </FormAlert>
            )}
          </div>
        </Modal>

        {step === 2 && patient && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Confirm the visit</h2>

            {/* Patient identity up front, the way a ticket leads with who it's for. */}
            <div className="mb-lg rounded-lg border border-outline-variant bg-surface-container-low p-md">
              <p className="break-words text-headline-sm text-on-surface">{patient.fullName}</p>
              <p className="text-label-md text-on-surface-variant">
                <span className="font-mono">{patient.patientCode}</span> · {patient.sex} · <span className="tabular-nums">{computeAge(patient.dateOfBirth)} yrs</span>
              </p>
            </div>

            <div className="mb-lg space-y-lg">
              <div>
                <p id="walkin-visit-type" className={`mb-sm ${labelStyles}`}>Visit type</p>
                <div role="radiogroup" aria-labelledby="walkin-visit-type" className="inline-flex rounded-lg border border-outline-variant bg-surface-container-lowest p-xs">
                  {(["New", "FollowUp"] as const).map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      role="radio"
                      aria-checked={visitType === vt}
                      onClick={() => setVisitType(vt)}
                      className={cn(
                        "min-h-10 rounded-[calc(var(--radius)-var(--spacing-xs))] px-lg text-label-md transition-colors",
                        visitType === vt
                          ? "bg-primary text-on-primary shadow-sm"
                          : "text-on-surface-variant hover:text-on-surface",
                      )}
                    >
                      {vt === "New" ? "New visit" : "Follow-up"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="walkin-discount" className={`mb-sm ${labelStyles}`}>Discount</label>
                <div className="flex flex-wrap items-center gap-sm">
                  <select
                    id="walkin-discount"
                    value={discountCategory}
                    onChange={(e) => setDiscountCategory(e.target.value as "Senior" | "PWD" | "")}
                    className={inputStyles("w-auto min-w-48")}
                  >
                    <option value="">None</option>
                    <option value="Senior">Senior citizen</option>
                    <option value="PWD">PWD</option>
                  </select>
                  {discountCategory === "Senior" && patient?.dateOfBirth && isSeniorCitizen(patient.dateOfBirth) && (
                    <span className={hintStyles}>Set automatically: patient is 60 or older.</span>
                  )}
                </div>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-md rounded-lg border border-outline-variant p-md">
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

              <div className="flex items-start gap-sm rounded-lg bg-surface-container-low p-md">
                <Icon name="payments" className="mt-[2px] text-[16px] text-on-surface-variant" />
                <div>
                  <p className="text-label-md font-medium text-on-surface">Pay at clinic</p>
                  <p className="text-label-md text-on-surface-variant">
                    Provisional fee computed at check-in, finalised at consultation.
                  </p>
                </div>
              </div>
            </div>

            {createError && <FormAlert className="mb-md">{createError}</FormAlert>}
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(1)} disabled={creating} className="flex-1">
                <Icon name="chevron_left" className="text-[14px]" />Back
              </Button>
              <Button onClick={handleCheckIn} loading={creating} className="flex-[2]">
                {creating ? "Checking in…" : "Check in and get queue number"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
