"use client";

import { useCallback, useEffect, useState } from "react";
import { todayManila } from "@/lib/clock";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { SkeletonStats, SkeletonTable } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormAlert } from "@/components/ui/FormAlert";
import { cn } from "@/lib/cn";

const STATUS_OPTIONS: { value: DayStatus; label: string }[] = [
  { value: "Available", label: "Available" },
  { value: "RunningLate", label: "Running late" },
  { value: "UnavailableToday", label: "Out today" },
];
import { queryDoctors } from "@/lib/data/doctors";
import { queryDayStatuses, setDayStatus } from "@/lib/data/scheduling";

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
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
      const supabase = null as never;
      const today = todayManila();
      let allDoctors, statuses;
      try {
        [allDoctors, statuses] = await Promise.all([
          queryDoctors(supabase),
          queryDayStatuses(supabase, today),
        ]);
        setLoadError(false);
      } catch {
        setLoadError(true);
        setLoading(false);
        return;
      }

      const statusByDoctor = new Map(statuses.map((row) => [row.doctor_id, row.status as DayStatus]));
      const rows: DoctorRow[] = allDoctors
        .filter((d) => d.staff_accounts?.status !== "Inactive")
        .map((d) => ({
          id: d.doctor_id,
          name: d.staff_accounts?.full_name ?? "",
          dayStatus: statusByDoctor.get(d.doctor_id) ?? "Available",
        }));

      setDoctors(rows);
      setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const available = doctors.filter((d) => d.dayStatus === "Available").length;
  const runningLate = doctors.filter((d) => d.dayStatus === "RunningLate").length;
  const unavailable = doctors.filter((d) => d.dayStatus === "UnavailableToday").length;

  async function setStatus(id: string, status: DayStatus) {
    const supabase = null as never;
    const today = todayManila();
    setPendingId(id);
    setSaveError("");
    try {
      await setDayStatus(supabase, id, today, status);
      setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, dayStatus: status } : d)));
    } catch {
      setSaveError("That status change didn’t save. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function applyBulk(status: DayStatus) {
    const supabase = null as never;
    const today = todayManila();
    setBulkPending(true);
    setSaveError("");
    try {
      await Promise.all(selected.map((doctorId) => setDayStatus(supabase, doctorId, today, status)));
      setDoctors((prev) => prev.map((d) => (selected.includes(d.id) ? { ...d, dayStatus: status } : d)));
      setSelected([]);
      setSelectMode(false);
    } catch {
      setSaveError("Some doctors weren’t updated. Refresh to see what saved, then try again.");
    } finally {
      setBulkPending(false);
    }
  }

  const summary = [
    { label: "Available", value: available },
    { label: "Running late", value: runningLate },
    { label: "Out today", value: unavailable },
  ];

  return (
    <AppShell role="staff">
      <div className="space-y-lg pb-24">
        <PageHeader
          title="Doctor status today"
          description="Set who is in, running late or out. Patients see this on the booking screens."
          actions={
            /* Bulk actions only earn their keep once there's more than one doctor to apply a status to. */
            doctors.length > 1 && !loading && !loadError ? (
              <Button variant="secondary" aria-pressed={selectMode} onClick={() => { setSelectMode(!selectMode); setSelected([]); }}>
                {selectMode ? "Done selecting" : "Select several"}
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <div className="space-y-lg" aria-busy="true"><SkeletonStats count={3} /><SkeletonTable rows={4} columns={3} /></div>
        ) : loadError ? (
          <ErrorState
            title="Doctor status didn’t load"
            message="Check the connection to the clinic server, then try again."
            retrying={retrying}
            onRetry={async () => { setRetrying(true); await load(); setRetrying(false); }}
          />
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-md sm:max-w-[36rem]">
              {summary.map((st) => (
                <Card key={st.label} className="flex flex-col-reverse gap-xs">
                  <dt className="text-label-md text-on-surface-variant">{st.label}</dt>
                  <dd className="text-headline-lg tabular-nums text-on-surface">{st.value}</dd>
                </Card>
              ))}
            </dl>

            {saveError && <FormAlert>{saveError}</FormAlert>}

            {doctors.length === 0 ? (
              <EmptyState icon="person" message="No active doctors yet." />
            ) : (
              <ul className="grid grid-cols-1 gap-md lg:grid-cols-2">
                {doctors.map((doc) => (
                  <li key={doc.id}>
                    <Card className="space-y-md" aria-busy={pendingId === doc.id || undefined}>
                      <div className="flex items-center justify-between gap-md">
                        <label className={cn("flex min-w-0 items-center gap-md", selectMode && "cursor-pointer")}>
                          {selectMode && (
                            <input
                              type="checkbox"
                              checked={selected.includes(doc.id)}
                              onChange={() => toggleSelect(doc.id)}
                              className="h-5 w-5 accent-primary"
                            />
                          )}
                          <span className="min-w-0 break-words text-body-md font-medium text-on-surface">{doc.name || "—"}</span>
                        </label>
                        <StatusPill status={doc.dayStatus} />
                      </div>
                      {!selectMode && (
                        <div role="radiogroup" aria-label={`Status for ${doc.name}`} className="grid grid-cols-3 gap-xs rounded-lg bg-surface-container-low p-xs">
                          {STATUS_OPTIONS.map((opt) => {
                            const active = doc.dayStatus === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={pendingId === doc.id}
                                onClick={() => !active && setStatus(doc.id, opt.value)}
                                className={cn(
                                  "min-h-11 rounded-[calc(var(--radius-lg)-var(--spacing-xs))] px-sm text-label-md font-medium transition-colors duration-150",
                                  active ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface",
                                  "disabled:opacity-60",
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {selectMode && selected.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-center gap-sm border-t border-outline-variant bg-surface-container-lowest p-md md:left-sidebar">
            <span className="text-label-md tabular-nums text-on-surface">{selected.length} selected. Set to:</span>
            <Button loading={bulkPending} onClick={() => applyBulk("Available")}>Available</Button>
            <Button variant="secondary" disabled={bulkPending} onClick={() => applyBulk("RunningLate")}>
              Running late
            </Button>
            <Button variant="secondary" disabled={bulkPending} onClick={() => applyBulk("UnavailableToday")}>
              Out today
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
