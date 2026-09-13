"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { queryConsultations, queryRxGroups, queryVitalReadings } from "@/lib/data/clinical";
import { queryVitalFieldTemplates } from "@/lib/data/lookups";
import { queryPatientById } from "@/lib/data/patients";
import { queryBookings } from "@/lib/data/bookings";
import { queryPatientDocuments, queryPatientLabResults, queryVaccinations } from "@/lib/data/patientFiles";
import { todayManila } from "@/lib/clock";
import type { VitalFieldTemplate } from "@/data/types";

function computeAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const [ty, tm, td] = todayManila().split("-").map(Number);
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  if (!by) return null;
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

interface HeaderInfo {
  fullName: string;
  patientCode: string;
  sex: string;
  dateOfBirth: string;
  contactNumber: string;
}

interface ConsultationEntry {
  id: string;
  appointmentDate: string;
  chiefComplaint: string;
  diagnosisDescriptions: string[];
}

interface VitalReadingEntry {
  bookingId: string;
  appointmentDate: string;
  templateId: string;
  value: string;
}

interface PrescriptionSummary {
  id: string;
  createdAt: string;
  items: { id: string; genericName: string; dosage: string; quantity: string; instruction: string }[];
}

const TABS = [
  { id: "consultations", label: "Consultations" },
  { id: "vitals", label: "Vitals" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "labs", label: "Lab Results" },
  { id: "documents", label: "Documents" },
  { id: "vaccinations", label: "Vaccinations" },
];

// Doctor's "Show History" floating button (consultation page) opens this —
// same read-only patient chart as /doctor/patients/[id], just in a modal so
// the doctor never has to leave the consultation form to check it.
export function PatientHistoryModal({
  isOpen,
  onClose,
  patientId,
  doctorId,
}: {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  doctorId: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [header, setHeader] = useState<HeaderInfo | null>(null);
  const [consultations, setConsultations] = useState<ConsultationEntry[]>([]);
  const [vitalTemplates, setVitalTemplates] = useState<VitalFieldTemplate[]>([]);
  const [vitalReadings, setVitalReadings] = useState<VitalReadingEntry[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [labResults, setLabResults] = useState<{ id: string; resultTitle: string }[]>([]);
  const [documents, setDocuments] = useState<{ id: string; title: string }[]>([]);
  const [vaccinations, setVaccinations] = useState<{ id: string; vaccineName: string; doseNumber: number | null; administeredDate: string | null; status: string }[]>([]);
  const [tab, setTab] = useState("consultations");

  useEffect(() => {
    if (!isOpen || !patientId) return;
    let cancelled = false;
    async function load() {
      setLoaded(false);
      const supabase = null as never;
      const [patientRow, consultsRes, templates, vitalRows, bookingRows, rxRes, labRows, docRows, vaxRows] = await Promise.all([
        queryPatientById(supabase, patientId),
        queryConsultations(supabase, { patientId, doctorId }),
        queryVitalFieldTemplates(supabase),
        queryVitalReadings(supabase, { patientId }),
        queryBookings(supabase, { patientId, doctorId }),
        queryRxGroups(supabase, { patientId, doctorId }),
        queryPatientLabResults(supabase, { patientId }),
        queryPatientDocuments(supabase, { patientId }),
        queryVaccinations(supabase, patientId),
      ]);
      if (cancelled) return;

      if (patientRow) {
        setHeader({
          fullName: `${patientRow.first_name} ${patientRow.last_name}`,
          patientCode: patientRow.patient_code,
          sex: patientRow.sex,
          dateOfBirth: patientRow.date_of_birth,
          contactNumber: patientRow.contact_number ?? "",
        });
      }

      setConsultations(
        consultsRes
          .map((c) => ({
            id: c.consultation_id,
            appointmentDate: c.bookings?.appointment_date ?? "",
            chiefComplaint: c.chief_complaint ?? "",
            diagnosisDescriptions: (c.consultation_diagnoses ?? []).map((d) => d.custom_description ?? "").filter(Boolean),
          }))
          .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate)),
      );

      setVitalTemplates(
        templates.map((t) => ({ id: t.template_id, description: t.description, formKey: t.form_key, unit: t.unit, icon: t.icon, isDefault: t.is_default })),
      );
      const bookingDateById = new Map(bookingRows.map((b) => [b.booking_id, b.appointment_date]));
      setVitalReadings(
        vitalRows
          .map((r) => ({
            bookingId: r.booking_id ?? "",
            appointmentDate: bookingDateById.get(r.booking_id ?? "") ?? "",
            templateId: r.template_id,
            value: r.value,
          }))
          .filter((r) => r.appointmentDate),
      );

      setPrescriptions(
        rxRes
          .map((g) => ({
            id: g.group_id,
            createdAt: g.created_at.slice(0, 10),
            items: (g.prescription_line_items ?? []).map((i) => ({
              id: i.id ?? "",
              genericName: i.generic_name,
              dosage: i.dosage,
              quantity: i.quantity,
              instruction: i.instruction ?? "",
            })),
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );

      setLabResults(labRows.map((l) => ({ id: l.id ?? "", resultTitle: l.result_title || "Lab result" })));
      setDocuments(docRows.map((d) => ({ id: d.id ?? "", title: d.title || d.file_name })));
      setVaccinations(
        vaxRows.map((v) => ({ id: v.id, vaccineName: v.vaccine_name, doseNumber: v.dose_number, administeredDate: v.administered_date, status: v.status })),
      );

      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, patientId, doctorId]);

  if (!isOpen) return null;

  const defaultVitalTemplates = vitalTemplates.filter((t) => t.isDefault);
  const vitalDates = Array.from(new Set(vitalReadings.map((r) => r.appointmentDate))).sort((a, b) => b.localeCompare(a));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Patient History" size="lg">
      <div className="space-y-lg">
        {!loaded ? (
          <div className="space-y-md">
            <SkeletonCard lines={2} />
            <SkeletonTable rows={4} columns={2} />
          </div>
        ) : (
          <>
            {header && (
              <div className="flex flex-wrap items-center gap-md">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body-md font-semibold text-primary">
                  {initials(header.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-sm">
                    <p className="text-headline-sm text-on-surface">{header.fullName}</p>
                    <span className="text-label-sm text-on-surface-variant">{header.patientCode}</span>
                  </div>
                  <p className="text-label-md text-on-surface-variant">
                    {header.sex} · {computeAge(header.dateOfBirth) ?? "—"} yrs · Born {header.dateOfBirth}
                    {header.contactNumber ? ` · ${header.contactNumber}` : ""}
                  </p>
                </div>
              </div>
            )}

            <Tabs tabs={TABS} activeId={tab} onChange={setTab} />

            {tab === "consultations" && (
              <div className="space-y-md">
                {consultations.length === 0 ? (
                  <EmptyState icon="clinical_notes" message="No consultations recorded yet." />
                ) : (
                  consultations.map((c) => (
                    <div key={c.id} className="rounded-xl border border-outline-variant p-md">
                      <div className="flex flex-wrap items-baseline justify-between gap-sm">
                        <p className="text-body-md font-medium text-on-surface">{c.chiefComplaint || "Consultation"}</p>
                        <p className="text-label-sm text-on-surface-variant">{c.appointmentDate}</p>
                      </div>
                      {c.diagnosisDescriptions.length > 0 && (
                        <div className="mt-sm flex flex-wrap gap-xs">
                          {c.diagnosisDescriptions.map((d, i) => (
                            <span key={i} className="rounded-full bg-surface-container-high px-sm py-xs text-label-sm text-on-surface-variant">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "vitals" && (
              <div className="space-y-md">
                {vitalDates.length === 0 ? (
                  <EmptyState icon="monitoring" message="No vital signs recorded yet." />
                ) : (
                  vitalDates.map((date) => {
                    const readingsForDate = vitalReadings.filter((r) => r.appointmentDate === date);
                    return (
                      <Card key={date}>
                        <p className="mb-md text-label-md font-medium text-on-surface">{date}</p>
                        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                          {defaultVitalTemplates.map((t) => {
                            const reading = readingsForDate.find((r) => r.templateId === t.id);
                            return (
                              <div key={t.id} className="flex items-center gap-sm text-body-md text-on-surface-variant">
                                <Icon name={t.icon} className="text-[16px] text-primary" />
                                <span>
                                  {reading?.value ?? "—"}
                                  {reading && t.unit ? ` ${t.unit}` : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {tab === "prescriptions" && (
              <div className="space-y-md">
                {prescriptions.length === 0 ? (
                  <EmptyState icon="prescriptions" message="No prescriptions recorded yet." />
                ) : (
                  prescriptions.map((group) => (
                    <Card key={group.id}>
                      <div className="flex items-center gap-sm border-b border-outline-variant pb-md">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon name="prescriptions" className="text-[18px]" />
                        </div>
                        <div>
                          <p className="text-body-md font-medium text-on-surface">
                            {group.items.length} {group.items.length === 1 ? "medicine" : "medicines"}
                          </p>
                          <p className="text-label-sm text-on-surface-variant">{group.createdAt}</p>
                        </div>
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
                  ))
                )}
              </div>
            )}

            {tab === "labs" && (
              labResults.length === 0 ? (
                <EmptyState icon="science" message="No lab results yet." />
              ) : (
                <div className="space-y-sm">
                  {labResults.map((l) => (
                    <div key={l.id} className="flex items-center gap-md rounded-xl border border-outline-variant p-md">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon name="science" className="text-[16px]" />
                      </div>
                      <p className="text-body-md text-on-surface">{l.resultTitle}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "documents" && (
              documents.length === 0 ? (
                <EmptyState icon="description" message="No documents yet." />
              ) : (
                <div className="space-y-sm">
                  {documents.map((d) => (
                    <div key={d.id} className="flex items-center gap-md rounded-xl border border-outline-variant p-md">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon name="description" className="text-[16px]" />
                      </div>
                      <p className="text-body-md text-on-surface">{d.title}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "vaccinations" && (
              vaccinations.length === 0 ? (
                <EmptyState icon="vaccines" message="No vaccinations recorded yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-body-md">
                    <thead>
                      <tr className="text-left text-label-md text-on-surface-variant">
                        <th className="py-sm">Vaccine</th>
                        <th className="py-sm">Dose #</th>
                        <th className="py-sm">Date</th>
                        <th className="py-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vaccinations.map((v) => (
                        <tr key={v.id} className="border-t border-outline-variant/40">
                          <td className="py-sm">{v.vaccineName}</td>
                          <td className="py-sm">{v.doseNumber ?? "—"}</td>
                          <td className="py-sm">{v.administeredDate ?? "—"}</td>
                          <td className="py-sm">
                            <StatusPill tone={v.status === "Administered" ? "success" : "warning"} label={v.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
