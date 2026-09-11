"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { queryAuditLogsPaged } from "@/lib/data/admin";
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

const PAGE_SIZE = 25;
const ENTITY_TYPES = ["Booking", "Patient", "Doctor", "Payment", "Settings", "Consultation", "Staff"];

// Stitch system_audit_logs. §16.2 — server-side search + pagination (was
// load-200-then-filter-client-side).
export default function AdminAuditLogsPage() {
  const [entityFilter, setEntityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const supabase = null as never;
      const res = await queryAuditLogsPaged(supabase, {
        q: search.trim() || undefined,
        entityType: entityFilter === "all" ? undefined : entityFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      if (cancelled) return;

      const userIds = [...new Set(res.items.map((r) => r.performed_by_user_id).filter(Boolean))] as string[];
      const nameByUserId = new Map<string, string>();
      if (userIds.length > 0) {
        const staffRows = await queryStaffAccounts(supabase);
        staffRows.filter((s) => userIds.includes(s.user_id)).forEach((s) => nameByUserId.set(s.user_id, s.full_name));
      }
      if (cancelled) return;

      setTotal(res.totalCount);
      setRows(
        res.items.map((r) => ({
          id: r.id,
          timestamp: r.performed_at.replace("T", " ").slice(0, 16),
          entityType: r.entity_type,
          entityId: r.entity_id,
          action: r.action,
          performedBy: (r.performed_by_user_id && nameByUserId.get(r.performed_by_user_id)) || r.performed_by_user_id || "Unknown",
          details: r.details,
        })),
      );
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, entityFilter, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Audit Logs</h2>

        <Card className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-outline-variant px-md py-sm"
          >
            <option value="all">All Entity Types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search action / details"
            className="rounded-lg border border-outline-variant px-md py-sm sm:col-span-2"
          />
        </Card>

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
          loading={loading}
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

        <div className="flex items-center justify-between text-label-md text-on-surface-variant">
          <span>{loading ? "Loading…" : total === 0 ? "No matching entries" : `${rangeStart}–${rangeEnd} of ${total}`}</span>
          <div className="flex items-center gap-sm">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} / {pageCount}</span>
            <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
