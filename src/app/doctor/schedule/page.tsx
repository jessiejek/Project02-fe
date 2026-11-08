"use client";

import { useEffect, useState } from "react";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toast } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { DAYS, dayNameToIndex, indexToDayName } from "@/lib/days";
import { queryDoctorById, updateDoctor } from "@/lib/data/doctors";
import {
  queryDoctorSchedules,
  upsertDoctorSchedule,
  queryBlockedDates,
  addBlockedDate as addBlockedDateApi,
  removeBlockedDate as removeBlockedDateApi,
} from "@/lib/data/scheduling";
import { queryBookings } from "@/lib/data/bookings";
import type { DoctorScheduleDay } from "@/data/types";

function defaultSchedule(): DoctorScheduleDay[] {
  return DAYS.map((day) => ({ day, isActive: false, startTime: "", endTime: "" }));
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
        <SkeletonCard lines={5} />
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
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [affectedError, setAffectedError] = useState(false);
  const [schedule, setSchedule] = useState<DoctorScheduleDay[]>(defaultSchedule());
  const [dailyPatientLimit, setDailyPatientLimit] = useState("");
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [addingDate, setAddingDate] = useState<{ date: string; reason: string } | null>(null);
  const [affectedCount, setAffectedCount] = useState(0);
  const [affectedLoading, setAffectedLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
      const supabase = null as never;
      const [doctor, scheduleRows, blockedRows] = await Promise.all([
        queryDoctorById(supabase, doctorId),
        queryDoctorSchedules(supabase, doctorId),
        queryBlockedDates(supabase, doctorId),
      ]);
      if (cancelled) return;
      if (!doctor) throw new Error("Doctor profile unavailable");
      if (doctor) {
        setDailyPatientLimit(doctor.daily_patient_limit != null ? String(doctor.daily_patient_limit) : "");
      }
      if (scheduleRows.length > 0) {
        setSchedule(
          scheduleRows.map((d) => ({
            day: indexToDayName(d.day_of_week),
            isActive: d.is_active,
            startTime: d.start_time.slice(0, 5),
            endTime: d.end_time.slice(0, 5),
          })),
        );
      }
      setBlockedDates(blockedRows.map((b) => ({ id: b.id, date: b.blocked_date, reason: b.reason ?? "" })));
      setLoaded(true);
      } catch { if (!cancelled) setLoadError(true); }
    }
    load();
    return () => { cancelled = true; };
  }, [doctorId, attempt]);

  // Count this doctor's non-cancelled bookings on the date being blocked
  // (Addendum D12 interim warning — remaining.md A.4).
  //JJQR - AI (Oct 31, 2026)
  const blockTargetDate = addingDate?.date;
  const displayAffectedCount = blockTargetDate ? affectedCount : 0;
  const displayAffectedLoading = blockTargetDate ? affectedLoading : false;
  //JJQR - END
  useEffect(() => {
    const date = addingDate?.date;
    if (!date) {
      return;
    }
    let cancelled = false;
    async function countAffected() {
      setAffectedLoading(true);
      const supabase = null as never;
      try {
      const rows = await queryBookings(supabase, { doctorId, date });
      if (!cancelled) setAffectedError(false);
      if (!cancelled) {
        setAffectedCount(rows.filter((b) => b.status !== "Cancelled").length);
        setAffectedLoading(false);
      }
      } catch { if (!cancelled) { setAffectedError(true); setAffectedLoading(false); } }
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
    if (saving) return;
    if (dailyPatientLimit.trim() && (!Number.isInteger(Number(dailyPatientLimit)) || Number(dailyPatientLimit) < 0)) { setError("Daily patient limit must be a non-negative whole number, or blank for no limit."); return; }
    setError("");
    setSaving(true);
    try {
    const supabase = null as never;
    await updateDoctor(supabase, doctorId, {
      daily_patient_limit: dailyPatientLimit.trim() ? Number(dailyPatientLimit) : null,
    });

    for (const d of schedule) {
      await upsertDoctorSchedule(supabase, doctorId, {
        day_of_week: dayNameToIndex(d.day),
        is_active: d.isActive,
        start_time: d.startTime,
        end_time: d.endTime,
      });
    }

    setSavedAt(new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" }));
    } catch { setError("Your availability could not be fully saved. Review the hours and try again."); }
    finally { setSaving(false); }
  }

  async function addBlockedDate() {
    if (!addingDate?.date || blocking || affectedLoading || affectedError) return;
    setBlocking(true);
    try {
    const supabase = null as never;
    const row = await addBlockedDateApi(supabase, doctorId, addingDate.date, addingDate.reason || null);
    setBlockedDates((prev) => [...prev, { id: row.id, date: addingDate.date, reason: addingDate.reason }]);
    setAddingDate(null);
    } catch { setError("This date could not be blocked. Please try again."); }
    finally { setBlocking(false); }
  }

  async function removeBlockedDate(id: string) {
    const supabase = null as never;
    try {
      await removeBlockedDateApi(supabase, id);
      setBlockedDates((prev) => prev.filter((b) => b.id !== id));
    } catch { setError("The blocked date could not be removed. Please try again."); }
  }

  if (loadError) return <AppShell role="doctor"><ErrorState title="Availability unavailable" message="Your schedule could not be loaded. Please try again." onRetry={() => { setLoadError(false); setAttempt(a => a+1); }} /></AppShell>;

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <SkeletonCard lines={5} />
      </AppShell>
    );
  }

  return (
    <AppShell role="doctor">
      <div className="space-y-lg">
        {savedAt && <Toast key={savedAt} variant="success" message={`Schedule saved at ${savedAt}.`} />}
        <DoctorPageHeader title="Clinic availability" description="Set your weekly hours, daily patient limit and dates away from the clinic." />
        {error && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}

        <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
          The clinic runs a walk-in FCFS queue — there are no appointment slots.
          These hours are informational (shown to patients); day-to-day availability
          is set from the dashboard status toggle.
        </p>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Weekly Hours</h3>
          <div className="space-y-sm">
            {schedule.map((d) => (
              <div key={d.day} className="flex flex-wrap items-center justify-between gap-md border-b border-outline-variant py-md last:border-0">
                <label className="flex w-24 items-center gap-sm text-body-md">
                  <input type="checkbox" checked={d.isActive} onChange={() => toggleDay(d.day)} className="h-5 w-5" />
                  {d.day}
                </label>
                <div className="flex items-center gap-sm">
                  <input
                    aria-label={`${d.day} opening time`}
                    type="time"
                    value={d.startTime}
                    disabled={!d.isActive}
                    onChange={(e) => updateDayTime(d.day, { startTime: e.target.value })}
                    className="w-[7.5rem] rounded-lg border border-outline-variant px-md py-xs disabled:opacity-40"
                  />
                  <span>–</span>
                  <input
                    aria-label={`${d.day} closing time`}
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
          <h3 className="mb-sm text-headline-sm text-on-surface">Daily patient limit</h3><p className="mb-md text-body-md text-on-surface-variant">Leave blank for no limit.</p>
          <input
            aria-label="Daily patient limit" type="number" min="0" step="1" placeholder="No limit"
            value={dailyPatientLimit}
            onChange={(e) => setDailyPatientLimit(e.target.value)}
            className="w-full rounded-lg border border-outline-variant px-md py-sm sm:w-72"
          />
        </Card>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Blocked Dates</h3>
          <div className="mb-md space-y-sm">
            {blockedDates.length === 0 && <p className="text-body-md text-on-surface-variant">No blocked dates. Your weekly hours apply.</p>}
            {blockedDates.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-outline-variant p-md">
                <span className="text-body-md">{b.date} — {b.reason}</span>
                <button type="button" onClick={() => removeBlockedDate(b.id)} aria-label={`Remove blocked date ${b.date}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low">
                  <Icon name="delete" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setAddingDate({ date: "", reason: "" })}>
            <Icon name="add" className="h-4 w-4" /> Block a date
          </Button>
        </Card>

        <Button onClick={handleSave} loading={saving}>Save availability</Button>
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
            <Button onClick={addBlockedDate} loading={blocking} disabled={!addingDate?.date || affectedLoading || affectedError}>
              Block this date
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
              {displayAffectedLoading
                ? "Checking bookings on this date…"
                : affectedError ? "We could not check existing bookings. Choose the date again before blocking it."
                : `${displayAffectedCount} patient${displayAffectedCount === 1 ? "" : "s"} booked on this date (excluding cancelled). Blocking will not automatically notify or reschedule them — Staff will need to follow up.`}
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
