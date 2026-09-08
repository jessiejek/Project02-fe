"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { DAYS, dayNameToIndex, indexToDayName } from "@/lib/days";
import type { DoctorScheduleDay } from "@/data/types";

function defaultSchedule(): DoctorScheduleDay[] {
  return DAYS.map((day) => ({ day, isActive: day !== "Sun" && day !== "Sat", startTime: "08:00", endTime: "17:00" }));
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string;
}

// Stitch schedule_management_doctor, including the Addendum D12 interim fix:
// warn about existing bookings before confirming a blocked date. Previously
// used its own local, non-persisted DaySchedule shape scoped to no doctor in
// particular, and its per-day time inputs + Slot Settings + Save were all
// unwired — found during the app-wide decorative-input sweep.
export default function DoctorSchedulePage() {
  const { session } = useSession();
  const meDoctorId = session?.staffId ?? "";

  if (!meDoctorId) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading your schedule…</p>
      </AppShell>
    );
  }

  // Keyed by doctorId so this editor only ever mounts once the real session
  // resolves — its useState initial values seed correctly on that one real
  // mount, and its own useEffect below fetches the real rows.
  return <ScheduleEditor key={meDoctorId} doctorId={meDoctorId} />;
}

function ScheduleEditor({ doctorId }: { doctorId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>(defaultSchedule());
  const [slotDurationMinutes, setSlotDurationMinutes] = useState("30");
  const [slotCapacity, setSlotCapacity] = useState("1");
  const [dailyPatientLimit, setDailyPatientLimit] = useState("");
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [addingDate, setAddingDate] = useState<{ date: string; reason: string } | null>(null);
  const [affectedCount, setAffectedCount] = useState(0);
  const [affectedLoading, setAffectedLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [doctorRes, scheduleRes, blockedRes] = await Promise.all([
        supabase.from("doctors").select("slot_duration_minutes, slot_capacity, daily_patient_limit").eq("doctor_id", doctorId).single(),
        supabase.from("doctor_schedules").select("*").eq("doctor_id", doctorId).order("day_of_week"),
        supabase.from("doctor_blocked_dates").select("*").eq("doctor_id", doctorId).order("blocked_date"),
      ]);
      if (doctorRes.data) {
        setSlotDurationMinutes(String(doctorRes.data.slot_duration_minutes));
        setSlotCapacity(String(doctorRes.data.slot_capacity));
        setDailyPatientLimit(doctorRes.data.daily_patient_limit != null ? String(doctorRes.data.daily_patient_limit) : "");
      }
      if (scheduleRes.data && scheduleRes.data.length > 0) {
        setSchedule(
          scheduleRes.data.map((d) => ({
            day: indexToDayName(d.day_of_week),
            isActive: d.is_active,
            startTime: d.start_time.slice(0, 5),
            endTime: d.end_time.slice(0, 5),
          })),
        );
      }
      if (blockedRes.data) {
        setBlockedDates(blockedRes.data.map((b) => ({ id: b.id, date: b.blocked_date, reason: b.reason ?? "" })));
      }
      setLoaded(true);
    }
    load();
  }, [doctorId]);

  // Count this doctor's non-cancelled bookings on the date being blocked
  // (Addendum D12 interim warning — remaining.md A.4).
  useEffect(() => {
    const date = addingDate?.date;
    if (!date) {
      setAffectedCount(0);
      setAffectedLoading(false);
      return;
    }
    let cancelled = false;
    async function countAffected() {
      setAffectedLoading(true);
      const supabase = createClient();
      const { count } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .eq("appointment_date", date)
        .neq("status", "Cancelled");
      if (!cancelled) {
        setAffectedCount(count ?? 0);
        setAffectedLoading(false);
      }
    }
    countAffected();
    return () => {
      cancelled = true;
    };
  }, [addingDate?.date, doctorId]);

  function toggleDay(day: string) {
    setSchedule((prev) => prev.map((d) => (d.day === day ? { ...d, isActive: !d.isActive } : d)));
  }

  function updateDayTime(day: string, patch: Partial<DoctorScheduleDay>) {
    setSchedule((prev) => prev.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  }

  async function handleSave() {
    // Mirror the database's own check constraint (not is_active or end_time >
    // start_time) client-side first, so a bad range surfaces as a real form
    // message instead of a raw Postgres error in a toast.
    const invalidDay = schedule.find((d) => d.isActive && !(d.endTime > d.startTime));
    if (invalidDay) {
      setError(`${invalidDay.day}: end time must be after start time.`);
      return;
    }
    setError("");

    const supabase = createClient();
    await supabase
      .from("doctors")
      .update({
        slot_duration_minutes: Number(slotDurationMinutes) || 30,
        slot_capacity: Number(slotCapacity) || 1,
        daily_patient_limit: dailyPatientLimit.trim() ? Number(dailyPatientLimit) : null,
      })
      .eq("doctor_id", doctorId);

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

    setSavedAt(new Date().toLocaleTimeString());
  }

  async function addBlockedDate() {
    if (!addingDate?.date) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("doctor_blocked_dates")
      .insert({ doctor_id: doctorId, blocked_date: addingDate.date, reason: addingDate.reason || null })
      .select("id")
      .single();
    if (data) {
      setBlockedDates((prev) => [...prev, { id: data.id, date: addingDate.date, reason: addingDate.reason }]);
    }
    setAddingDate(null);
  }

  async function removeBlockedDate(id: string) {
    const supabase = createClient();
    await supabase.from("doctor_blocked_dates").delete().eq("id", id);
    setBlockedDates((prev) => prev.filter((b) => b.id !== id));
  }

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading your schedule…</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor">
      <div className="space-y-lg">
        {savedAt && <Toast key={savedAt} variant="success" message={`Schedule saved at ${savedAt}.`} />}
        <h2 className="text-headline-lg text-on-surface">Schedule Management</h2>
        {error && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Weekly Schedule</h3>
          <div className="space-y-sm">
            {schedule.map((d) => (
              <div key={d.day} className="flex flex-wrap items-center gap-sm sm:gap-md">
                <label className="flex w-24 items-center gap-sm text-body-md">
                  <input type="checkbox" checked={d.isActive} onChange={() => toggleDay(d.day)} className="h-5 w-5" />
                  {d.day}
                </label>
                <div className="flex items-center gap-sm">
                  <input
                    type="time"
                    value={d.startTime}
                    disabled={!d.isActive}
                    onChange={(e) => updateDayTime(d.day, { startTime: e.target.value })}
                    className="w-[7.5rem] rounded-lg border border-outline-variant px-md py-xs disabled:opacity-40"
                  />
                  <span>–</span>
                  <input
                    type="time"
                    value={d.endTime}
                    disabled={!d.isActive}
                    onChange={(e) => updateDayTime(d.day, { endTime: e.target.value })}
                    className="w-[7.5rem] rounded-lg border border-outline-variant px-md py-xs disabled:opacity-40"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Slot Settings</h3>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <input
              placeholder="Slot Duration (min)"
              value={slotDurationMinutes}
              onChange={(e) => setSlotDurationMinutes(e.target.value)}
              className="rounded-lg border border-outline-variant px-md py-sm"
            />
            <input
              placeholder="Slot Capacity"
              value={slotCapacity}
              onChange={(e) => setSlotCapacity(e.target.value)}
              className="rounded-lg border border-outline-variant px-md py-sm"
            />
            <input
              placeholder="Daily Patient Limit"
              value={dailyPatientLimit}
              onChange={(e) => setDailyPatientLimit(e.target.value)}
              className="rounded-lg border border-outline-variant px-md py-sm"
            />
          </div>
        </Card>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Blocked Dates</h3>
          <div className="mb-md space-y-sm">
            {blockedDates.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-outline-variant p-md">
                <span className="text-body-md">{b.date} — {b.reason}</span>
                <button type="button" onClick={() => removeBlockedDate(b.id)} className="text-on-surface-variant">
                  <Icon name="delete" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setAddingDate({ date: "", reason: "" })}>
            + Add Blocked Date
          </Button>
        </Card>

        <Button onClick={handleSave}>Save</Button>
      </div>

      <Modal
        isOpen={addingDate !== null}
        onClose={() => setAddingDate(null)}
        title="Add Blocked Date"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingDate(null)}>
              Cancel
            </Button>
            <Button onClick={addBlockedDate} disabled={!addingDate?.date}>
              Proceed
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          <DatePicker
            value={addingDate?.date ?? ""}
            onChange={(date) => setAddingDate((prev) => (prev ? { ...prev, date } : prev))}
          />
          <input
            placeholder="Reason"
            value={addingDate?.reason ?? ""}
            onChange={(e) => setAddingDate((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          {addingDate?.date ? (
            <p className="rounded-lg bg-amber-50 px-md py-sm text-label-md text-amber-700">
              {affectedLoading
                ? "Checking bookings on this date…"
                : `${affectedCount} patient${affectedCount === 1 ? "" : "s"} booked on this date (excluding cancelled). Blocking will not automatically notify or reschedule them — Staff will need to follow up.`}
            </p>
          ) : (
            <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
              Pick a date to see how many existing bookings would be affected.
            </p>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
