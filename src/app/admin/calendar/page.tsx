"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { createClient } from "@/lib/supabase/client";
import { queryDoctors } from "@/lib/data/doctors";
import { queryBookings } from "@/lib/data/bookings";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface CalendarDoctor {
  id: string;
  name: string;
}

interface CalendarBooking {
  id: string;
  doctorId: string;
  patientName: string;
  appointmentDate: string;
  slotStartTime: string;
}

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatShort(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

// Stitch clinic_calendar_admin — read-only weekly grid of who was seen each day.
// §16.3: no appointment slots — the time shown is the walk-in check-in time.
// Data via the .NET API (queryBookings from/to range).
export default function AdminCalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [doctors, setDoctors] = useState<CalendarDoctor[]>([]);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loaded, setLoaded] = useState(false);

  const weekStart = useMemo(() => addDays(mondayOf(new Date()), weekOffset * 7), [weekOffset]);
  const weekDates = useMemo(() => DAYS.map((_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = weekDates[6];
  const weekStartIso = toISODate(weekStart);
  const weekEndIso = toISODate(weekEnd);

  useEffect(() => {
    async function loadDoctors() {
      const supabase = createClient();
      const rows = await queryDoctors(supabase);
      setDoctors(
        rows
          .filter((d) => d.staff_accounts?.status !== "Inactive")
          .map((d) => ({ id: d.doctor_id, name: d.staff_accounts?.full_name ?? "Unknown doctor" })),
      );
    }
    loadDoctors();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBookings() {
      setLoaded(false);
      const supabase = createClient();
      const rows = await queryBookings(supabase, { from: weekStartIso, to: weekEndIso });
      if (cancelled) return;
      setBookings(
        rows
          .filter((b) => b.status !== "Cancelled" && b.status !== "Expired")
          .map((b) => ({
            id: b.booking_id,
            doctorId: b.doctor_id,
            patientName: b.patients ? `${b.patients.first_name} ${b.patients.last_name}` : "Unknown patient",
            appointmentDate: b.appointment_date,
            slotStartTime: (b.slot_start_time ?? "").slice(0, 5),
          }))
          .sort((a, b) => a.slotStartTime.localeCompare(b.slotStartTime)),
      );
      setLoaded(true);
    }
    loadBookings();
    return () => {
      cancelled = true;
    };
  }, [weekStartIso, weekEndIso]);

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => setWeekOffset((w) => w - 1)} className="rounded-lg border border-outline-variant px-md py-sm">
            ◀ Prev Week
          </button>
          <h2 className="text-center text-headline-sm text-on-surface">
            {formatShort(weekStart)} - {formatShort(weekEnd)}, {weekEnd.getFullYear()}
          </h2>
          <button type="button" onClick={() => setWeekOffset((w) => w + 1)} className="rounded-lg border border-outline-variant px-md py-sm">
            Next Week ▶
          </button>
        </div>

        {!loaded ? (
          <p className="text-body-md text-on-surface-variant">Loading calendar…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="border-b border-outline-variant px-md py-sm text-left text-label-md text-on-surface-variant">Doctor</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className="border-b border-outline-variant px-md py-sm text-left text-label-md text-on-surface-variant">
                      {d} <span className="text-on-surface-variant/70">{weekDates[i].getDate()}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doctors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-md py-lg text-body-md text-on-surface-variant">
                      No doctors found.
                    </td>
                  </tr>
                ) : (
                  doctors.map((doc) => (
                    <tr key={doc.id} className="border-b border-outline-variant/40">
                      <td className="px-md py-md text-body-md text-on-surface">{doc.name}</td>
                      {weekDates.map((date) => {
                        const iso = toISODate(date);
                        const dayBookings = bookings.filter((b) => b.doctorId === doc.id && b.appointmentDate === iso);
                        return (
                          <td key={iso} className="px-md py-md align-top">
                            {dayBookings.map((b) => (
                              <div key={b.id} className="mb-xs rounded bg-primary/10 px-xs py-1 text-[11px] text-primary">
                                {b.patientName} · {b.slotStartTime}
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
