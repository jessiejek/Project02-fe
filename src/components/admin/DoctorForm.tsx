"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { createDoctor } from "@/app/actions/createDoctor";
import { createClient } from "@/lib/supabase/client";
import { DAYS, dayNameToIndex } from "@/lib/days";
import type { Doctor, DoctorScheduleDay, ManagedService } from "@/data/types";

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
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(doctor?.services.map((s) => s.id) ?? []);
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>(doctor?.schedule ?? defaultSchedule());
  // Assign to Services writes to doctor_services — load the real services catalog.
  const [services, setServices] = useState<ManagedService[]>([]);
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("services").select("*").order("name");
      if (data) {
        setServices(
          data.map((s) => ({ id: s.service_id, name: s.name, category: s.category, description: s.description ?? undefined, price: Number(s.price), isActive: s.is_active, doctorNames: [] })),
        );
      }
    }
    load();
  }, []);

  const canSave =
    name.trim() !== "" &&
    specialization.trim() !== "" &&
    consultationFee.trim() !== "" &&
    (mode === "edit" || email.trim() !== "");

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

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
        serviceIds: selectedServiceIds,
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
    const supabase = createClient();
    const doctorId = doctor!.id;

    const { error: doctorError } = await supabase
      .from("doctors")
      .update({
        specialization,
        consultation_fee: Number(consultationFee) || 0,
        bio: bio || null,
        license_number: licenseNumber || null,
        ptr_number: ptrNumber || null,
        s2_number: s2Number || null,
        slot_duration_minutes: Number(slotDurationMinutes) || 30,
      })
      .eq("doctor_id", doctorId);
    if (doctorError) {
      setInviting(false);
      setInviteError("Could not save the doctor profile.");
      return;
    }

    await supabase.from("staff_accounts").update({ full_name: name, status }).eq("staff_id", doctorId);

    // Services can shrink or grow arbitrarily (unlike the fixed 7-row weekly
    // schedule), so delete-all-reinsert is the simplest correct approach —
    // same pattern already used for clinic_accepted_payment_methods.
    await supabase.from("doctor_services").delete().eq("doctor_id", doctorId);
    if (selectedServiceIds.length > 0) {
      await supabase.from("doctor_services").insert(
        selectedServiceIds.map((serviceId) => ({
          doctor_id: doctorId,
          service_id: serviceId,
          duration_minutes: Number(slotDurationMinutes) || 30,
        })),
      );
    }

    await supabase.from("doctor_schedules").upsert(
      schedule.map((d) => ({
        doctor_id: doctorId,
        day_of_week: dayNameToIndex(d.day),
        is_active: d.isActive,
        start_time: d.startTime,
        end_time: d.endTime,
      })),
      { onConflict: "doctor_id,day_of_week" },
    );

    setInviting(false);
    router.push("/admin/doctors");
  }

  return (
    <div className="mx-auto max-w-[44rem] space-y-lg">
      <h2 className="text-headline-lg text-on-surface">{mode === "create" ? "Add Doctor" : `Edit ${doctor?.name}`}</h2>

      <Card className="space-y-md">
        {inviteError && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{inviteError}</p>}
        {mode === "create" && (
          <p className="text-label-sm text-on-surface-variant">
            A real invite email will be sent — the account starts as &ldquo;Invited&rdquo; and becomes Active on their first login.
          </p>
        )}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
          <Icon name="person" className="text-[32px] text-on-surface-variant" />
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <input placeholder="Full Name*" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm" />
          <input
            placeholder="Doctor Email*"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={mode === "edit"}
            className="rounded-lg border border-outline-variant px-md py-sm disabled:opacity-50"
          />
          <input placeholder="Specialty*" value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm" />
          <input
            placeholder="Consultation Fee*"
            value={consultationFee}
            onChange={(e) => setConsultationFee(e.target.value)}
            className="rounded-lg border border-outline-variant px-md py-sm"
          />
          {/* admin.md §6 / doctor.md document these as 3 separate fields
              (licenseNumber/ptrNumber/s2Number) — was one merged input. */}
          <input placeholder="PRC License Number" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm" />
          <input placeholder="PTR Number" value={ptrNumber} onChange={(e) => setPtrNumber(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm" />
          <input placeholder="S2 Number" value={s2Number} onChange={(e) => setS2Number(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm" />
          {mode === "edit" && (
            <select value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Inactive" | "OnLeave")} className="rounded-lg border border-outline-variant px-md py-sm">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="OnLeave">OnLeave</option>
            </select>
          )}
          <input
            placeholder="Slot Duration (min)"
            value={slotDurationMinutes}
            onChange={(e) => setSlotDurationMinutes(e.target.value)}
            className="rounded-lg border border-outline-variant px-md py-sm"
          />
        </div>
        <textarea placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full rounded-lg border border-outline-variant p-md" />
      </Card>

      <Card>
        <h3 className="mb-md text-headline-sm text-on-surface">Assign to Services</h3>
        <div className="space-y-sm">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-sm text-body-md">
              <input type="checkbox" checked={selectedServiceIds.includes(s.id)} onChange={() => toggleService(s.id)} className="h-5 w-5" />
              {s.name}
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-md text-headline-sm text-on-surface">Weekly Schedule</h3>
        <div className="space-y-sm">
          {schedule.map((d) => (
            <div key={d.day} className="flex flex-wrap items-center gap-sm sm:gap-md">
              <label className="flex w-16 items-center gap-sm text-body-md">
                <input type="checkbox" checked={d.isActive} onChange={() => toggleDay(d.day)} className="h-5 w-5" />
                {d.day}
              </label>
              <div className="flex items-center gap-sm">
                <input
                  type="time"
                  value={d.startTime}
                  disabled={!d.isActive}
                  onChange={(e) => updateDayTime(d.day, { startTime: e.target.value })}
                  className="w-[7.5rem] rounded-lg border border-outline-variant px-md py-xs disabled:opacity-50"
                />
                <span>–</span>
                <input
                  type="time"
                  value={d.endTime}
                  disabled={!d.isActive}
                  onChange={(e) => updateDayTime(d.day, { endTime: e.target.value })}
                  className="w-[7.5rem] rounded-lg border border-outline-variant px-md py-xs disabled:opacity-50"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Button onClick={handleSave} disabled={!canSave || inviting}>
        {inviting ? (mode === "create" ? "Sending invite…" : "Saving…") : mode === "create" ? "Create" : "Save"}
      </Button>
    </div>
  );
}
