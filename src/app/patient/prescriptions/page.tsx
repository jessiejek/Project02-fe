"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { queryRxGroups } from "@/lib/data/clinical";
import { queryClinicSettings, type ClinicSettingsRow } from "@/lib/data/admin";
import { queryPatientById } from "@/lib/data/patients";
import { printPrescription } from "@/lib/print-forms";
import type { Database } from "@/data/supabase-types";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate } from "@/lib/format";

type DbLineItem = Database["public"]["Tables"]["prescription_line_items"]["Row"];

interface PrescriptionLine {
  id: string;
  genericName: string;
  quantity: string;
  dosage: string;
  instruction: string;
  timing: string | null;
  mealRelation: string | null;
  durationKind: string | null;
  durationValue: number | null;
  indication: string | null;
  isControlledSubstance: boolean;
}

interface PrescriptionGroupRow {
  id: string;
  createdAt: string;
  doctorName: string;
  items: PrescriptionLine[];
}

// Stitch screen_19_prescriptions. Rebuilt per clinic-prescriptions-fe.md's
// list-card format (one card per visit, numbered "Sig." lines) — was reading
// a single hardcoded mockPatient rather than the actual signed-in patient.
export default function PrescriptionsPage() {
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<PrescriptionGroupRow[]>([]);
  const [clinic, setClinic] = useState<ClinicSettingsRow | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [me, setMe] = useState<{ name: string; code?: string; dob: string | null; sex: string | null; address: string | null } | null>(null);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      const supabase = null as never;
      let data, settings, pat;
      try {
        [data, settings, pat] = await Promise.all([
          queryRxGroups(supabase, { patientId }),
          queryClinicSettings(supabase),
          queryPatientById(supabase, patientId),
        ]);
      } catch {
        setStatus("error");
        return;
      }
      setClinic(settings);
      if (pat) {
        setMe({
          name: `${pat.first_name} ${pat.last_name}`.trim(),
          code: pat.patient_code,
          dob: pat.date_of_birth ?? null,
          sex: pat.sex ?? null,
          address: pat.address ?? null,
        });
      }
      const mapped: PrescriptionGroupRow[] = data.map((g) => ({
        id: g.group_id,
        createdAt: g.created_at.slice(0, 10),
        doctorName: g.bookings?.doctors?.staff_accounts?.full_name ?? "",
        items: (g.prescription_line_items ?? []).map((i) => ({
          id: i.id ?? "",
          genericName: i.generic_name,
          quantity: i.quantity,
          dosage: i.dosage,
          instruction: i.instruction ?? "",
          timing: i.timing ?? null,
          mealRelation: i.meal_relation ?? null,
          durationKind: i.duration_kind ?? null,
          durationValue: i.duration_value ?? null,
          indication: i.indication ?? null,
          isControlledSubstance: i.is_controlled_substance ?? false,
        })),
      }));
      mapped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setGroups(mapped);
      setStatus("ready");
    }
    load();
  }, [session?.patientId, retryKey]);

  const filtered = groups.filter((g) =>
    `${g.doctorName} ${g.createdAt} ${g.items.map((i) => i.genericName).join(" ")}`.toLowerCase().includes(search.toLowerCase()),
  );

  function printGroup(group: PrescriptionGroupRow) {
    printPrescription({
      clinic: clinic
        ? { clinic_name: clinic.clinic_name, address: clinic.address, contact_number: clinic.contact_number }
        : { clinic_name: "Grace Medical Clinic", address: "", contact_number: null },
      doctor: { full_name: group.doctorName || "", license_number: null, ptr_number: null },
      patient: {
        full_name: me?.name ?? "",
        patient_code: me?.code,
        date_of_birth: me?.dob ?? null,
        sex: me?.sex ?? null,
        address: me?.address ?? null,
      },
      date: group.createdAt,
      items: group.items.map((i) => ({
        generic_name: i.genericName,
        dosage: i.dosage,
        quantity: i.quantity,
        instruction: i.instruction,
        timing: i.timing,
        meal_relation: i.mealRelation,
        duration_kind: i.durationKind,
        duration_value: i.durationValue,
        indication: i.indication,
        is_controlled_substance: i.isControlledSubstance,
      })),
    });
  }

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <PageHeader title="Prescriptions" description="Medicines your doctor prescribed, one card per visit. Print one to bring to the pharmacy." />
        <label className="block max-w-doctor-search space-y-xs">
          <span className="text-label-md text-on-surface-variant">Search prescriptions</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Medicine, doctor or date" className={inputStyles()} />
        </label>

        {status === "loading" ? (
          <div className="space-y-md" aria-busy="true"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        ) : status === "error" ? (
          <ErrorState title="Your prescriptions didn’t load" message="Check your connection, then try again." onRetry={() => { setStatus("loading"); setRetryKey((k) => k + 1); }} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="medication" message={groups.length === 0 ? "No prescriptions yet." : `No prescriptions match “${search.trim()}”.`} />
        ) : (
          <ul className="space-y-md">
            {filtered.map((group) => (
              <li key={group.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-md border-b border-outline-variant pb-md">
                    <div className="min-w-0">
                      <h2 className="text-headline-sm tabular-nums text-on-surface">{formatClinicDate(group.createdAt)}</h2>
                      <p className="text-label-md text-on-surface-variant">{group.doctorName || "—"}</p>
                    </div>
                    <Button variant="secondary" onClick={() => printGroup(group)}>
                      <Icon name="print" className="text-[16px]" />
                      Print
                    </Button>
                  </div>
                  <ol className="mt-md space-y-md">
                    {group.items.map((item, i) => (
                      <li key={item.id || i} className="flex gap-md">
                        <span className="w-5 shrink-0 text-right text-body-md tabular-nums text-on-surface-variant">{i + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-body-md font-medium text-on-surface">
                            {item.genericName} <span className="font-normal tabular-nums text-on-surface-variant">#{item.quantity}</span>
                          </p>
                          <p className="text-body-md text-on-surface">Sig. {item.dosage} {item.instruction}</p>
                          {item.isControlledSubstance && <p className="text-label-md text-status-warning">Controlled medicine. Bring the printed prescription.</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
