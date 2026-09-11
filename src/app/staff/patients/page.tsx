"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { queryPatients } from "@/lib/data/patients";
import type { PatientSummary } from "@/data/types";

function accountStatus(userId: string | null, isGuest: boolean): PatientSummary["accountStatus"] {
  if (userId) return "LinkedAccount";
  return isGuest ? "NoAccount" : "AccountUnknown";
}

// Stitch patients_list (staff).
export default function StaffPatientsPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientSummary[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      const data = (await queryPatients(supabase)).sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      );
      setPatients(
        data.map((p) => ({
          id: p.patient_id,
          patientCode: p.patient_code,
          fullName: `${p.first_name} ${p.last_name}`,
          sex: p.sex,
          dateOfBirth: p.date_of_birth,
          contactNumber: p.contact_number ?? "",
          email: p.email,
          accountStatus: accountStatus(p.user_id, p.is_guest),
        })),
      );
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppShell role="staff">
        <SkeletonTable rows={8} columns={4} />
      </AppShell>
    );
  }

  const rows = patients.filter((p) =>
    `${p.fullName} ${p.patientCode} ${p.contactNumber} ${p.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Patients</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/code/contact/email"
          className="w-full rounded-lg border border-outline-variant px-md py-sm sm:w-80"
        />
        <DataTable
          columns={[
            { header: "Code", render: (p) => p.patientCode },
            { header: "Full Name", render: (p) => p.fullName },
            { header: "Sex", render: (p) => p.sex },
            { header: "DOB", render: (p) => p.dateOfBirth },
            { header: "Contact", render: (p) => p.contactNumber },
            { header: "Account", render: (p) => <StatusPill status={p.accountStatus} /> },
          ]}
          rows={rows}
          rowKey={(p) => p.id}
          rowHref={(p) => `/staff/patients/${p.id}`}
          renderMobileCard={(p) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <p className="text-body-md font-medium text-on-surface">{p.fullName}</p>
                <StatusPill status={p.accountStatus} />
              </div>
              <p className="text-label-sm text-on-surface-variant">{p.patientCode} · {p.contactNumber}</p>
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
