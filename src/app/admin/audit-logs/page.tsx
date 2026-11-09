"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { inputStyles } from "@/components/ui/fieldStyles";
import { formatClinicDateTime } from "@/lib/format";
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
  const [loadError, setLoadError] = useState(false);
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
      let res: Awaited<ReturnType<typeof queryAuditLogsPaged>>;
      const nameByUserId = new Map<string, string>();
      try {
        res = await queryAuditLogsPaged(supabase, {
          q: search.trim() || undefined,
          entityType: entityFilter === "all" ? undefined : entityFilter,
          page,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) return;

        const userIds = [...new Set(res.items.map((r) => r.performed_by_user_id).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          const staffRows = await queryStaffAccounts(supabase);
          staffRows.filter((s) => userIds.includes(s.user_id)).forEach((s) => nameByUserId.set(s.user_id, s.full_name));
        }
      } catch {
        if (!cancelled) { setLoadError(true); setLoading(false); }
        return;
      }
      if (cancelled) return;
      setLoadError(false);

      setTotal(res.totalCount);
      setRows(
        res.items.map((r) => ({
          id: r.id,
          timestamp: formatClinicDateTime(r.performed_at),
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
  }, [search, entityFilter, page, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <PageHeader title="Audit log" description="Who changed what, newest first. Times are shown in clinic time (Asia/Manila)." />

        <div role="search" className="grid grid-cols-1 gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md sm:grid-cols-3">
          <label className="space-y-xs">
            <span className="text-label-md text-on-surface-variant">Record type</span>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className={inputStyles()}
            >
              <option value="all">All record types</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="space-y-xs sm:col-span-2">
            <span className="text-label-md text-on-surface-variant">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Action or details"
              className={inputStyles()}
            />
          </label>
        </div>

        {loadError ? (
          <ErrorState title="Audit log unavailable" message="Entries could not be loaded. Try again." onRetry={() => setReloadKey((k) => k + 1)} retrying={loading} />
        ) : (
          <>
            <DataTable
              columns={[
                { header: "When", render: (l) => <span className="whitespace-nowrap tabular-nums">{l.timestamp}</span> },
                { header: "Action", render: (l) => <span className="font-medium text-on-surface">{l.action}</span> },
                { header: "Record", render: (l) => <span><span className="block text-on-surface">{l.entityType}</span><span className="block break-all font-mono text-body-sm text-on-surface-variant">{l.entityId}</span></span> },
                { header: "By", render: (l) => l.performedBy },
                { header: "Details", render: (l) => <span className="break-words">{l.details ?? "—"}</span> },
              ]}
              rows={rows}
              rowKey={(l) => l.id}
              loading={loading}
              emptyMessage={search.trim() || entityFilter !== "all" ? "No entries match these filters." : "No audit entries yet."}
              renderMobileCard={(l) => (
                <div className="space-y-xs">
                  <div className="flex items-start justify-between gap-md">
                    <p className="min-w-0 text-body-md font-medium text-on-surface">{l.action}</p>
                    <span className="shrink-0 text-label-md tabular-nums text-on-surface-variant">{l.timestamp}</span>
                  </div>
                  <p className="text-label-md text-on-surface-variant">{l.entityType} · by {l.performedBy}</p>
                  <p className="break-all font-mono text-body-sm text-on-surface-variant">{l.entityId}</p>
                  {l.details && <p className="break-words text-label-md text-on-surface-variant">{l.details}</p>}
                </div>
              )}
            />

            <nav aria-label="Audit log pages" className="flex flex-wrap items-center justify-between gap-md text-label-md text-on-surface-variant">
              <span className="tabular-nums" aria-live="polite">{loading ? "Loading entries…" : total === 0 ? "No matching entries" : `${rangeStart}–${rangeEnd} of ${total}`}</span>
              <div className="flex items-center gap-sm">
                <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}><Icon name="chevron_left" className="text-[14px]" />Previous</Button>
                <span className="tabular-nums">Page {page} of {pageCount}</span>
                <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>Next<Icon name="chevron_right" className="text-[14px]" /></Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </AppShell>
  );
}
