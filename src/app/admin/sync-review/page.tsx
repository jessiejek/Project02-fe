"use client";

//JJQR - AI (Nov 22, 2026) - offline-mode plan step 4.5: the admin "Sync review" page. Problems from the clinic computers that need a person: a possible duplicate patient (merged by hand here), a receipt number used twice,
// and changes a computer could not send. Admin only (the server refuses everyone else).
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles } from "@/components/ui/fieldStyles";
import { MergePatientsModal } from "@/components/admin/MergePatientsModal";
import { ApiError } from "@/lib/api/client";
import { formatClinicDateTime } from "@/lib/format";
import { listReviewItems, resolveReviewItem, type ReviewItem } from "@/lib/data/syncReview";
import { isDuplicate, kindHelp, kindLabel, kindTone, noteProblem, problemMessage, REVIEW_KINDS } from "@/lib/sync-review";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 25;
const TONE: Record<string, string> = {
  warning: "bg-status-warning-surface text-status-warning border-status-warning-border",
  danger: "bg-status-danger-surface text-status-danger border-status-danger-border",
  neutral: "bg-status-neutral-surface text-status-neutral border-status-neutral-border",
  success: "bg-status-success-surface text-status-success border-status-success-border",
  info: "bg-status-info-surface text-status-info border-status-info-border",
};

function KindPill({ kind }: { kind: string }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full border px-sm py-[2px] text-label-md", TONE[kindTone(kind)])}>{kindLabel(kind)}</span>;
}

export default function AdminSyncReviewPage() {
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [openTotal, setOpenTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [merging, setMerging] = useState<[string, string] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); });
    listReviewItems({ status: status === "all" ? undefined : status, kind: kind || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setRows(res.items); setTotal(res.total); setOpenTotal(res.open_total); setLoadError(false);
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, kind, page, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function open(item: ReviewItem) {
    setSelected(item); setNote(""); setProblem(null);
  }

  async function resolve(resolution: "dismissed" | "fixed") {
    if (!selected) return;
    const bad = noteProblem(note);
    if (bad) { setProblem(bad); return; }
    setBusy(true); setProblem(null);
    try {
      await resolveReviewItem(selected.id, resolution, note);
      setDone(resolution === "dismissed" ? "Dismissed." : "Marked as resolved.");
      setSelected(null);
      reload();
    } catch (e) {
      setProblem(e instanceof ApiError ? problemMessage(e.body, "Could not save. Try again.") : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const detailLines = selected?.details ? Object.entries(selected.details).filter(([, v]) => v !== null && v !== undefined && String(v) !== "") : [];

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <PageHeader
          title="Sync review"
          description={`Problems from the clinic computers that need a person to look at them. ${openTotal} open.`}
        />
        {done && <Toast key={done + reloadKey} variant="success" message={done} />}

        <div role="search" className="grid grid-cols-1 gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md sm:grid-cols-2">
          <label className="space-y-xs">
            <span className="text-label-md text-on-surface-variant">Status</span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputStyles()}>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="space-y-xs">
            <span className="text-label-md text-on-surface-variant">Type</span>
            <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className={inputStyles()}>
              <option value="">All types</option>
              {REVIEW_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          </label>
        </div>

        {loadError ? (
          <ErrorState title="Sync review unavailable" message="The list could not be loaded. Try again." onRetry={reload} retrying={loading} />
        ) : (
          <>
            <DataTable
              columns={[
                { header: "Type", render: (r) => <KindPill kind={r.kind} /> },
                { header: "What happened", render: (r) => <span className="break-words text-on-surface">{r.title}</span> },
                { header: "When", render: (r) => <span className="whitespace-nowrap tabular-nums">{formatClinicDateTime(r.created_at)}</span> },
                { header: "Status", render: (r) => <span className="text-on-surface-variant">{r.status === "open" ? "Open" : `Resolved (${r.resolution ?? "—"})`}</span> },
              ]}
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={open}
              loading={loading}
              emptyMessage={status === "open" && !kind ? "Nothing needs your attention. Everything the computers sent has been accepted." : "No items match these filters."}
              renderMobileCard={(r) => (
                <div className="space-y-xs">
                  <KindPill kind={r.kind} />
                  <p className="break-words text-body-md text-on-surface">{r.title}</p>
                  <p className="text-label-md text-on-surface-variant">{formatClinicDateTime(r.created_at)} · {r.status === "open" ? "Open" : "Resolved"}</p>
                </div>
              )}
            />
            <nav aria-label="Sync review pages" className="flex flex-wrap items-center justify-between gap-md text-label-md text-on-surface-variant">
              <span className="tabular-nums" aria-live="polite">{loading ? "Loading…" : total === 0 ? "No items" : `${total} item${total === 1 ? "" : "s"}`}</span>
              <div className="flex items-center gap-sm">
                <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span className="tabular-nums">Page {page} of {pageCount}</span>
                <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </nav>
          </>
        )}
      </div>

      <Modal
        isOpen={selected !== null}
        onClose={busy ? () => {} : () => setSelected(null)}
        title={selected ? kindLabel(selected.kind) : ""}
        size="lg"
        footer={selected && selected.status === "open" ? (
          <div className="flex flex-wrap justify-end gap-sm">
            <Button variant="secondary" onClick={() => setSelected(null)} disabled={busy}>Close</Button>
            {isDuplicate(selected.kind) && selected.patient_id && selected.other_patient_id && (
              <Button onClick={() => { setMerging([selected.patient_id as string, selected.other_patient_id as string]); }} disabled={busy}>Compare and merge…</Button>
            )}
            <Button variant="secondary" onClick={() => resolve("dismissed")} loading={busy} disabled={noteProblem(note) !== null}>
              {isDuplicate(selected.kind) ? "Not a duplicate" : "Dismiss"}
            </Button>
            {!isDuplicate(selected.kind) && <Button onClick={() => resolve("fixed")} loading={busy} disabled={noteProblem(note) !== null}>Mark resolved</Button>}
          </div>
        ) : undefined}
      >
        {selected && (
          <div className="space-y-md">
            <p className="text-body-md font-medium text-on-surface">{selected.title}</p>
            <p className="text-body-md text-on-surface-variant">{kindHelp(selected.kind)}</p>
            {detailLines.length > 0 && (
              <dl className="grid grid-cols-1 gap-xs rounded-lg bg-surface-container-low p-md sm:grid-cols-[12rem_1fr]">
                {detailLines.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-label-md text-on-surface-variant">{k.replace(/_/g, " ")}</dt>
                    <dd className="break-all text-body-md text-on-surface">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="text-label-md text-on-surface-variant">Received {formatClinicDateTime(selected.created_at)}{selected.entity_id ? ` · ${selected.aggregate ?? "record"} ${selected.entity_id}` : ""}</p>
            {selected.status === "resolved" ? (
              <div className="rounded-lg border border-outline-variant p-md text-body-md">
                <p className="font-medium text-on-surface">Resolved ({selected.resolution}) {selected.resolved_at ? formatClinicDateTime(selected.resolved_at) : ""}</p>
                {selected.resolution_note && <p className="mt-xs text-on-surface-variant">{selected.resolution_note}</p>}
              </div>
            ) : (
              <label className="block space-y-xs">
                <span className="text-label-md text-on-surface-variant">Note (required to dismiss or resolve)</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className={inputStyles()} placeholder="What you checked or did" />
              </label>
            )}
            {problem && <FormAlert tone="danger">{problem}</FormAlert>}
          </div>
        )}
      </Modal>

      <MergePatientsModal
        isOpen={merging !== null}
        patientIds={merging}
        onClose={() => setMerging(null)}
        onMerged={() => { setMerging(null); setSelected(null); setDone("Patients merged."); reload(); }}
      />
    </AppShell>
  );
}
//JJQR - END
