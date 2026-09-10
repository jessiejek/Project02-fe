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
  const [me, setMe] = useState<{ name: string; code?: string; dob: string | null; sex: string | null; address: string | null } | null>(null);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      const supabase = null as never;
      const [data, settings, pat] = await Promise.all([
        queryRxGroups(supabase, { patientId }),
        queryClinicSettings(supabase),
        queryPatientById(supabase, patientId),
      ]);
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
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.patientId]);

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
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Prescriptions</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prescriptions..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md sm:w-80"
        />

        {filtered.length === 0 ? (
          <EmptyState icon="prescriptions" message="No prescriptions found." />
        ) : (
          <div className="space-y-md">
            {filtered.map((group) => (
              <Card key={group.id}>
                <div className="flex items-center justify-between border-b border-outline-variant pb-sm">
                  <div>
                    <p className="text-headline-sm text-on-surface">{group.createdAt}</p>
                    <p className="text-label-md text-on-surface-variant">{group.doctorName || "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => printGroup(group)}
                    aria-label="Print prescription"
                    className="text-primary"
                    title="Print"
                  >
                    <Icon name="print" />
                  </button>
                </div>
                <div className="mt-md space-y-sm">
                  {group.items.map((item, i) => (
                    <p key={item.id} className="text-body-md text-on-surface-variant">
                      <span className="text-on-surface">
                        {i + 1}. {item.genericName} #{item.quantity}
                      </span>
                      <br />
                      Sig. {item.dosage} {item.instruction}
                    </p>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
