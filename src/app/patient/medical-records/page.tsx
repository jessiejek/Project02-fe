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

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      const supabase = null as never;
      const data = await queryConsultations(supabase, { patientId });
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
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.patientId]);

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

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Medical Records</h2>
          <Button variant="secondary" onClick={printAll} disabled={filtered.length === 0}>
            Print / Save as PDF
          </Button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search records..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md sm:w-80"
        />

        {filtered.length === 0 ? (
          <EmptyState icon="clinical_notes" message="No medical records found." />
        ) : (
          <div className="space-y-md">
            {filtered.map((c) => {
              const isOpen = expanded === c.id;
              return (
                <Card key={c.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-headline-sm text-on-surface">{c.appointmentDate} — {c.doctorName}</p>
                      <p className="text-label-md text-on-surface-variant">{c.primaryDiagnosis}</p>
                    </div>
                    <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
                  </button>
                  {isOpen && (
                    <div className="mt-md space-y-sm border-t border-outline-variant pt-md text-body-md text-on-surface-variant">
                      <p><strong>Chief Complaint:</strong> {c.chiefComplaint}</p>
                      <p><strong>Subjective:</strong> {c.subjective}</p>
                      <p><strong>Objective:</strong> {c.objective}</p>
                      <p><strong>Assessment:</strong> {c.assessment}</p>
                      <p><strong>Plan:</strong> {c.plan}</p>
                      {c.followUpDate && <p><strong>Follow-up:</strong> {c.followUpDate} — {c.followUpInstructions}</p>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
