"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { DatePicker } from "@/components/ui/DatePicker";
import { createClient } from "@/lib/supabase/client";
import { queryAuditLogs } from "@/lib/data/admin";
import { queryStaffAccounts } from "@/lib/data/staff";

interface AuditLogRow {
  id: string;
  timestamp: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  details: string | null;
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: iso(from), dateTo: iso(to) };
}

// Stitch system_audit_logs — dense, monospace-leaning timestamp/ID columns.
// Real rows are written on consultation amend (and elsewhere); this page reads
// `audit_logs` instead of mock data (truthDare Phase 3).
export default function AdminAuditLogsPage() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [entityFilter, setEntityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const data = await queryAuditLogs(supabase, { take: 200 });

      const userIds = [...new Set(data.map((r) => r.performed_by_user_id).filter(Boolean))] as string[];
      const nameByUserId = new Map<string, string>();
      if (userIds.length > 0) {
        const staffRows = await queryStaffAccounts(supabase);
        staffRows
          .filter((s) => userIds.includes(s.user_id))
          .forEach((s) => nameByUserId.set(s.user_id, s.full_name));
      }

      setLogs(
        data.map((r) => ({
          id: r.id,
          timestamp: r.performed_at.replace("T", " ").slice(0, 16),
          entityType: r.entity_type,
          entityId: r.entity_id,
          action: r.action,
          performedBy: (r.performed_by_user_id && nameByUserId.get(r.performed_by_user_id)) || r.performed_by_user_id || "Unknown",
          details: r.details,
        })),
      );
      setLoaded(true);
    }
    load();
  }, []);

  const rows = logs.filter((log) => {
    if (entityFilter !== "all" && log.entityType !== entityFilter) return false;
    const logDate = log.timestamp.slice(0, 10);
    if (logDate < dateFrom || logDate > dateTo) return false;
    if (
      search &&
      !`${log.action} ${log.performedBy} ${log.entityId} ${log.details ?? ""}`.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Audit Logs</h2>

        <Card className="grid grid-cols-1 gap-md sm:grid-cols-4">
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="rounded-lg border border-outline-variant px-md py-sm">
            <option value="all">All Entity Types</option>
            {["Booking", "Patient", "Doctor", "Payment", "Settings", "Consultation", "Staff"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-sm text-label-md text-on-surface-variant">
            From
            <DatePicker value={dateFrom} onChange={setDateFrom} className="flex-1" />
          </label>
          <label className="flex items-center gap-sm text-label-md text-on-surface-variant">
            To
            <DatePicker value={dateTo} onChange={setDateTo} className="flex-1" />
          </label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action/performedBy/entityId/details" className="rounded-lg border border-outline-variant px-md py-sm" />
        </Card>

        {!loaded ? (
          <p className="text-body-md text-on-surface-variant">Loading audit logs…</p>
        ) : (
          <DataTable
            columns={[
              { header: "Timestamp", render: (l) => <span className="font-mono text-label-md">{l.timestamp}</span> },
              { header: "Entity Type", render: (l) => <span className="rounded bg-surface-container-high px-2 py-0.5 text-label-sm">{l.entityType}</span> },
              { header: "Entity ID", render: (l) => <span className="font-mono text-label-md">{l.entityId}</span> },
              { header: "Action", render: (l) => l.action },
              { header: "Performed By", render: (l) => l.performedBy },
              { header: "Details", render: (l) => l.details ?? "—" },
            ]}
            rows={rows}
            rowKey={(l) => l.id}
            renderMobileCard={(l) => (
              <div className="space-y-xs">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-surface-container-high px-2 py-0.5 text-label-sm">{l.entityType}</span>
                  <span className="font-mono text-label-sm text-on-surface-variant">{l.timestamp}</span>
                </div>
                <p className="text-body-md text-on-surface">{l.action}</p>
                <p className="text-label-sm text-on-surface-variant">By {l.performedBy} · {l.entityId}</p>
                {l.details && <p className="text-label-sm text-on-surface-variant">{l.details}</p>}
              </div>
            )}
          />
        )}
      </div>
    </AppShell>
  );
}
