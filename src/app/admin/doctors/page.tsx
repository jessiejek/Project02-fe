"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { formatPeso, orDash } from "@/lib/format";
import { queryDoctors } from "@/lib/data/doctors";
import { queryDoctorSchedules } from "@/lib/data/scheduling";
import { updateStaffAccount } from "@/lib/data/staff";
import { indexToDayName } from "@/lib/days";

interface DoctorRow {
  id: string;
  name: string;
  specialization: string;
  consultationFee: number;
  status: string;
  activeDays: string[];
}

// Stitch doctors_management. Retiring mockDoctors per
// Implementation-Phases/05-doctors-staff.md — real doctors only from here on.
export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const target = doctors.find((d) => d.id === deactivating);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      setLoading(true);
      try {
        const allDoctors = await queryDoctors(supabase);
        const schedules = await Promise.all(allDoctors.map((d) => queryDoctorSchedules(supabase, d.doctor_id)));
        setDoctors(
          allDoctors.map((d, i) => ({
            id: d.doctor_id,
            name: d.staff_accounts?.full_name ?? "",
            specialization: d.specialization,
            consultationFee: Number(d.consultation_fee),
            status: d.staff_accounts?.status ?? "Invited",
            activeDays: schedules[i].filter((s) => s.is_active).map((s) => indexToDayName(s.day_of_week)),
          })),
        );
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reloadKey]);

  async function confirmDeactivate() {
    if (!deactivating) return;
    const supabase = null as never;
    setSaving(true);
    setActionError("");
    try {
      await updateStaffAccount(supabase, deactivating, { status: "Inactive" });
      setDoctors((prev) => prev.map((d) => (d.id === deactivating ? { ...d, status: "Inactive" } : d)));
      setDeactivating(null);
    } catch {
      setActionError("The doctor could not be deactivated. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const days = (d: DoctorRow) => d.activeDays.length === 0
    ? <span className="text-body-md text-on-surface-variant">No working days</span>
    : <span className="text-body-md text-on-surface">{d.activeDays.join(", ")}</span>;

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <PageHeader
          title="Doctors"
          description="Who patients can book, their fees and the days they see patients."
          actions={<Link href="/admin/doctors/new" className={buttonStyles("primary")}><Icon name="add_circle" className="text-[16px]" />Add doctor</Link>}
        />

        {loadError ? (
          <ErrorState title="Doctors unavailable" message="The doctor list could not be loaded. Try again." onRetry={() => setReloadKey((k) => k + 1)} retrying={loading} />
        ) : (
        <DataTable
          columns={[
            { header: "Name", render: (d) => <span className="font-medium text-on-surface">{orDash(d.name)}</span> },
            { header: "Specialty", render: (d) => orDash(d.specialization) },
            { header: "Fee", align: "right", render: (d) => <span className="tabular-nums">{formatPeso(d.consultationFee)}</span> },
            { header: "Working days", render: days },
            { header: "Status", render: (d) => <StatusPill status={d.status} /> },
            {
              header: "Actions",
              align: "right",
              render: (d) => (
                <div className="flex justify-end gap-sm">
                  <Link href={`/admin/doctors/${d.id}/edit`} className={buttonStyles("secondary", "px-md")}>Edit</Link>
                  {d.status !== "Inactive" && (
                    <Button variant="ghost" className="px-md text-status-danger hover:bg-status-danger-surface" onClick={() => { setActionError(""); setDeactivating(d.id); }}>
                      Deactivate
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          rows={doctors}
          rowKey={(d) => d.id}
          loading={loading}
          emptyMessage="No doctors yet. Add one to open bookings."
          renderMobileCard={(d) => (
            <div className="space-y-sm">
              <div className="flex items-start justify-between gap-md">
                <div className="min-w-0">
                  <p className="break-words text-body-md font-medium text-on-surface">{orDash(d.name)}</p>
                  <p className="text-label-md text-on-surface-variant">
                    {orDash(d.specialization)} · <span className="tabular-nums">{formatPeso(d.consultationFee)}</span>
                  </p>
                </div>
                <StatusPill status={d.status} />
              </div>
              <p>{days(d)}</p>
              <div className="flex gap-sm">
                <Link href={`/admin/doctors/${d.id}/edit`} className={buttonStyles("secondary", "flex-1")}>Edit</Link>
                {d.status !== "Inactive" && (
                  <Button variant="ghost" className="flex-1 text-status-danger hover:bg-status-danger-surface" onClick={() => { setActionError(""); setDeactivating(d.id); }}>
                    Deactivate
                  </Button>
                )}
              </div>
            </div>
          )}
        />
        )}
      </div>

      <Modal
        isOpen={deactivating !== null}
        onClose={() => { if (!saving) setDeactivating(null); }}
        title={`Deactivate ${target?.name || "this doctor"}?`}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setDeactivating(null)}>Keep active</Button>
            <Button variant="danger" loading={saving} onClick={confirmDeactivate}>Deactivate</Button>
          </>
        }
      >
        <div className="space-y-md">
          {actionError && <FormAlert>{actionError}</FormAlert>}
          <p className="text-body-md text-on-surface-variant">
            They will no longer appear in patient-facing booking. Existing bookings and records are kept.
          </p>
        </div>
      </Modal>
    </AppShell>
  );
}
