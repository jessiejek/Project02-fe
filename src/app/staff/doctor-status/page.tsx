"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";
import { one } from "@/lib/one";

type DayStatus = "Available" | "RunningLate" | "UnavailableToday";

interface DoctorRow {
  id: string;
  name: string;
  dayStatus: DayStatus;
}

// Stitch doctor_status_management, including the Addendum S11 bulk-select
// fix (already part of the original Stitch-02 spec, not an add-on).
export default function DoctorStatusPage() {
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [doctorsRes, statusesRes] = await Promise.all([
        supabase.from("doctors").select("doctor_id, staff_accounts(full_name, status)"),
        supabase.from("doctor_day_statuses").select("doctor_id, status").eq("status_date", today),
      ]);

      const statusByDoctor = new Map((statusesRes.data ?? []).map((row) => [row.doctor_id, row.status as DayStatus]));
      const rows: DoctorRow[] = (doctorsRes.data ?? [])
        .filter((d) => one(d.staff_accounts)?.status !== "Inactive")
        .map((d) => ({
          id: d.doctor_id,
          name: one(d.staff_accounts)?.full_name ?? "",
          dayStatus: statusByDoctor.get(d.doctor_id) ?? "Available",
        }));

      setDoctors(rows);
      setLoading(false);
    }

    load();
  }, []);

  const available = doctors.filter((d) => d.dayStatus === "Available").length;
  const runningLate = doctors.filter((d) => d.dayStatus === "RunningLate").length;
  const unavailable = doctors.filter((d) => d.dayStatus === "UnavailableToday").length;

  async function setStatus(id: string, status: DayStatus) {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("doctor_day_statuses").upsert(
      { doctor_id: id, status_date: today, status },
      { onConflict: "doctor_id,status_date" },
    );
    setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, dayStatus: status } : d)));
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function applyBulk(status: DayStatus) {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("doctor_day_statuses").upsert(
      selected.map((doctorId) => ({
        doctor_id: doctorId,
        status_date: today,
        status,
      })),
      { onConflict: "doctor_id,status_date" },
    );
    setDoctors((prev) => prev.map((d) => (selected.includes(d.id) ? { ...d, dayStatus: status } : d)));
    setSelected([]);
    setSelectMode(false);
  }

  if (loading) {
    return (
      <AppShell role="staff">
        <p className="text-body-md text-on-surface-variant">Loading doctor statuses...</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="staff">
      <div className="space-y-lg pb-24">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Doctor Status Management</h2>
          <Button variant="secondary" onClick={() => setSelectMode(!selectMode)}>
            Select multiple ▾
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-lg sm:grid-cols-3">
          <Card>
            <p className="text-headline-lg text-on-surface">{available}</p>
            <p className="text-label-md text-on-surface-variant">Available</p>
          </Card>
          <Card>
            <p className="text-headline-lg text-on-surface">{runningLate}</p>
            <p className="text-label-md text-on-surface-variant">Running Late</p>
          </Card>
          <Card>
            <p className="text-headline-lg text-on-surface">{unavailable}</p>
            <p className="text-label-md text-on-surface-variant">Unavailable</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
          {doctors.map((doc) => (
            <Card key={doc.id} className="flex items-center gap-md">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selected.includes(doc.id)}
                  onChange={() => toggleSelect(doc.id)}
                  className="h-5 w-5"
                />
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high">
                <Icon name="person" className="text-on-surface-variant" />
              </div>
              <div className="flex-1">
                <p className="text-body-md text-on-surface">{doc.name}</p>
                <StatusPill status={doc.dayStatus} />
              </div>
              {!selectMode && (
                <div className="flex flex-col gap-xs">
                  <button type="button" onClick={() => setStatus(doc.id, "Available")} className="text-label-sm text-primary hover:underline">
                    Available
                  </button>
                  <button type="button" onClick={() => setStatus(doc.id, "RunningLate")} className="text-label-sm text-primary hover:underline">
                    Running Late
                  </button>
                  <button type="button" onClick={() => setStatus(doc.id, "UnavailableToday")} className="text-label-sm text-primary hover:underline">
                    Unavailable Today
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>

        {selectMode && selected.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-center gap-md border-t border-outline-variant bg-surface-container-lowest p-md md:left-sidebar">
            <span className="text-label-md text-on-surface">{selected.length} selected — Apply status:</span>
            <Button onClick={() => applyBulk("Available")}>Available</Button>
            <Button variant="secondary" onClick={() => applyBulk("RunningLate")}>
              Running Late
            </Button>
            <Button variant="secondary" onClick={() => applyBulk("UnavailableToday")}>
              Unavailable
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
