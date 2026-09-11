"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { queryPatientsPaged } from "@/lib/data/patients";
import type { PatientSummary } from "@/data/types";

const PAGE_SIZE = 25;

function accountStatus(userId: string | null, isGuest: boolean): PatientSummary["accountStatus"] {
  if (userId) return "LinkedAccount";
  return isGuest ? "NoAccount" : "AccountUnknown";
}

// Stitch patients_list (staff). Was pulling the whole roster with no
// pagination at all — fine at a handful of patients, not at hundreds.
// queryPatientsPaged already existed (admin's Patients screen already used
// it) but was never wired in here.
export default function StaffPatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PatientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const supabase = null as never;
      const res = await queryPatientsPaged(supabase, {
        q: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort: "-created",
      });
      if (cancelled) return;
      setTotal(res.totalCount);
      setRows(
        res.items.map((p) => ({
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
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Patients</h2>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
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
          loading={loading}
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

        <div className="flex items-center justify-between text-label-md text-on-surface-variant">
          <span>{loading ? "Loading…" : `${rangeStart}–${rangeEnd} of ${total}`}</span>
          <div className="flex items-center gap-sm">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>Page {page} / {pageCount}</span>
            <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
