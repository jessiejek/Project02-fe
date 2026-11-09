"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/ui/FormAlert";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { hintStyles, inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { createDoctor } from "@/app/actions/createDoctor";
import { updateDoctor } from "@/lib/data/doctors";
import { updateStaffAccount } from "@/lib/data/staff";
import { upsertDoctorSchedule } from "@/lib/data/scheduling";
import { DAYS, dayNameToIndex } from "@/lib/days";
import type { Doctor, DoctorScheduleDay } from "@/data/types";

function defaultSchedule(): DoctorScheduleDay[] {
  return DAYS.map((day) => ({ day, isActive: day !== "Sun" && day !== "Sat", startTime: "08:00", endTime: "17:00" }));
}

export interface DoctorFormProps {
  mode: "create" | "edit";
  doctor?: Doctor;
}

// Shared by /admin/doctors/new and /admin/doctors/[id]/edit — Stitch
// doctor_form_create_edit. Reused rather than duplicated per
// React-Conversion-Guide.md §5. Previously had zero wired state at all and
// no Save handler whatsoever — found during the app-wide decorative-input sweep.
export function DoctorForm({ mode, doctor }: DoctorFormProps) {
  const router = useRouter();
  const [name, setName] = useState(doctor?.name ?? "");
  const [email, setEmail] = useState(doctor?.email ?? "");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [specialization, setSpecialization] = useState(doctor?.specialization ?? "");
  const [consultationFee, setConsultationFee] = useState(String(doctor?.consultationFee ?? ""));
  const [licenseNumber, setLicenseNumber] = useState(doctor?.licenseNumber ?? "");
  const [ptrNumber, setPtrNumber] = useState(doctor?.ptrNumber ?? "");
  const [s2Number, setS2Number] = useState(doctor?.s2Number ?? "");
  const [status, setStatus] = useState<"Active" | "Inactive" | "OnLeave">(doctor?.status ?? "Active");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(String(doctor?.slotDurationMinutes ?? 30));
  const [bio, setBio] = useState(doctor?.bio ?? "");
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>(doctor?.schedule ?? defaultSchedule());

  const canSave =
    name.trim() !== "" &&
    specialization.trim() !== "" &&
    consultationFee.trim() !== "" &&
    (mode === "edit" || email.trim() !== "");

  function toggleDay(day: string) {
    setSchedule((prev) => prev.map((d) => (d.day === day ? { ...d, isActive: !d.isActive } : d)));
  }

  function updateDayTime(day: string, patch: Partial<DoctorScheduleDay>) {
    setSchedule((prev) => prev.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  }

  async function handleSave() {
    if (!canSave) return;

    // Mirror doctor_schedules' own check constraint (not is_active or
    // end_time > start_time) before writing, same as doctor/schedule/page.tsx.
    const invalidDay = schedule.find((d) => d.isActive && !(d.endTime > d.startTime));
    if (invalidDay) {
      setInviteError(`${invalidDay.day}: end time must be after start time.`);
      return;
    }

    setInviteError("");
    setInviting(true);

    if (mode === "create") {
      // One server action fans out into all 4 tables with rollback on any
      // partial failure (Implementation-Phases/05-doctors-staff.md) —
      // replaces the old inviteStaffMember + 2 separate client-side inserts.
      const result = await createDoctor({
        email: email.trim().toLowerCase(),
        fullName: name,
        specialization,
        consultationFee: Number(consultationFee) || 0,
        bio,
        licenseNumber,
        ptrNumber,
        s2Number,
        slotDurationMinutes: Number(slotDurationMinutes) || 30,
        schedule,
      });
      setInviting(false);
      if (!result.success) {
        setInviteError(result.error);
        return;
      }
      router.push("/admin/doctors");
      return;
    }

    // Edit mode — doctor is guaranteed real here (Phase 5.4 migrated the
    // list/edit-by-id page off mockDoctors), no invite step needed.
    const supabase = null as never;
    const doctorId = doctor!.id;

    try {
      await updateDoctor(supabase, doctorId, {
        specialization,
        consultation_fee: Number(consultationFee) || 0,
        bio: bio || null,
        license_number: licenseNumber || null,
        ptr_number: ptrNumber || null,
        s2_number: s2Number || null,
        slot_duration_minutes: Number(slotDurationMinutes) || 30,
      });
    } catch {
      setInviting(false);
      setInviteError("Could not save the doctor profile.");
      return;
    }

    try {
      await updateStaffAccount(supabase, doctorId, { full_name: name, status });

      for (const d of schedule) {
        await upsertDoctorSchedule(supabase, doctorId, {
          day_of_week: dayNameToIndex(d.day),
          is_active: d.isActive,
          start_time: d.startTime,
          end_time: d.endTime,
        });
      }
    } catch {
      // The profile saved; surface the partial failure instead of hanging on "Saving…".
      setInviting(false);
      setInviteError("The profile was saved, but the account status or weekly hours could not be updated. Try saving again.");
      return;
    }

    setInviting(false);
    router.push("/admin/doctors");
  }

  const DAY_LABEL: Record<string, string> = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
  const fid = (key: string) => `doctor-${key}`;
  const section = "space-y-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg";

  return (
    <form className="mx-auto max-w-doctor-record space-y-lg" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      <PageHeader
        title={mode === "create" ? "Add a doctor" : `Edit ${doctor?.name || "doctor"}`}
        description={mode === "create"
          ? <>A real invite email will be sent. The account starts as &ldquo;Invited&rdquo; and becomes Active on their first login.</>
          : "Changes apply to booking, prescriptions and the doctor's own portal as soon as you save."}
      />

      {inviteError && <FormAlert>{inviteError}</FormAlert>}

      <section className={section} aria-labelledby={fid("account-h")}>
        <h2 id={fid("account-h")} className="text-headline-sm text-on-surface">Account</h2>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="space-y-xs">
            <label htmlFor={fid("name")} className={labelStyles}>Full name</label>
            <input id={fid("name")} required value={name} onChange={(e) => setName(e.target.value)} className={inputStyles()} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={fid("email")} className={labelStyles}>Email</label>
            <input id={fid("email")} type="email" required={mode === "create"} value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={mode === "edit"} aria-describedby={mode === "edit" ? fid("email-hint") : undefined} className={inputStyles()} />
            {mode === "edit" && <p id={fid("email-hint")} className={hintStyles}>The sign-in email can&apos;t be changed here.</p>}
          </div>
          {mode === "edit" && (
            <div className="space-y-xs">
              <label htmlFor={fid("status")} className={labelStyles}>Status</label>
              <select id={fid("status")} value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Inactive" | "OnLeave")} className={inputStyles()}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="OnLeave">On leave</option>
              </select>
            </div>
          )}
        </div>
      </section>

      <section className={section} aria-labelledby={fid("practice-h")}>
        <h2 id={fid("practice-h")} className="text-headline-sm text-on-surface">Practice</h2>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="space-y-xs">
            <label htmlFor={fid("spec")} className={labelStyles}>Specialty</label>
            <input id={fid("spec")} required value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={inputStyles()} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={fid("fee")} className={labelStyles}>Consultation fee (₱)</label>
            <input id={fid("fee")} required inputMode="decimal" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} className={inputStyles("tabular-nums")} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={fid("slot")} className={labelStyles}>Slot duration (minutes)</label>
            <input id={fid("slot")} inputMode="numeric" value={slotDurationMinutes} onChange={(e) => setSlotDurationMinutes(e.target.value)} className={inputStyles("tabular-nums")} />
          </div>
        </div>
        <div className="space-y-xs">
          <label htmlFor={fid("bio")} className={labelStyles}>Bio <span className="font-normal text-on-surface-variant">(shown to patients)</span></label>
          <textarea id={fid("bio")} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={inputStyles("py-md")} />
        </div>
      </section>

      <section className={section} aria-labelledby={fid("cred-h")}>
        <div>
          <h2 id={fid("cred-h")} className="text-headline-sm text-on-surface">Credentials</h2>
          <p className={hintStyles}>Printed on prescriptions and certificates.</p>
        </div>
        {/* admin.md §6 / doctor.md document these as 3 separate fields (licenseNumber/ptrNumber/s2Number). */}
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <div className="space-y-xs">
            <label htmlFor={fid("prc")} className={labelStyles}>PRC license number</label>
            <input id={fid("prc")} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={inputStyles("font-mono")} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={fid("ptr")} className={labelStyles}>PTR number</label>
            <input id={fid("ptr")} value={ptrNumber} onChange={(e) => setPtrNumber(e.target.value)} className={inputStyles("font-mono")} />
          </div>
          <div className="space-y-xs">
            <label htmlFor={fid("s2")} className={labelStyles}>S2 number</label>
            <input id={fid("s2")} value={s2Number} onChange={(e) => setS2Number(e.target.value)} className={inputStyles("font-mono")} />
          </div>
        </div>
      </section>

      <section className={section} aria-labelledby={fid("hours-h")}>
        <h2 id={fid("hours-h")} className="text-headline-sm text-on-surface">Weekly hours</h2>
        <div className="divide-y divide-outline-variant">
          {schedule.map((d) => (
            <div key={d.day} className="flex flex-wrap items-center justify-between gap-sm py-sm sm:gap-md">
              <label className="flex min-h-11 min-w-32 items-center gap-sm text-body-md text-on-surface">
                <input type="checkbox" checked={d.isActive} onChange={() => toggleDay(d.day)} className="h-5 w-5 accent-primary" />
                {DAY_LABEL[d.day] ?? d.day}
              </label>
              {d.isActive ? (
                <div className="flex items-center gap-sm">
                  <input type="time" aria-label={`${DAY_LABEL[d.day] ?? d.day} start`} value={d.startTime}
                    onChange={(e) => updateDayTime(d.day, { startTime: e.target.value })} className={inputStyles("w-[8.5rem] tabular-nums")} />
                  <span aria-hidden="true" className="text-on-surface-variant">–</span>
                  <input type="time" aria-label={`${DAY_LABEL[d.day] ?? d.day} end`} value={d.endTime}
                    onChange={(e) => updateDayTime(d.day, { endTime: e.target.value })} className={inputStyles("w-[8.5rem] tabular-nums")} />
                </div>
              ) : (
                <span className="text-body-md text-on-surface-variant">Not working</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-sm">
        <Link href="/admin/doctors" className={buttonStyles("secondary")}>Cancel</Link>
        <Button type="submit" disabled={!canSave} loading={inviting}>
          {inviting ? (mode === "create" ? "Sending invite…" : "Saving…") : mode === "create" ? "Send invite" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
