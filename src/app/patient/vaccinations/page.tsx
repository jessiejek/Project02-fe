"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { useSession } from "@/components/providers/SessionProvider";
import { queryVaccinations } from "@/lib/data/patientFiles";
import { printHtml, escapeHtml } from "@/lib/print";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { inputStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate, formatClinicDateShort } from "@/lib/format";

interface VaccinationRow {
  id: string;
  vaccineName: string;
  doseNumber: number | null;
  administeredDate: string | null;
  status: string;
  source: string;
}

// Stitch screen_20_vaccinations.
export default function VaccinationsPage() {
  const { session, loading } = useSession();
  const [search, setSearch] = useState("");
  const [vaccinations, setVaccinations] = useState<VaccinationRow[]>([]);
  const [vaxLoading, setVaxLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;

    async function load() {
      const supabase = null as never;
      try {
        const data = await queryVaccinations(supabase, patientId);

        setVaccinations(
          data.map((v) => ({
            id: v.id,
            vaccineName: v.vaccine_name,
            doseNumber: v.dose_number,
            administeredDate: v.administered_date,
            status: v.status,
            source: v.source,
          })),
        );
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setVaxLoading(false);
      }
    }

    load();
  }, [session?.patientId, retryKey]);

  if (loading || !session?.patientId) {
    return (
      <AppShell role="patient">
        <SkeletonTable rows={5} columns={4} />
      </AppShell>
    );
  }

  // Patient.md §12: "Search across all fields" — was vaccine name only.
  const filtered = vaccinations.filter((v) =>
    `${v.vaccineName} ${v.status} ${v.source} ${v.administeredDate ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  function printList() {
    if (filtered.length === 0) return;
    const rows = filtered
      .map(
        (v) => `<tr>
          <td>${escapeHtml(v.vaccineName)}</td>
          <td>${escapeHtml(String(v.doseNumber ?? "—"))}</td>
          <td>${escapeHtml(formatClinicDate(v.administeredDate))}</td>
          <td>${escapeHtml(v.status)}</td>
          <td>${escapeHtml(v.source)}</td>
        </tr>`,
      )
      .join("");
    printHtml(
      "Vaccinations",
      `<h1>Vaccination Record</h1>
       <p class="meta">${filtered.length} entr${filtered.length === 1 ? "y" : "ies"} · Printed ${new Date().toLocaleString()}</p>
       <table>
         <thead><tr><th>Vaccine</th><th>Dose</th><th>Date</th><th>Status</th><th>Source</th></tr></thead>
         <tbody>${rows}</tbody>
       </table>`,
    );
  }

  const pill = (v: VaccinationRow) => <StatusPill tone={v.status === "Administered" ? "success" : "warning"} label={v.status} />;

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <PageHeader
          title="Vaccinations"
          description="Shots recorded at the clinic or added from your own records."
          actions={
            <Button variant="secondary" onClick={printList} disabled={filtered.length === 0}>
              <Icon name="print" className="text-[16px]" />
              Print or save as PDF
            </Button>
          }
        />
        <label className="block max-w-doctor-search space-y-xs">
          <span className="text-label-md text-on-surface-variant">Search vaccinations</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Vaccine, status, source or date" className={inputStyles()} />
        </label>
        {loadError ? (
          <ErrorState title="Your vaccinations didn’t load" message="Check your connection, then try again." retrying={vaxLoading} onRetry={() => { setVaxLoading(true); setRetryKey((k) => k + 1); }} />
        ) : (
          <DataTable
            columns={[
              { header: "Vaccine", render: (v) => <span className="font-medium text-on-surface">{v.vaccineName}</span> },
              { header: "Dose", align: "right", render: (v) => <span className="tabular-nums">{v.doseNumber ?? "—"}</span> },
              { header: "Date given", render: (v) => <span className="tabular-nums">{formatClinicDateShort(v.administeredDate)}</span> },
              { header: "Status", render: pill },
              { header: "Source", render: (v) => v.source },
            ]}
            rows={filtered}
            rowKey={(v) => v.id}
            loading={vaxLoading}
            emptyMessage={vaccinations.length === 0 ? "No vaccinations recorded yet." : `No vaccinations match “${search.trim()}”.`}
            renderMobileCard={(v) => (
              <div className="space-y-xs">
                <div className="flex items-start justify-between gap-md">
                  <p className="min-w-0 break-words text-body-md font-medium text-on-surface">{v.vaccineName}</p>
                  {pill(v)}
                </div>
                <p className="text-label-md tabular-nums text-on-surface-variant">
                  Dose {v.doseNumber ?? "—"} · {formatClinicDateShort(v.administeredDate)} · {v.source}
                </p>
              </div>
            )}
          />
        )}
      </div>
    </AppShell>
  );
}
