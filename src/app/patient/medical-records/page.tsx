"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { queryConsultations } from "@/lib/data/clinical";
import { printHtml, escapeHtml } from "@/lib/print";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate } from "@/lib/format";

interface MedicalRecordEntry {
  id: string;
  appointmentDate: string;
  doctorName: string;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  primaryDiagnosis: string;
  followUpDate?: string;
  followUpInstructions?: string;
}

// Stitch screen_18_medical_records. Previously read every patient's
// consultations from mockConsultations with no patientId filter at all —
// fixed as part of the real-data wiring in Implementation-Phases/
// 07-consultations-vitals.md.
export default function MedicalRecordsPage() {
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [records, setRecords] = useState<MedicalRecordEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      const supabase = null as never;
      let data;
      try {
        data = await queryConsultations(supabase, { patientId });
      } catch {
        setStatus("error");
        return;
      }
      const mapped: MedicalRecordEntry[] = data.map((c) => {
        const diagnoses = c.consultation_diagnoses ?? [];
        const primary = diagnoses.find((d) => d.type === "Primary") ?? diagnoses[0];
        return {
          id: c.consultation_id,
          appointmentDate: c.bookings?.appointment_date ?? "",
          doctorName: c.doctors?.staff_accounts?.full_name ?? "",
          chiefComplaint: c.chief_complaint ?? "",
          subjective: c.subjective ?? "",
          objective: c.objective ?? "",
          assessment: c.assessment ?? "",
          plan: c.plan ?? "",
          primaryDiagnosis: primary?.custom_description ?? "",
          followUpDate: c.follow_ups?.follow_up_date ?? undefined,
          followUpInstructions: c.follow_ups?.instructions ?? undefined,
        };
      });
      mapped.sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      setRecords(mapped);
      setStatus("ready");
    }
    load();
  }, [session?.patientId, retryKey]);

  const filtered = records.filter((c) =>
    `${c.doctorName} ${c.chiefComplaint} ${c.assessment}`.toLowerCase().includes(search.toLowerCase()),
  );

  function printAll() {
    if (filtered.length === 0) return;
    const sections = filtered
      .map(
        (c) => `<div class="card">
          <h2>${escapeHtml(c.appointmentDate)} — ${escapeHtml(c.doctorName || "—")}</h2>
          <p><strong>Primary diagnosis:</strong> ${escapeHtml(c.primaryDiagnosis || "—")}</p>
          <p><strong>Chief complaint:</strong> ${escapeHtml(c.chiefComplaint || "—")}</p>
          <p><strong>Subjective:</strong> ${escapeHtml(c.subjective || "—")}</p>
          <p><strong>Objective:</strong> ${escapeHtml(c.objective || "—")}</p>
          <p><strong>Assessment:</strong> ${escapeHtml(c.assessment || "—")}</p>
          <p><strong>Plan:</strong> ${escapeHtml(c.plan || "—")}</p>
          ${
            c.followUpDate
              ? `<p><strong>Follow-up:</strong> ${escapeHtml(c.followUpDate)} — ${escapeHtml(c.followUpInstructions ?? "")}</p>`
              : ""
          }
        </div>`,
      )
      .join("");
    printHtml(
      "Medical Records",
      `<h1>Medical Records</h1>
       <p class="meta">${filtered.length} record${filtered.length === 1 ? "" : "s"} · Printed ${new Date().toLocaleString()}</p>
       ${sections}`,
    );
  }

  const field = (label: string, value?: string) => (
    <div className="space-y-xs">
      <dt className="text-label-md text-on-surface-variant">{label}</dt>
      <dd className={value?.trim() ? "whitespace-pre-line text-body-md text-on-surface" : "text-body-md text-on-surface-variant"}>{value?.trim() || "—"}</dd>
    </div>
  );

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <PageHeader
          title="Medical records"
          description="Notes from each visit, newest first. Only your doctor can change them."
          actions={
            <Button variant="secondary" onClick={printAll} disabled={filtered.length === 0}>
              <Icon name="print" className="text-[16px]" />
              Print or save as PDF
            </Button>
          }
        />
        <label className="block max-w-doctor-search space-y-xs">
          <span className="text-label-md text-on-surface-variant">Search records</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Doctor, complaint or assessment" className={inputStyles()} />
        </label>

        {status === "loading" ? (
          <div className="space-y-md" aria-busy="true"><SkeletonCard lines={2} /><SkeletonCard lines={2} /></div>
        ) : status === "error" ? (
          <ErrorState title="Your records didn’t load" message="Check your connection, then try again." onRetry={() => { setStatus("loading"); setRetryKey((k) => k + 1); }} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="description" message={records.length === 0 ? "Records appear here after your first visit." : `No records match “${search.trim()}”.`} />
        ) : (
          <ul className="space-y-md">
            {filtered.map((c) => {
              const isOpen = expanded === c.id;
              return (
                <li key={c.id}>
                  <Card className="!p-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`record-${c.id}`}
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-md rounded-xl p-lg text-left hover:bg-surface-container-low"
                    >
                      <span className="min-w-0">
                        <span className="block text-label-md tabular-nums text-on-surface-variant">{formatClinicDate(c.appointmentDate)} · {c.doctorName || "—"}</span>
                        <span className="block text-headline-sm text-on-surface">{c.primaryDiagnosis || c.chiefComplaint || "Visit notes"}</span>
                      </span>
                      <Icon name={isOpen ? "expand_less" : "expand_more"} className="shrink-0 text-on-surface-variant" />
                    </button>
                    {isOpen && (
                      <dl id={`record-${c.id}`} className="grid animate-surface-in grid-cols-1 gap-md border-t border-outline-variant p-lg sm:grid-cols-2">
                        {field("Chief complaint", c.chiefComplaint)}
                        {field("Subjective", c.subjective)}
                        {field("Objective", c.objective)}
                        {field("Assessment", c.assessment)}
                        <div className="sm:col-span-2">{field("Plan", c.plan)}</div>
                        {c.followUpDate && (
                          <div className="rounded-lg bg-surface-container-low p-md sm:col-span-2">
                            {field(`Follow-up on ${formatClinicDate(c.followUpDate)}`, c.followUpInstructions)}
                          </div>
                        )}
                      </dl>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
