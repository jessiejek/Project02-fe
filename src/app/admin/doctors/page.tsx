"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { queryDoctors } from "@/lib/data/doctors";
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
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const target = doctors.find((d) => d.id === deactivating);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [allDoctors, schedulesRes] = await Promise.all([
        queryDoctors(supabase),
        supabase.from("doctor_schedules").select("*").eq("is_active", true),
      ]);
      setDoctors(
        allDoctors.map((d) => ({
          id: d.doctor_id,
          name: d.staff_accounts?.full_name ?? "",
          specialization: d.specialization,
          consultationFee: Number(d.consultation_fee),
          status: d.staff_accounts?.status ?? "Invited",
          activeDays: (schedulesRes.data ?? [])
            .filter((s) => s.doctor_id === d.doctor_id)
            .map((s) => indexToDayName(s.day_of_week)),
        })),
      );
    }
    load();
  }, []);

  async function confirmDeactivate() {
    if (!deactivating) return;
    const supabase = createClient();
    await supabase.from("staff_accounts").update({ status: "Inactive" }).eq("staff_id", deactivating);
    setDoctors((prev) => prev.map((d) => (d.id === deactivating ? { ...d, status: "Inactive" } : d)));
    setDeactivating(null);
  }

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Doctors Management</h2>
          <Link href="/admin/doctors/new">
            <Button>+ Add Doctor</Button>
          </Link>
        </div>

        <DataTable
          columns={[
            { header: "Name", render: (d) => d.name },
            { header: "Specialization", render: (d) => d.specialization },
            { header: "Fee", render: (d) => `₱${d.consultationFee}` },
            {
              header: "Working Days",
              render: (d) => (
                <div className="flex flex-wrap gap-1">
                  {d.activeDays.map((day) => (
                    <span key={day} className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                      {day}
                    </span>
                  ))}
                </div>
              ),
            },
            { header: "Status", render: (d) => <StatusPill status={d.status} /> },
            {
              header: "Actions",
              align: "right",
              render: (d) => (
                <div className="flex justify-end gap-sm">
                  <Link href={`/admin/doctors/${d.id}/edit`}>
                    <Button variant="secondary">Edit</Button>
                  </Link>
                  <Button variant="danger" onClick={() => setDeactivating(d.id)}>
                    Deactivate
                  </Button>
                </div>
              ),
            },
          ]}
          rows={doctors}
          rowKey={(d) => d.id}
          renderMobileCard={(d) => (
            <div className="space-y-sm">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="text-body-md font-medium text-on-surface">{d.name}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {d.specialization} · ₱{d.consultationFee}
                  </p>
                </div>
                <StatusPill status={d.status} />
              </div>
              <div className="flex flex-wrap gap-1">
                {d.activeDays.map((day) => (
                  <span key={day} className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                    {day}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-sm sm:flex-row">
                <Link href={`/admin/doctors/${d.id}/edit`} className="flex-1">
                  <Button variant="secondary" className="w-full">
                    Edit
                  </Button>
                </Link>
                <Button variant="danger" className="w-full flex-1" onClick={() => setDeactivating(d.id)}>
                  Deactivate
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      <Modal
        isOpen={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title="Deactivate Doctor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeactivating(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDeactivate}>Confirm</Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">
          Deactivate {target?.name}? They will no longer appear in patient-facing booking.
        </p>
      </Modal>
    </AppShell>
  );
}
