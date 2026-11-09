"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { inputStyles } from "@/components/ui/fieldStyles";
import { formatClinicDateShort, orDash } from "@/lib/format";
import Link from "next/link";
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
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    //JJQR - AI (Oct 31, 2026)
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    //JJQR - END
    const handle = setTimeout(async () => {
      const supabase = null as never;
      let res;
      try {
        res = await queryPatientsPaged(supabase, {
          q: search.trim() || undefined,
          page,
          pageSize: PAGE_SIZE,
          sort: "-created",
        });
      } catch {
        if (cancelled) return;
        setLoadError("The patient list could not be loaded. Check the connection to the clinic server, then try again.");
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setLoadError("");
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
  }, [search, page, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <AppShell role="staff">
      <div className="space-y-lg">
        <PageHeader
          title="Patients"
          description="Find a patient to check their details, visits and portal account."
          actions={<Link href="/staff/walk-in" className={buttonStyles("secondary")}><Icon name="directions_walk" className="text-[16px]" />New walk-in</Link>}
        />
        <label className="block max-w-doctor-search space-y-xs">
          <span className="text-label-md text-on-surface-variant">Search patients</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, patient code, phone or email"
            className={inputStyles()}
          />
        </label>
        {loadError ? (
          <ErrorState title="Patients unavailable" message={loadError} onRetry={() => setReloadKey((k) => k + 1)} retrying={loading} />
        ) : (
          <>
            <DataTable
              columns={[
                { header: "Name", render: (p) => <span className="font-medium text-on-surface">{p.fullName}</span> },
                { header: "Code", render: (p) => <span className="font-mono text-body-sm">{p.patientCode}</span> },
                { header: "Sex", render: (p) => p.sex },
                { header: "Date of birth", render: (p) => <span className="tabular-nums">{formatClinicDateShort(p.dateOfBirth)}</span> },
                { header: "Contact", render: (p) => <span className="tabular-nums">{orDash(p.contactNumber)}</span> },
                { header: "Account", render: (p) => <StatusPill status={p.accountStatus} /> },
              ]}
              rows={rows}
              rowKey={(p) => p.id}
              rowHref={(p) => `/staff/patients/${p.id}`}
              loading={loading}
              emptyMessage={search.trim() ? `No patients match “${search.trim()}”.` : "No patients registered yet."}
              renderMobileCard={(p) => (
                <div className="space-y-xs">
                  <div className="flex items-start justify-between gap-md">
                    <p className="min-w-0 break-words text-body-md font-medium text-on-surface">{p.fullName}</p>
                    <StatusPill status={p.accountStatus} />
                  </div>
                  <p className="text-label-md text-on-surface-variant"><span className="font-mono">{p.patientCode}</span> · <span className="tabular-nums">{orDash(p.contactNumber)}</span></p>
                </div>
              )}
            />

            <nav aria-label="Patient pages" className="flex flex-wrap items-center justify-between gap-md text-label-md text-on-surface-variant">
              <span className="tabular-nums" aria-live="polite">{loading ? "Loading patients…" : `${rangeStart}–${rangeEnd} of ${total}`}</span>
              <div className="flex items-center gap-sm">
                <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  <Icon name="chevron_left" className="text-[14px]" />Previous
                </Button>
                <span className="tabular-nums">Page {page} of {pageCount}</span>
                <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
                  Next<Icon name="chevron_right" className="text-[14px]" />
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </AppShell>
  );
}
