"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import { queryDoctors } from "@/lib/data/doctors";
import { registerPatientAccount } from "@/app/actions/registerPatientAccount";
import { parseSlotTo24h, addMinutes } from "@/lib/bookingTime";
import { one } from "@/lib/one";
import { cn } from "@/lib/cn";

const STEPS = ["Doctor", "Date", "Time", "Review", "Sign in", "Payment"];
const SLOTS = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "02:00 PM", "02:30 PM"];
// Booking window matches the old mock's own "30 days" count, now backed by
// real dates instead of bare day-of-month integers — see
// Database-Schema-Design.md §D's "Date representation" note.
const BOOKING_WINDOW_DAYS = 30;

interface BookingDoctor {
  id: string;
  name: string;
  specialization: string;
  consultationFee: number;
  rating: number;
  slotDurationMinutes: number;
  services: { id: string; name: string; price: number }[];
}

// Stitch screens 6-11 — the 6-step public booking wizard, one stateful
// component per React-Conversion-Guide.md §4 (one screen family, one
// component with step state, not 6 separate components).
function BookingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDoctorId = searchParams.get("doctorId");

  const [step, setStep] = useState(1);
  const [doctors, setDoctors] = useState<BookingDoctor[]>([]);
  // day_of_week (0-6) -> is_active, and a set of blocked "YYYY-MM-DD"
  // strings, both keyed by doctor_id — fetched once up front (small
  // dataset) rather than re-fetched every time a different doctor is picked.
  const [schedulesByDoctor, setSchedulesByDoctor] = useState<Record<string, Record<number, boolean>>>({});
  const [blockedByDoctor, setBlockedByDoctor] = useState<Record<string, Set<string>>>({});
  const [doctorId, setDoctorId] = useState<string | null>(preselectedDoctorId);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<"login" | "register">("login");
  const [paymentMode, setPaymentMode] = useState<"PayAtClinic" | "Online">("PayAtClinic");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerDob, setRegisterDob] = useState("");
  const [registerContact, setRegisterContact] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerSex, setRegisterSex] = useState<"" | "Male" | "Female">("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  // Set once step 5 resolves a real patients.patient_id (via signup or
  // login), then used directly in the real booking insert on submit.
  const [patientId, setPatientId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [allDoctors, ratingsRes, servicesRes, schedulesRes, blockedRes] = await Promise.all([
        queryDoctors(supabase),
        supabase.from("v_doctor_ratings").select("*"),
        supabase.from("doctor_services").select("doctor_id, service_id, services(name, price)"),
        supabase.from("doctor_schedules").select("*"),
        supabase.from("doctor_blocked_dates").select("*"),
      ]);
      const ratingByDoctor = new Map((ratingsRes.data ?? []).map((r) => [r.doctor_id, r.average_rating]));
      const activeDoctors = allDoctors.filter((d) => d.staff_accounts?.status !== "Inactive");
      setDoctors(
        activeDoctors.map((d) => ({
          id: d.doctor_id,
          name: d.staff_accounts?.full_name ?? "",
          specialization: d.specialization,
          consultationFee: Number(d.consultation_fee),
          rating: Number(ratingByDoctor.get(d.doctor_id) ?? 0),
          slotDurationMinutes: d.slot_duration_minutes,
          services: (servicesRes.data ?? [])
            .filter((s) => s.doctor_id === d.doctor_id)
            .map((s) => {
              const service = one(s.services);
              return { id: s.service_id, name: service?.name ?? "", price: Number(service?.price ?? 0) };
            }),
        })),
      );

      const schedules: Record<string, Record<number, boolean>> = {};
      for (const row of schedulesRes.data ?? []) {
        schedules[row.doctor_id] ??= {};
        schedules[row.doctor_id][row.day_of_week] = row.is_active;
      }
      setSchedulesByDoctor(schedules);

      const blocked: Record<string, Set<string>> = {};
      for (const row of blockedRes.data ?? []) {
        blocked[row.doctor_id] ??= new Set();
        blocked[row.doctor_id].add(row.blocked_date);
      }
      setBlockedByDoctor(blocked);
    }
    load();
  }, []);

  const canContinueStep5 =
    accountMode === "login"
      ? loginEmail.trim() !== "" && loginPassword.trim() !== ""
      : registerFirstName.trim() !== "" &&
        registerLastName.trim() !== "" &&
        registerDob.trim() !== "" &&
        registerContact.trim() !== "" &&
        registerEmail.trim() !== "" &&
        registerPassword.trim() !== "" &&
        registerSex !== "";
  const canSubmitBooking = paymentMode !== "Online" || referenceNumber.trim() !== "";

  const doctor = doctors.find((d) => d.id === doctorId);
  const selectedServices = doctor?.services.filter((s) => serviceIds.includes(s.id)) ?? [];
  // total_fee = consultation_fee_snapshot + sum(booking_services.price_at_booking)
  // per Database-Schema-Design.md §D — the old mock UI summed services only,
  // omitting the doctor's own consultation fee entirely.
  const totalFee = (doctor?.consultationFee ?? 0) + selectedServices.reduce((sum, s) => sum + s.price, 0);

  // Real dates, disabled for any of 3 real reasons instead of the old fake
  // "day < 5" stand-in — see Database-Schema-Design.md §D's "Date
  // representation" note.
  const doctorSchedule = doctorId ? schedulesByDoctor[doctorId] : undefined;
  const doctorBlocked = doctorId ? blockedByDoctor[doctorId] : undefined;
  const availableDates = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const scheduleInactive = doctorSchedule ? doctorSchedule[d.getDay()] === false : false;
    const blocked = doctorBlocked?.has(iso) ?? false;
    return { iso, dayOfMonth: d.getDate(), disabled: scheduleInactive || blocked };
  });

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    if (!doctor || !date || !slot || !patientId) return;
    setSubmitError("");
    setSubmitting(true);
    const supabase = createClient();

    const startTime = parseSlotTo24h(slot);
    const endTime = addMinutes(startTime, doctor.slotDurationMinutes || 30);

    // Queue number generation — application-level count-then-format, a
    // deliberate choice over a Postgres function; see Database-Schema-Design.md
    // §D's "Queue number generation" note for the reasoning and the known
    // race-condition tradeoff.
    const { count } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("doctor_id", doctor.id)
      .eq("appointment_date", date);
    const queueNumber = `${(doctor.name ?? "").trim().charAt(0).toUpperCase() || "Q"}-${(count ?? 0) + 1}`;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        patient_id: patientId,
        doctor_id: doctor.id,
        appointment_date: date,
        slot_start_time: startTime,
        slot_end_time: endTime,
        status: paymentMode === "Online" ? "ProofSubmitted" : "Pending",
        payment_mode: paymentMode,
        queue_number: queueNumber,
        consultation_fee_snapshot: doctor.consultationFee,
        total_fee: totalFee,
        amount_due: totalFee,
        proof_type: paymentMode === "Online" ? "ReferenceNumber" : null,
        proof_value: paymentMode === "Online" ? referenceNumber : null,
      })
      .select("booking_id")
      .single();
    if (bookingError || !booking) {
      setSubmitting(false);
      setSubmitError("Could not create your booking. Please try again.");
      return;
    }

    if (selectedServices.length > 0) {
      await supabase.from("booking_services").insert(
        selectedServices.map((s) => ({ booking_id: booking.booking_id, service_id: s.id, price_at_booking: s.price })),
      );
    }
    await supabase.from("payments").insert({ booking_id: booking.booking_id, amount: totalFee, status: "Unpaid" });

    setSubmitting(false);
    router.push(`/booking/confirmation/${booking.booking_id}?queue=${queueNumber}`);
  }

  async function handleStep5Continue() {
    setAuthError("");
    setAuthSubmitting(true);
    const supabase = createClient();

    if (accountMode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error || !data.user) {
        setAuthError("Incorrect email or password.");
        setAuthSubmitting(false);
        return;
      }
      const { data: patient } = await supabase.from("patients").select("patient_id").eq("user_id", data.user.id).single();
      if (!patient) {
        setAuthError("This account has no patient profile yet. Contact the clinic.");
        setAuthSubmitting(false);
        return;
      }
      setPatientId(patient.patient_id);
    } else {
      if (!registerSex) {
        setAuthError("Please select a sex.");
        setAuthSubmitting(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email: registerEmail, password: registerPassword });
      if (error || !data.user) {
        setAuthError(error?.message ?? "Could not create your account.");
        setAuthSubmitting(false);
        return;
      }
      // Profile + patient rows are created server-side with role forced to
      // Patient — never accept a role from the browser (truthDare Phase 1.3).
      const result = await registerPatientAccount({
        firstName: registerFirstName,
        lastName: registerLastName,
        dateOfBirth: registerDob,
        sex: registerSex,
        contactNumber: registerContact,
        email: registerEmail,
      });
      if (!result.success) {
        setAuthError(result.error);
        setAuthSubmitting(false);
        return;
      }
      setPatientId(result.patientId);
    }

    setAuthSubmitting(false);
    setStep(6);
  }

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[48rem]">
        <StepIndicator steps={STEPS} currentStep={step} />

        {step === 1 && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Choose Your Specialist</h2>
            <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-2">
              {doctors.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setDoctorId(doc.id)}
                  className={cn(
                    "rounded-xl border p-lg text-left transition-all hover:border-primary hover:shadow-md",
                    doctorId === doc.id ? "border-primary ring-2 ring-primary/20" : "border-outline-variant",
                  )}
                >
                  <h3 className="text-headline-sm text-on-surface">{doc.name}</h3>
                  <p className="mb-xs text-label-md text-primary">{doc.specialization}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    <Icon name="star" className="align-middle text-[14px] text-tertiary" />{" "}
                    {doc.rating} · ₱{doc.consultationFee}
                  </p>
                </button>
              ))}
            </div>
            {doctor && (
              <>
                <h3 className="mb-sm text-headline-sm text-on-surface">Select Services</h3>
                <div className="mb-lg space-y-sm">
                  {doctor.services.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-outline-variant p-md"
                    >
                      <span className="flex items-center gap-sm text-body-md">
                        <input
                          type="checkbox"
                          checked={serviceIds.includes(s.id)}
                          onChange={() => toggleService(s.id)}
                          className="h-5 w-5 rounded border-outline-variant text-primary"
                        />
                        {s.name}
                      </span>
                      <span className="text-label-md text-on-surface-variant">₱{s.price}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
            <Button disabled={!doctor || serviceIds.length === 0} onClick={() => setStep(2)} className="w-full">
              Continue
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Select a Date</h2>
            <div className="mb-lg grid grid-cols-7 gap-xs">
              {availableDates.map(({ iso, dayOfMonth, disabled }) => (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDate(iso)}
                  title={iso}
                  className={cn(
                    "aspect-square rounded-lg text-label-md transition-colors",
                    disabled && "cursor-not-allowed text-outline-variant",
                    !disabled && date !== iso && "hover:bg-surface-container-high",
                    date === iso && "bg-primary text-on-primary",
                  )}
                >
                  {dayOfMonth}
                </button>
              ))}
            </div>
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button disabled={!date} onClick={() => setStep(3)} className="flex-1">
                Continue
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Select a Time Slot</h2>
            <div className="mb-lg grid grid-cols-2 gap-md sm:grid-cols-3">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={cn(
                    "rounded-lg border p-md text-label-md transition-colors",
                    slot === s ? "border-primary bg-primary text-on-primary" : "border-outline-variant hover:bg-surface-container-high",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            {slot && (
              <p className="mb-lg">
                <span className="rounded-full bg-amber-100 px-sm py-xs text-label-sm text-amber-700">
                  Slot held for 8 min
                </span>
              </p>
            )}
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button disabled={!slot} onClick={() => setStep(4)} className="flex-1">
                Continue
              </Button>
            </div>
          </Card>
        )}

        {step === 4 && doctor && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Review Your Booking</h2>
            <div className="mb-lg space-y-sm rounded-lg bg-surface-container-low p-md text-body-md">
              <p>
                <strong>Doctor:</strong> {doctor.name}
              </p>
              <p>
                <strong>Services:</strong> {selectedServices.map((s) => s.name).join(", ")}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {date && new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <p>
                <strong>Time:</strong> {slot}
              </p>
              <p>
                <strong>Total Fee:</strong> ₱{totalFee}
              </p>
            </div>
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(3)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(5)} className="flex-1">
                Confirm &amp; Continue
              </Button>
            </div>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <div className="mb-lg flex gap-md border-b border-outline-variant">
              <button
                type="button"
                onClick={() => setAccountMode("login")}
                className={cn("border-b-2 px-xs py-sm text-label-md", accountMode === "login" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setAccountMode("register")}
                className={cn("border-b-2 px-xs py-sm text-label-md", accountMode === "register" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
              >
                Register
              </button>
            </div>
            <div className="mb-lg space-y-md">
              {authError && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{authError}</p>}
              {accountMode === "login" ? (
                <>
                  <input
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                  <input
                    placeholder="Password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                </>
              ) : (
                <>
                  <input
                    placeholder="First name"
                    value={registerFirstName}
                    onChange={(e) => setRegisterFirstName(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                  <input
                    placeholder="Last name"
                    value={registerLastName}
                    onChange={(e) => setRegisterLastName(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                  <input
                    placeholder="Date of birth"
                    type="date"
                    value={registerDob}
                    onChange={(e) => setRegisterDob(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                  <select
                    value={registerSex}
                    onChange={(e) => setRegisterSex(e.target.value as "" | "Male" | "Female")}
                    className="w-full rounded-lg border border-outline-variant px-md py-md text-body-md"
                  >
                    <option value="">Sex*</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <input
                    placeholder="Contact number"
                    value={registerContact}
                    onChange={(e) => setRegisterContact(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                  <input
                    placeholder="Password"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant px-md py-md"
                  />
                </>
              )}
            </div>
            <div className="flex gap-md">
              <Button variant="secondary" onClick={() => setStep(4)} className="flex-1">
                Back
              </Button>
              <Button disabled={!canContinueStep5 || authSubmitting} onClick={handleStep5Continue} className="flex-1">
                {authSubmitting ? "Please wait…" : "Continue"}
              </Button>
            </div>
          </Card>
        )}

        {step === 6 && (
          <Card>
            <h2 className="mb-md text-headline-md text-on-surface">Confirm &amp; Payment</h2>
            {patientId && (
              <p className="mb-md text-label-sm text-on-surface-variant">Signed in as patient {patientId.slice(0, 8)}…</p>
            )}
            <div className="mb-lg rounded-lg bg-surface-container-low p-md text-body-md">
              <strong>Total Due:</strong> ₱{totalFee}
            </div>
            <div className="mb-lg grid grid-cols-1 gap-md sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMode("PayAtClinic")}
                className={cn("rounded-xl border p-lg text-left", paymentMode === "PayAtClinic" ? "border-primary ring-2 ring-primary/20" : "border-outline-variant")}
              >
                <h3 className="text-headline-sm text-on-surface">Pay at Clinic</h3>
                <p className="text-label-md text-on-surface-variant">Settled after visit</p>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("Online")}
                className={cn("rounded-xl border p-lg text-left", paymentMode === "Online" ? "border-primary ring-2 ring-primary/20" : "border-outline-variant")}
              >
                <h3 className="text-headline-sm text-on-surface">Pay Online</h3>
                <p className="text-label-md text-on-surface-variant">Submit proof of payment</p>
              </button>
            </div>
            {paymentMode === "Online" && (
              <div className="mb-lg space-y-md">
                <input
                  placeholder="Reference Number"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant px-md py-md"
                />
                <div className="rounded-lg border border-dashed border-outline-variant p-lg text-center text-body-md text-on-surface-variant">
                  Drop a screenshot here
                </div>
              </div>
            )}
            {submitError && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{submitError}</p>}
            <Button disabled={!canSubmitBooking || submitting} onClick={handleSubmit} className="w-full">
              {submitting ? "Submitting…" : "Submit Booking"}
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export default function BookingPage() {
  return (
    <Suspense>
      <BookingWizard />
    </Suspense>
  );
}
