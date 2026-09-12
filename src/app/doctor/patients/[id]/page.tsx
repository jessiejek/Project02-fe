"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { useSession } from "@/components/providers/SessionProvider";
import { queryConsultations, queryRxGroups, queryVitalReadings, deleteRxGroup } from "@/lib/data/clinical";
import { queryVitalFieldTemplates } from "@/lib/data/lookups";
import { queryPatientById } from "@/lib/data/patients";
import { queryBookings } from "@/lib/data/bookings";
import { queryPatientDocuments, queryPatientLabResults, queryVaccinations } from "@/lib/data/patientFiles";
import { printHtml, escapeHtml } from "@/lib/print";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { todayManila } from "@/lib/clock";
import type { PrescriptionGroup, VitalFieldTemplate, BookingStatus } from "@/data/types";
import type { Database } from "@/data/supabase-types";

type DbLineItem = Database["public"]["Tables"]["prescription_line_items"]["Row"];

function computeAge(dateOfBirth: string): number {
  const [ty, tm, td] = todayManila().split("-").map(Number);
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

interface RealPatientHeader {
  id: string;
  fullName: string;
  patientCode: string;
  sex: string;
  dateOfBirth: string;
  contactNumber: string;
}

interface DoctorConsultationEntry {
  id: string;
  appointmentDate: string;
  chiefComplaint: string;
  diagnosisDescriptions: string[];
}

interface ChartBooking {
  id: string;
  appointmentDate: string;
  serviceNames: string[];
  status: BookingStatus;
  queueNumber: string | null;
}

interface ChartVitalReading {
  id: string;
  bookingId: string;
  templateId: string;
  value: string;
}

interface ChartLab {
  id: string;
  resultTitle: string;
}

interface ChartDocument {
  id: string;
  title: string;
}

interface ChartVaccination {
  id: string;
  vaccineName: string;
  doseNumber: number | null;
  administeredDate: string | null;
  status: string;
}

// 44x44 minimum touch target for every icon-only action (WCAG 2.5.8).
const ICON_BTN = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface-container-low";

const TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "appointments", label: "Appointments" },
  { id: "consultations", label: "Consultations" },
  { id: "vitals", label: "Vitals" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "labs", label: "Lab Results" },
  { id: "documents", label: "Documents" },
  { id: "vaccinations", label: "Vaccinations" },
];

// Stitch patient_detail_doctor_view — all tabs read-only per Doctor.md §6,
// except Vitals' "+ " add action, which per clinic-vitals-fe.md's
// isAppointmentReferred gate only appears when this chart was opened from an
// active appointment (mapped here to a ?bookingId= query param).
function DoctorPatientDetailWorkflow({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const { session } = useSession();
  const doctorId = session?.staffId ?? "";
  const referredBookingId = searchParams.get("bookingId");
  const [loaded, setLoaded] = useState(false);
  const [patient, setPatient] = useState<RealPatientHeader | null>(null);
  const [patientConsultations, setPatientConsultations] = useState<DoctorConsultationEntry[]>([]);
  const [prescriptionGroups, setPrescriptionGroups] = useState<PrescriptionGroup[]>([]);
  const [patientBookings, setPatientBookings] = useState<ChartBooking[]>([]);
  const [vitalTemplates, setVitalTemplates] = useState<VitalFieldTemplate[]>([]);
  const [patientVitalReadings, setPatientVitalReadings] = useState<ChartVitalReading[]>([]);
  const [patientLabResults, setPatientLabResults] = useState<ChartLab[]>([]);
  const [patientDocuments, setPatientDocuments] = useState<ChartDocument[]>([]);
  const [patientVaccinations, setPatientVaccinations] = useState<ChartVaccination[]>([]);
  const [tab, setTab] = useState(searchParams.get("tab") ?? "timeline");
  const [vitalsView, setVitalsView] = useState<"list" | "table">("list");
  const [vitalsSort, setVitalsSort] = useState<"desc" | "asc">("desc");
  const [rxSort, setRxSort] = useState<"desc" | "asc">("desc");
  const [printPreviewGroup, setPrintPreviewGroup] = useState<PrescriptionGroup | null>(null);
  const [deleteRxGroupId, setDeleteRxGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId) return;

    async function load() {
      const supabase = null as never;
      const [patientRow, consultsRes, rxRes, bookingRows, templates, vitalRows, labRows, docRows, vaxRows] = await Promise.all([
        queryPatientById(supabase, id),
        queryConsultations(supabase, { patientId: id, doctorId }),
        queryRxGroups(supabase, { patientId: id, doctorId }),
        queryBookings(supabase, { patientId: id, doctorId }),
        queryVitalFieldTemplates(supabase),
        queryVitalReadings(supabase, { patientId: id }),
        queryPatientLabResults(supabase, { patientId: id }),
        queryPatientDocuments(supabase, { patientId: id }),
        queryVaccinations(supabase, id),
      ]);

      if (patientRow) {
        setPatient({
          id: patientRow.patient_id,
          fullName: `${patientRow.first_name} ${patientRow.last_name}`,
          patientCode: patientRow.patient_code,
          sex: patientRow.sex,
          dateOfBirth: patientRow.date_of_birth,
          contactNumber: patientRow.contact_number ?? "",
        });
      } else {
        setPatient(null);
        setLoaded(true);
        return;
      }

      const consults = consultsRes
        .map((c) => ({
          id: c.consultation_id,
          appointmentDate: c.bookings?.appointment_date ?? "",
          chiefComplaint: c.chief_complaint ?? "",
          diagnosisDescriptions: (c.consultation_diagnoses ?? []).map((d) => d.custom_description ?? "").filter(Boolean),
        }))
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      setPatientConsultations(consults);

      setPrescriptionGroups(
        rxRes.map((g) => ({
          id: g.group_id,
          patientId: g.patient_id,
          doctorId: g.doctor_id,
          bookingId: g.booking_id,
          createdAt: g.created_at.slice(0, 10),
          items: (g.prescription_line_items ?? []).map((i) => ({
            id: i.id ?? "",
            rxId: i.medicine_id,
            genericName: i.generic_name,
            dosage: i.dosage,
            quantity: i.quantity,
            instruction: i.instruction ?? "",
            isControlledSubstance: i.is_controlled_substance,
          })),
        })),
      );

      setPatientBookings(
        bookingRows.map((b) => ({
          id: b.booking_id,
          appointmentDate: b.appointment_date,
          status: b.status as BookingStatus,
          queueNumber: b.queue_number,
          serviceNames: b.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
        })),
      );

      setVitalTemplates(
        templates.map((t) => ({
          id: t.template_id,
          description: t.description,
          formKey: t.form_key,
          unit: t.unit,
          icon: t.icon,
          isDefault: t.is_default,
        })),
      );

      setPatientVitalReadings(
        vitalRows.map((r) => ({
          id: r.id ?? "",
          bookingId: r.booking_id ?? "",
          templateId: r.template_id,
          value: r.value,
        })),
      );

      setPatientLabResults(
        labRows.map((l) => ({
          id: l.id ?? "",
          resultTitle: l.result_title || "Lab result",
        })),
      );

      setPatientDocuments(
        docRows.map((d) => ({
          id: d.id ?? "",
          title: d.title || d.file_name,
        })),
      );

      setPatientVaccinations(
        vaxRows.map((v) => ({
          id: v.id,
          vaccineName: v.vaccine_name,
          doseNumber: v.dose_number,
          administeredDate: v.administered_date,
          status: v.status,
        })),
      );

      setLoaded(true);
    }
    load();
  }, [id, doctorId]);

  if (!doctorId || !loaded) {
    return (
      <AppShell role="doctor">
        <div className="space-y-md">
          <SkeletonCard lines={3} />
          <SkeletonTable rows={5} columns={4} />
        </div>
      </AppShell>
    );
  }
  if (!patient) notFound();

  const defaultVitalTemplates = vitalTemplates.filter((t) => t.isDefault);
  const vitalBookingIds = Array.from(new Set(patientVitalReadings.map((r) => r.bookingId)));
  const vitalBookings = vitalBookingIds
    .map((bookingId) => patientBookings.find((b) => b.id === bookingId))
    .filter((b): b is ChartBooking => !!b)
    .sort((a, b) =>
      vitalsSort === "desc" ? b.appointmentDate.localeCompare(a.appointmentDate) : a.appointmentDate.localeCompare(b.appointmentDate),
    );

  const patientPrescriptionGroups = [...prescriptionGroups].sort((a, b) =>
    rxSort === "desc" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
  );

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-6xl space-y-lg">
        <Link
          href="/doctor/patients"
          className="inline-flex items-center gap-xs text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="chevron_left" className="text-[14px]" />
          Back to Patients
        </Link>

        <Card>
          <div className="flex flex-wrap items-center gap-md">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body-lg font-semibold text-primary">
              {initials(patient.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-sm">
                <h1 className="text-headline-md text-on-surface">{patient.fullName}</h1>
                <span className="text-label-md text-on-surface-variant">{patient.patientCode}</span>
              </div>
              <p className="mt-xs text-body-md text-on-surface-variant">
                {patient.sex} · {computeAge(patient.dateOfBirth)} yrs · Born {patient.dateOfBirth}
              </p>
            </div>
            {patient.contactNumber && (
              <a
                href={`tel:${patient.contactNumber}`}
                className="inline-flex items-center gap-sm rounded-lg border border-outline-variant px-md py-sm text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
              >
                <Icon name="call" className="text-[16px]" />
                {patient.contactNumber}
              </a>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-md flex flex-wrap items-center justify-between gap-md">
            <Tabs tabs={TABS} activeId={tab} onChange={setTab} className="flex-1" />
            <span className="mb-md inline-flex shrink-0 items-center gap-xs rounded-full bg-surface-container-high px-sm py-xs text-label-sm text-on-surface-variant">
              <Icon name="lock" className="text-[12px]" />
              Read-only
            </span>
          </div>

          {tab === "timeline" && (
            <div className="space-y-sm">
              {patientBookings.length === 0 ? (
                <EmptyState icon="event" message="No appointments with you yet." />
              ) : (
                patientBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-md rounded-xl border border-outline-variant p-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon name="event" className="text-[16px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface">{b.serviceNames.join(", ") || "Consultation"}</p>
                      <p className="text-label-sm text-on-surface-variant">{b.appointmentDate}</p>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                ))
              )}
            </div>
          )}
          {tab === "appointments" && (
            patientBookings.length === 0 ? (
              <EmptyState icon="event" message="No appointments with you yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-md">
                  <thead>
                    <tr className="text-left text-label-md text-on-surface-variant">
                      <th className="py-sm">Date</th><th className="py-sm">Service</th><th className="py-sm">Status</th><th className="py-sm text-center">Queue #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientBookings.map((b) => (
                      <tr key={b.id} className="border-t border-outline-variant/40">
                        <td className="py-sm">{b.appointmentDate}</td>
                        <td className="py-sm">{b.serviceNames.join(", ") || "—"}</td>
                        <td className="py-sm"><StatusPill status={b.status} /></td>
                        <td className="py-sm text-center">{b.queueNumber ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {tab === "consultations" && (
            <div className="space-y-md">
              {patientConsultations.length === 0 ? (
                <EmptyState icon="clinical_notes" message="No consultations recorded yet." />
              ) : (
                patientConsultations.map((c) => (
                  <div key={c.id} className="rounded-xl border border-outline-variant p-md">
                    <div className="flex flex-wrap items-baseline justify-between gap-sm">
                      <p className="text-body-md font-medium text-on-surface">{c.chiefComplaint || "Consultation"}</p>
                      <p className="text-label-sm text-on-surface-variant">{c.appointmentDate}</p>
                    </div>
                    {c.diagnosisDescriptions.length > 0 && (
                      <div className="mt-sm flex flex-wrap gap-xs">
                        {c.diagnosisDescriptions.map((d, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-surface-container-high px-sm py-xs text-label-sm text-on-surface-variant"
                          >
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
              <div className="flex flex-wrap items-center justify-between gap-md">
                <div className="flex gap-xs rounded-lg border border-outline-variant p-1">
                  <button
                    type="button"
                    onClick={() => setVitalsView("list")}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-md transition-colors",
                      vitalsView === "list" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low",
                    )}
                    title="List view"
                    aria-label="List view"
                    aria-pressed={vitalsView === "list"}
                  >
                    <Icon name="view_list" className="text-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVitalsView("table")}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-md transition-colors",
                      vitalsView === "table" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low",
                    )}
                    title="Table view"
                    aria-label="Table view"
                    aria-pressed={vitalsView === "table"}
                  >
                    <Icon name="table_rows" className="text-[18px]" />
                  </button>
                </div>
                <div className="flex items-center gap-sm">
                  {vitalBookings.length > 0 && (
                    <select
                      value={vitalsSort}
                      onChange={(e) => setVitalsSort(e.target.value as "desc" | "asc")}
                      className="rounded-lg border border-outline-variant px-sm py-xs text-label-sm"
                    >
                      <option value="desc">Newest first</option>
                      <option value="asc">Oldest first</option>
                    </select>
                  )}
                  {referredBookingId && (
                    <Link href={`/doctor/consultation/${referredBookingId}/vitals`}>
                      <Button>
                        <Icon name="add_circle" className="text-[16px]" />
                        Add Vitals
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {vitalBookings.length === 0 ? (
                <EmptyState icon="monitoring" message="No vital signs recorded yet." />
              ) : vitalsView === "list" ? (
                <div className="space-y-md">
                  {vitalBookings.map((b) => {
                    const readingsForBooking = patientVitalReadings.filter((r) => r.bookingId === b.id);
                    return (
                      <Link key={b.id} href={`/doctor/consultation/${b.id}/vitals`} className="block">
                      <Card hoverable>
                        <p className="mb-md text-label-md font-medium text-on-surface">{b.appointmentDate}</p>
                        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                          {defaultVitalTemplates.map((t) => {
                            const reading = readingsForBooking.find((r) => r.templateId === t.id);
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
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-outline-variant">
                  <table className="w-full text-body-md">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low text-left text-label-md text-on-surface-variant">
                        <th className="sticky left-0 z-10 bg-surface-container-low px-lg py-md">Vital</th>
                        {vitalBookings.map((b) => (
                          <th key={b.id} className="px-lg py-md text-center">{b.appointmentDate}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {defaultVitalTemplates.map((t) => (
                        <tr key={t.id} className="border-t border-outline-variant/40">
                          <td className="sticky left-0 z-10 flex items-center gap-sm bg-surface-container-lowest px-lg py-md text-on-surface">
                            <Icon name={t.icon} className="text-[16px] text-primary" />
                            {t.description}
                          </td>
                          {vitalBookings.map((b) => {
                            const reading = patientVitalReadings.find((r) => r.bookingId === b.id && r.templateId === t.id);
                            return (
                              <td key={b.id} className="px-lg py-md text-center text-on-surface-variant">
                                {reading ? `${reading.value}${t.unit ? ` ${t.unit}` : ""}` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {tab === "prescriptions" && (
            <div className="space-y-md">
              <div className="flex flex-wrap items-center justify-between gap-md">
                {patientPrescriptionGroups.length > 0 ? (
                  <select
                    value={rxSort}
                    onChange={(e) => setRxSort(e.target.value as "desc" | "asc")}
                    className="rounded-lg border border-outline-variant px-sm py-xs text-label-sm"
                  >
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                  </select>
                ) : (
                  <span />
                )}
                {referredBookingId && (
                  <Link href={`/doctor/patients/${patient.id}/prescriptions/create?bookingId=${referredBookingId}`}>
                    <Button>
                      <Icon name="add_circle" className="text-[16px]" />
                      New Prescription
                    </Button>
                  </Link>
                )}
              </div>

              {patientPrescriptionGroups.length === 0 ? (
                <EmptyState icon="prescriptions" message="No prescriptions recorded yet." />
              ) : (
                <div className="space-y-md">
                  {patientPrescriptionGroups.map((group) => (
                    <Card key={group.id}>
                      <div className="flex items-start justify-between gap-md border-b border-outline-variant pb-md">
                        <div className="flex items-center gap-sm">
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
                        <div className="flex items-center gap-xs">
                          <button
                            type="button"
                            onClick={() => setPrintPreviewGroup(group)}
                            aria-label="Print prescription"
                            title="Print prescription"
                            className={cn(ICON_BTN, "text-on-surface-variant hover:text-primary")}
                          >
                            <Icon name="print" className="text-[18px]" />
                          </button>
                          {referredBookingId && (
                            <>
                              <Link
                                href={`/doctor/patients/${patient.id}/prescriptions/${group.id}`}
                                aria-label="Edit prescription"
                                title="Edit prescription"
                                className={cn(ICON_BTN, "text-on-surface-variant hover:text-primary")}
                              >
                                <Icon name="edit" className="text-[18px]" />
                              </Link>
                              <Link
                                href={`/doctor/patients/${patient.id}/prescriptions/create?copyFrom=${group.id}&bookingId=${referredBookingId}`}
                                aria-label="Copy prescription"
                                title="Copy prescription"
                                className={cn(ICON_BTN, "text-on-surface-variant hover:text-primary")}
                              >
                                <Icon name="copy" className="text-[18px]" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleteRxGroupId(group.id)}
                                aria-label="Delete prescription"
                                title="Delete prescription"
                                className={cn(ICON_BTN, "text-error hover:bg-error-container")}
                              >
                                <Icon name="delete" className="text-[18px]" />
                              </button>
                            </>
                          )}
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
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === "labs" && (
            patientLabResults.length === 0 ? (
              <EmptyState icon="science" message="No lab results yet." />
            ) : (
              <div className="space-y-sm">
                {patientLabResults.map((l) => (
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
            patientDocuments.length === 0 ? (
              <EmptyState icon="description" message="No documents yet." />
            ) : (
              <div className="space-y-sm">
                {patientDocuments.map((d) => (
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
            patientVaccinations.length === 0 ? (
              <EmptyState icon="vaccines" message="No vaccinations recorded yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-md">
                  <thead>
                    <tr className="text-left text-label-md text-on-surface-variant">
                      <th className="py-sm">Vaccine</th><th className="py-sm">Dose #</th><th className="py-sm">Date</th><th className="py-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientVaccinations.map((v) => (
                      <tr key={v.id} className="border-t border-outline-variant/40">
                        <td className="py-sm">{v.vaccineName}</td>
                        <td className="py-sm">{v.doseNumber ?? "—"}</td>
                        <td className="py-sm">{v.administeredDate ?? "—"}</td>
                        <td className="py-sm"><StatusPill tone={v.status === "Administered" ? "success" : "warning"} label={v.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>
      </div>

      <Modal
        isOpen={printPreviewGroup !== null}
        onClose={() => setPrintPreviewGroup(null)}
        title="Print Preview"
        footer={
          <Button
            onClick={() => {
              if (!printPreviewGroup) return;
              const items = printPreviewGroup.items
                .map(
                  (item, i) =>
                    `<p><strong>${i + 1}. ${escapeHtml(item.genericName)} #${escapeHtml(item.quantity)}</strong><br/>Sig. ${escapeHtml(item.dosage)} ${escapeHtml(item.instruction)}</p>`,
                )
                .join("");
              printHtml(
                `Prescription ${patient.fullName}`,
                `<h1>Prescription</h1>
                 <p class="meta">${escapeHtml(patient.fullName)} · ${escapeHtml(printPreviewGroup.createdAt)}</p>
                 <div class="card">${items}</div>`,
              );
            }}
          >
            Print
          </Button>
        }
      >
        {printPreviewGroup && (
          <div className="space-y-md rounded-lg border border-outline-variant p-lg">
            <div className="flex items-center justify-between border-b border-outline-variant pb-sm">
              <div>
                <p className="text-headline-sm text-on-surface">{patient.fullName}</p>
                <p className="text-label-md text-on-surface-variant">{printPreviewGroup.createdAt}</p>
              </div>
              <Icon name="prescriptions" className="text-[28px] text-primary" />
            </div>
            <div className="space-y-sm">
              {printPreviewGroup.items.map((item, i) => (
                <p key={item.id} className="text-body-md text-on-surface-variant">
                  <span className="text-on-surface">
                    {i + 1}. {item.genericName} #{item.quantity}
                  </span>
                  <br />
                  Sig. {item.dosage} {item.instruction}
                </p>
              ))}
            </div>
            <p className="text-label-sm text-on-surface-variant">
              File name: {patient.fullName.replace(/\s+/g, "_")}_{printPreviewGroup.bookingId}
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteRxGroupId !== null}
        onClose={() => setDeleteRxGroupId(null)}
        title="Delete Prescription?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRxGroupId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const supabase = null as never;
                await deleteRxGroup(supabase, deleteRxGroupId!);
                setPrescriptionGroups((prev) => prev.filter((g) => g.id !== deleteRxGroupId));
                setDeleteRxGroupId(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">Are you sure you want to delete prescription/s?</p>
      </Modal>
    </AppShell>
  );
}

export default function DoctorPatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <DoctorPatientDetailWorkflow id={id} />
    </Suspense>
  );
}
