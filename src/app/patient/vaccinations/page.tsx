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
      } finally {
        setVaxLoading(false);
      }
    }

    load();
  }, [session?.patientId]);

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
          <td>${escapeHtml(v.administeredDate ?? "—")}</td>
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

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Vaccinations</h2>
          <Button variant="secondary" onClick={printList} disabled={filtered.length === 0}>
            Print / Save as PDF
          </Button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vaccinations..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md sm:w-80"
        />
        <DataTable
          columns={[
            { header: "Vaccine", render: (v) => v.vaccineName },
            { header: "Dose #", align: "center", render: (v) => v.doseNumber ?? "—" },
            { header: "Administered Date", render: (v) => v.administeredDate ?? "—" },
            { header: "Status", render: (v) => <StatusPill tone={v.status === "Administered" ? "success" : "warning"} label={v.status} /> },
            { header: "Source", render: (v) => v.source },
          ]}
          rows={filtered}
          rowKey={(v) => v.id}
          loading={vaxLoading}
          emptyMessage="No vaccination records found."
          renderMobileCard={(v) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between gap-md">
                <p className="text-body-md font-medium text-on-surface">{v.vaccineName}</p>
                <StatusPill tone={v.status === "Administered" ? "success" : "warning"} label={v.status} />
              </div>
              <p className="text-label-sm text-on-surface-variant">
                Dose {v.doseNumber ?? "—"} · {v.administeredDate ?? "—"} · {v.source}
              </p>
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
