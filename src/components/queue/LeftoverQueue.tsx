//JJQR - AI (2026-11-25) - why: GAV-4 (owner approved the pro mockup, "apply it also in web please"). Inside the queue card, below today's queue and
// above Needs attention: "⚠ Not finished on an earlier day · N patients", one group per visit date (most recent open), rows with the queue's columns
// plus a date chip, and Continue (solid) · Move to today (outline) · Mark no-show (red link). Scope = the caller's existing today queue (the server
// decides: a doctor's own, staff the clinic's). An older server without the endpoint → the section is simply not shown.
//JJQR - AI (2026-11-26) - why: owner rejected the block INSIDE today's card (t78u "yesterday's queue should not cross over TODAY's"): it is now its own
// "Earlier days" card below today's, one group per date with that day's Queue and Needs attention (t79u). //JJQR - END
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { FormAlert } from "@/components/ui/FormAlert";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { todayManila } from "@/lib/clock";
import { moveLeftoverToToday, queryLeftovers, updateQueueEntry } from "@/lib/data/queue";
import { earlierDays, groupLeftovers, isEarlierDayOpen, leftoverErrorText, leftoverStatus, LEFTOVER_GENERIC, patientsLabel, type LeftoverEntry } from "@/lib/leftover-queue"; //JJQR - AI (2026-11-26) - why: per-day groups //JJQR - END
import { useClinicHubEvent } from "@/lib/realtime/clinicHub";

const SMALL = "!min-h-8 !px-sm !py-0 text-label-md whitespace-nowrap";

//JJQR - AI (2026-11-26) - why: earlier days' Needs attention (doctor dashboard) goes under the same date group as that day's queue
export interface EarlierAttention {
  date: string;
  count: number;
  render: () => ReactNode;
}
//JJQR - END

export function LeftoverQueue({ role, onChanged, className, attention }: { role: "doctor" | "staff"; onChanged?: () => void; className?: string; attention?: EarlierAttention[] }) {
  const [items, setItems] = useState<LeftoverEntry[]>([]);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false); // a second click before React re-renders must not send a second request
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [noShowTarget, setNoShowTarget] = useState<LeftoverEntry | null>(null);
  const today = todayManila();

  const load = useCallback(async () => {
    try {
      setItems((await queryLeftovers()).items ?? []);
    } catch {
      setItems([]); // older server (404) or offline: nothing to show, today's queue is unaffected
    }
  }, []);
  useEffect(() => { let cancelled = false; queueMicrotask(() => { if (!cancelled) void load(); }); return () => { cancelled = true; }; }, [load]);
  useClinicHubEvent("QueueUpdated", load);
  useClinicHubEvent("PatientCheckedIn", load);

  const groups = groupLeftovers(items, today);
  //JJQR - AI (2026-11-26) - why: the card also shows when only earlier Needs attention items exist
  const attentionTotal = (attention ?? []).reduce((n, a) => n + (a.date < today ? a.count : 0), 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0) + attentionTotal;
  //JJQR - END
  if (total === 0 && !error && !note) return null;

  async function run(e: LeftoverEntry, work: () => Promise<string>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(e.booking_id);
    setError("");
    setNote("");
    try {
      setNote(await work());
    } catch (err) {
      setError(err instanceof ApiError ? leftoverErrorText(err.status, err.body) : LEFTOVER_GENERIC);
    } finally {
      busyRef.current = false;
      setBusyId(null);
      await load();
      onChanged?.();
    }
  }
  const moveToToday = (e: LeftoverEntry) =>
    run(e, async () => {
      const r = await moveLeftoverToToday(e.booking_id);
      return `${e.patient_name} moved to today as ${r.queue_number}.`;
    });
  const confirmNoShow = () => {
    const e = noShowTarget;
    setNoShowTarget(null); // the box closes first, then the save runs
    if (!e) return;
    void run(e, async () => {
      await updateQueueEntry(null, e.booking_id, "no-show");
      return `${e.patient_name} marked no-show.`;
    });
  };
  const continueHref = (e: LeftoverEntry) => (role === "doctor" ? `/doctor/consultation2/${e.booking_id}` : `/staff/bookings/${e.booking_id}`);

  const actions = (e: LeftoverEntry) => {
    const busy = busyId === e.booking_id;
    return (
      <div className="flex items-center justify-end gap-sm">
        <Link href={continueHref(e)} className={buttonStyles("primary", SMALL)} aria-label={`Continue with ${e.patient_name}`}>Continue</Link>
        <Button variant="secondary" className={cn(SMALL, "text-primary")} loading={busy} disabled={busyId !== null} onClick={() => void moveToToday(e)}>
          Move to today
        </Button>
        <button type="button" disabled={busyId !== null} onClick={() => setNoShowTarget(e)} className="whitespace-nowrap px-xs text-label-md font-semibold text-error hover:underline disabled:opacity-40">
          Mark no-show
        </button>
      </div>
    );
  };

  //JJQR - AI (2026-11-26) - why: owner (t78u/t79u) "yesterday's queue should not cross over TODAY's". This is now its OWN card ("Earlier days"), placed
  // below today's card by each page, never inside it. One collapsible group per earlier date ("Wed, Nov 25"); inside it "Queue" (that day's unfinished
  // patients, same row actions) and, on the doctor dashboard, "Needs attention" (that day's items, rendered by the page through `attention`).
  // The table needs ~768px: in a narrow card (and on a phone) the rows are a compact list; switched by the CARD width (@container), not the screen.
  const days = earlierDays(groups, (attention ?? []).map((a) => ({ date: a.date, count: a.count })), today);
  const renderAttention = (date: string) => attention?.find((a) => a.date === date)?.render();
  return (
    <section aria-label="Earlier days" data-testid="leftover-queue" className={cn("@container rounded-xl border border-outline-variant bg-surface-container-lowest p-md sm:p-lg", className)}>
      {note && <Toast variant="success" key={note} message={note} />}
      <div className="mb-sm flex flex-wrap items-baseline justify-between gap-sm">
        <h3 className="text-label-lg font-semibold text-on-surface">Earlier days</h3>
        <span className="text-label-sm text-on-surface-variant">Not finished or not cleared on their own day · separate from today</span>
      </div>
      {error && <div className="mb-sm"><FormAlert>{error}</FormAlert></div>}
      <div className="space-y-sm">
        {days.map((d) => {
          const open = isEarlierDayOpen(days, d.date, toggled);
          return (
            <div key={d.date} data-testid={`earlier-day-${d.date}`} className="overflow-hidden rounded-lg border border-outline-variant/60">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setToggled((t) => ({ ...t, [d.date]: !open }))}
                className="flex min-h-10 w-full items-center gap-sm bg-surface-container-low px-md text-left text-label-md font-semibold text-on-surface hover:bg-surface-container"
              >
                <span aria-hidden="true" className="w-3 text-on-surface-variant">{open ? "▾" : "▸"}</span>
                <span>{d.header}</span>
                <span className="ml-auto text-label-sm font-normal text-on-surface-variant">{d.countLabel}</span>
              </button>
              {open && (
                <div className="divide-y divide-outline-variant/40 border-t border-outline-variant/40">
                  {d.queue.length > 0 && (
                    <div>
                      <p className="px-md pb-xs pt-sm text-label-sm font-semibold text-on-surface-variant">Queue · {patientsLabel(d.queue.length)}</p>
                      <ul className="divide-y divide-outline-variant/40 @3xl:hidden">
                        {d.queue.map((e) => {
                          const st = leftoverStatus(e, today);
                          return (
                            <li key={e.booking_id} className="space-y-sm px-md py-sm" aria-busy={busyId === e.booking_id || undefined}>
                              <div className="min-w-0">
                                <p className="text-body-md font-semibold tabular-nums text-on-surface">{e.queue_number} · {e.patient_name}</p>
                                <p className="text-label-sm text-on-surface-variant">{e.visit_type === "FollowUp" ? "Follow-up" : "New"} · {st.pill} {st.since}</p>
                              </div>
                              {actions(e)}
                            </li>
                          );
                        })}
                      </ul>
                      <table className="hidden w-full table-fixed @3xl:table">
                        <thead>
                          <tr className="bg-surface-container-low text-left text-label-sm text-on-surface-variant">
                            <th className="w-24 px-md py-xs font-medium">Queue</th>
                            <th className="px-sm py-xs font-medium">Patient</th>
                            <th className="w-20 px-sm py-xs font-medium">Visit</th>
                            <th className="w-44 px-sm py-xs font-medium">Status</th>
                            <th className="w-[300px] px-md py-xs text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/40 text-body-md text-on-surface">
                          {d.queue.map((e) => {
                            const st = leftoverStatus(e, today);
                            return (
                              <tr key={e.booking_id} className="align-middle" aria-busy={busyId === e.booking_id || undefined}>
                                <td className="px-md py-sm font-semibold tabular-nums">{e.queue_number}</td>
                                <td className="min-w-0 px-sm py-sm">
                                  <span className="block truncate font-semibold">{e.patient_name}</span>
                                  {e.patient_code && <span className="block truncate font-mono text-label-sm text-on-surface-variant">{e.patient_code}</span>}
                                </td>
                                <td className="px-sm py-sm text-label-md text-on-surface-variant">{e.visit_type === "FollowUp" ? "Follow-up" : "New"}</td>
                                <td className="px-sm py-sm">
                                  <span className={cn("inline-flex rounded-full border px-sm text-label-sm font-semibold", st.pill === "In progress" ? "border-status-info-border bg-status-info-surface text-status-info" : "border-status-neutral-border bg-status-neutral-surface text-status-neutral")}>{st.pill}</span>
                                  <span className="mt-xs block whitespace-nowrap text-label-sm text-on-surface-variant">{st.since}</span>
                                </td>
                                <td className="px-md py-sm">{actions(e)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {d.attentionCount > 0 && (
                    <div>
                      <p className="px-md pb-xs pt-sm text-label-sm font-semibold text-on-surface-variant">Needs attention · {d.attentionCount} item{d.attentionCount === 1 ? "" : "s"}</p>
                      {renderAttention(d.date)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/*JJQR - END */}
      <Modal
        isOpen={noShowTarget !== null}
        onClose={() => setNoShowTarget(null)}
        title={noShowTarget ? `Mark ${noShowTarget.patient_name} no-show?` : "Mark no-show?"}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoShowTarget(null)}>Keep</Button>
            <Button variant="danger" onClick={confirmNoShow}>Mark no-show</Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface">
          Queue {noShowTarget?.queue_number} from {noShowTarget ? leftoverStatus(noShowTarget, today).since.replace(/^since /, "") : ""} is closed as a no-show. It leaves this list.
        </p>
      </Modal>
    </section>
  );
}

//JJQR - END
