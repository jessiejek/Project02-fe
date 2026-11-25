"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { useSearchParams, notFound } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { queryConsultations, queryRxGroups, queryVitalReadings, deleteRxGroup } from "@/lib/data/clinical";
import { queryVitalFieldTemplates } from "@/lib/data/lookups";
import { queryPatientById } from "@/lib/data/patients";
import { queryBookings } from "@/lib/data/bookings";
import { openPatientFile, queryPatientDocuments, queryPatientLabResults, queryVaccinations } from "@/lib/data/patientFiles";
//JJQR - AI (Nov 25, 2026) - desktop parity: upload to one visit + Reprint
import { VisitUploadModal } from "@/components/doctor/VisitUploadModal";
import { formatUploadedManila } from "@/lib/visit-upload"; //JJQR - AI (2026-11-25) - owner: Manila upload times //JJQR - END
import { loadBookingReprintAvailability, printLabOrdersForBooking, printMedicalCertificateForBooking } from "@/lib/consult-print";
//JJQR - END
import { printPrescription } from "@/lib/print-forms";
import { queryClinicSettings } from "@/lib/data/admin";
import { queryDoctorById } from "@/lib/data/doctors";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { todayManila } from "@/lib/clock";
import type { PrescriptionGroup, VitalFieldTemplate, BookingStatus } from "@/data/types";
//JJQR - AI (Nov 20, 2026)
import { asNeededFromWire, asNeededToWire } from "@/lib/rx-structured";
//JJQR - END

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
  bookingId: string;
  appointmentDate: string;
  chiefComplaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnosisDescriptions: string[];
}

interface ChartBooking {
  id: string;
  appointmentDate: string;
  serviceNames: string[];
  status: BookingStatus;
  queueNumber: string | null;
  totalFee: number;
  visitType: string;
  discount: string | null;
  medCert: boolean;
}

interface ChartVitalReading {
  id: string;
  bookingId: string;
  templateId: string;
  value: string;
}

//JJQR - AI (Nov 25, 2026) - owner: every file belongs to ONE consultation (booking) — kept here so each visit shows its own files (desktop parity)
interface ChartLab {
  id: string;
  resultTitle: string;
  bookingId: string;
  uploadedAt: string;
}

interface ChartDocument {
  id: string;
  title: string;
  bookingId: string;
  uploadedAt: string;
}

/** Visits that did not take place cannot take files (same rule as the desktop). */
const NO_UPLOAD_STATUSES = new Set(["Cancelled", "NoShow", "Expired", "Rescheduled"]);
//JJQR - END

interface ChartVaccination {
  id: string;
  vaccineName: string;
  doseNumber: number | null;
  administeredDate: string | null;
  status: string;
}


//JJQR - AI (Nov 22, 2026) - matched to the desktop chart: Timeline, Appointments, Consultations, Vitals and Prescriptions are ONE "Visits" tab (each visit opens to show everything)
const TABS = [
  { id: "timeline", label: "Visits" },
  { id: "labs", label: "Lab Results" },
  { id: "documents", label: "Documents" },
  { id: "vaccinations", label: "Vaccinations" },
];
const TAB_ALIASES: Record<string, string> = { appointments: "timeline", consultations: "timeline", vitals: "timeline", prescriptions: "timeline" };

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
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [patient, setPatient] = useState<RealPatientHeader | null>(null);
  const [patientConsultations, setPatientConsultations] = useState<DoctorConsultationEntry[]>([]);
  const [prescriptionGroups, setPrescriptionGroups] = useState<PrescriptionGroup[]>([]);
  const [patientBookings, setPatientBookings] = useState<ChartBooking[]>([]);
  const [vitalTemplates, setVitalTemplates] = useState<VitalFieldTemplate[]>([]);
  const [patientVitalReadings, setPatientVitalReadings] = useState<ChartVitalReading[]>([]);
  const [patientLabResults, setPatientLabResults] = useState<ChartLab[]>([]);
  const [patientDocuments, setPatientDocuments] = useState<ChartDocument[]>([]);
  const [patientVaccinations, setPatientVaccinations] = useState<ChartVaccination[]>([]);
  const requestedTab = searchParams.get("tab") ?? "timeline";
  const [tab, setTab] = useState(TAB_ALIASES[requestedTab] ?? requestedTab);
  const [expandedConsultationId, setExpandedConsultationId] = useState<string | null>(null);
  const [printPreviewGroup, setPrintPreviewGroup] = useState<PrescriptionGroup | null>(null);
  const [deleteRxGroupId, setDeleteRxGroupId] = useState<string | null>(null);
  //JJQR - AI (Nov 25, 2026) - owner: desktop parity — upload to one visit, Reprint view, open files
  const [uploadFor, setUploadFor] = useState<{ bookingId: string; date: string; kind: "lab" | "doc" } | null>(null);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintInfo, setReprintInfo] = useState<Record<string, { hasLabs: boolean; hasCert: boolean }>>({});
  const [reprintChecked, setReprintChecked] = useState(false);
  const [chartError, setChartError] = useState("");
  const [printing, setPrinting] = useState(false);
  //JJQR - END

  useEffect(() => {
    if (!doctorId) return;

    let cancelled = false;
    async function load() {
      try {
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

      if (cancelled) return;
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
          bookingId: c.booking_id,
          appointmentDate: c.bookings?.appointment_date ?? "",
          chiefComplaint: c.chief_complaint ?? "",
          subjective: c.subjective ?? "",
          objective: c.objective ?? "",
          assessment: c.assessment ?? "",
          plan: c.plan ?? "",
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
            //JJQR - AI (Oct 31, 2026)
            mealRelation: (i.meal_relation as "Before" | "After" | null) ?? null,
            timing: i.timing ?? null,
            //JJQR - AI (Nov 20, 2026)
            asNeeded: asNeededFromWire(i.as_needed),
            //JJQR - END
            durationKind: (i.duration_kind as "Maintain" | "Days" | "Weeks" | null) ?? null,
            durationValue: i.duration_value ?? null,
            indication: i.indication ?? null,
            route: i.route ?? null,
            //JJQR - END
          })),
        })),
      );

      setPatientBookings(
        bookingRows.map((b) => ({
          id: b.booking_id,
          appointmentDate: b.appointment_date,
          status: b.status as BookingStatus,
          queueNumber: b.queue_number,
          totalFee: b.total_fee,
          visitType: b.visit_type,
          discount: b.discount_category,
          medCert: b.med_cert_requested,
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
          bookingId: l.booking_id ?? "", //JJQR - AI (Nov 25, 2026) - the visit it belongs to //JJQR - END
          uploadedAt: l.uploaded_at ?? "",
        })),
      );

      setPatientDocuments(
        docRows.map((d) => ({
          id: d.id ?? "",
          title: d.title || d.file_name,
          bookingId: d.booking_id ?? "", //JJQR - AI (Nov 25, 2026) - the visit it belongs to //JJQR - END
          uploadedAt: d.uploaded_at ?? "",
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
      } catch { if (!cancelled) setLoadError(true); }
    }
    load();
    return () => { cancelled = true; };
  }, [id, doctorId, loadAttempt]);

  //JJQR - AI (Nov 25, 2026) - Reprint: find out which visits have a lab request / certificate (once, when the view opens)
  // code review: depends on the visit ids (not the array, which is new after every reload), skips visits already checked,
  // and asks at most 4 visits at a time (2 requests each) so a long history does not flood the slow server.
  const bookingIdsKey = patientBookings.map((b) => b.id).join(",");
  useEffect(() => {
    if (!reprintOpen) return;
    const todo = bookingIdsKey ? bookingIdsKey.split(",").filter((bid) => !(bid in reprintInfo)) : [];
    let cancelled = false;
    //JJQR - AI (2026-11-25) - lint (react-hooks/set-state-in-effect): set "checked" right after the effect runs, not synchronously inside it (same screen)
    if (todo.length === 0) { void Promise.resolve().then(() => { if (!cancelled) setReprintChecked(true); }); return () => { cancelled = true; }; }
    void Promise.resolve().then(() => { if (!cancelled) setReprintChecked(false); });
    //JJQR - END
    const found: Record<string, { hasLabs: boolean; hasCert: boolean }> = {};
    let next = 0;
    const worker = async () => {
      while (!cancelled && next < todo.length) {
        const bid = todo[next++];
        found[bid] = await loadBookingReprintAvailability(bid).catch(() => ({ hasLabs: false, hasCert: false }));
      }
    };
    Promise.all(Array.from({ length: Math.min(4, todo.length) }, worker)).then(() => {
      if (cancelled) return;
      setReprintInfo((prev) => ({ ...prev, ...found }));
      setReprintChecked(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reprintInfo is read only to skip visits already checked
  }, [reprintOpen, bookingIdsKey]);
  //JJQR - END

  if (loadError) return <AppShell role="doctor"><ErrorState title="Patient chart unavailable" message="This chart could not be loaded. Please try again." onRetry={() => { setLoadError(false); setLoaded(false); setLoadAttempt(n => n+1); }} /></AppShell>;

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
  const vitalLabel = (tplId: string) => defaultVitalTemplates.find((t) => t.id === tplId);
  const visits = [...patientBookings]
    .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate))
    .map((booking) => {
      const consult = patientConsultations.find((c) => c.bookingId === booking.id) ?? null;
      const vitals = patientVitalReadings
        .filter((r) => r.bookingId === booking.id)
        .map((r) => ({ r, t: vitalLabel(r.templateId) }))
        .filter((x) => x.t)
        .map(({ r, t }) => ({ id: r.id, label: t!.description, value: r.value, unit: t!.unit ?? "" }));
      const rx = prescriptionGroups.filter((g) => g.bookingId === booking.id);
      const dxList = consult?.diagnosisDescriptions.length ? consult.diagnosisDescriptions : consult?.assessment.trim() ? [consult.assessment.trim().split("\n")[0].slice(0, 90)] : [];
      return { booking, consult, vitals, rx, dxList, dx: dxList.join(" · ") };
    });
  const latestVisit = visits.find((v) => v.consult || v.vitals.length > 0) ?? null;
  //JJQR - AI (Nov 25, 2026) - desktop parity helpers: files of one visit, visit date of a file, open / print with an error line
  const filesOf = (bookingId: string) => [
    ...patientLabResults.filter((l) => l.bookingId === bookingId).map((l) => ({ id: l.id, title: l.resultTitle, uploadedAt: l.uploadedAt, kind: "lab-result" as const })),
    ...patientDocuments.filter((d) => d.bookingId === bookingId).map((d) => ({ id: d.id, title: d.title, uploadedAt: d.uploadedAt, kind: "document" as const })),
  ].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  // code review: this chart lists only this doctor's visits; a file from another doctor's visit says so instead of "—"
  const visitDateOf = (bookingId: string) => patientBookings.find((b) => b.id === bookingId)?.appointmentDate ?? "with another doctor";
  const openFile = (kind: "document" | "lab-result", fileId: string) => {
    setChartError("");
    openPatientFile(kind, fileId).catch((e) => setChartError(e instanceof Error ? e.message : "Could not open the file."));
  };
  const runPrint = async (what: string, job: () => Promise<boolean>) => {
    if (printing) return;
    setChartError("");
    setPrinting(true);
    try { if (!(await job())) setChartError(`Nothing to print: this visit has no ${what}.`); }
    catch (e) { setChartError(e instanceof Error && e.message ? e.message : `The ${what} could not be printed. Please try again.`); }
    finally { setPrinting(false); }
  };
  const reload = () => setLoadAttempt((n) => n + 1);
  //JJQR - END

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-[1400px] space-y-md">
        <Link
          href="/doctor/patients"
          className="inline-flex items-center gap-xs text-label-md text-primary transition-colors hover:underline"
        >
          <Icon name="chevron_left" className="text-[14px]" />
          Back to Patients
        </Link>

        <div className="grid items-start gap-md lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* LEFT RAIL: who the patient is + the latest record (desktop chart) */}
          <aside className="space-y-md">
            <Card>
              <div className="flex flex-col items-start gap-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body-lg font-semibold text-primary">
                  {initials(patient.fullName)}
                </div>
                <div className="min-w-0">
                  <h1 className="text-balance text-headline-md font-semibold text-on-surface">{patient.fullName}</h1>
                  <span className="font-mono text-label-sm text-on-surface-variant">{patient.patientCode}</span>
                </div>
              </div>
              <dl className="mt-md space-y-xs border-t border-outline-variant pt-md text-body-sm">
                {[
                  ["Sex", patient.sex],
                  ["Age", `${computeAge(patient.dateOfBirth)} years`],
                  ["Born", patient.dateOfBirth],
                  ["Phone", patient.contactNumber || "—"],
                  ["Visits with you", String(patientBookings.length)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-md">
                    <dt className="text-on-surface-variant">{k}</dt>
                    <dd className="font-medium text-on-surface">{v}</dd>
                  </div>
                ))}
              </dl>
              {/* //JJQR - AI (Nov 25, 2026) - owner: "Reprint" button in the left panel (desktop: under "Print patient card"; the web has no patient card) */}
              <Button variant="secondary" className="mt-md w-full" onClick={() => { setChartError(""); setReprintOpen(true); }}>Reprint</Button>
              {/* //JJQR - END */}
            </Card>

            {latestVisit && (
              <div className="space-y-sm rounded-lg border border-primary/40 bg-primary/5 p-md">
                <div className="flex items-center justify-between gap-sm">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Latest record</p>
                  <span className="rounded-full bg-primary px-sm py-[2px] text-[12px] font-semibold text-on-primary">{latestVisit.booking.appointmentDate}</span>
                </div>
                <p className="text-body-md font-semibold text-on-surface">{latestVisit.consult?.chiefComplaint || "Consultation"}</p>
                {latestVisit.dx && <p className="text-body-sm text-on-surface-variant">{latestVisit.dx}</p>}
                {latestVisit.vitals.length > 0 && (
                  <>
                    <p className="pt-xs text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Vitals</p>
                    <div className="grid grid-cols-2 gap-xs">
                      {latestVisit.vitals.map((v) => (
                        <div key={v.id} className="rounded-md border border-outline-variant bg-surface-container-lowest px-sm py-xs">
                          <p className="text-[12px] text-on-surface-variant">{v.label}</p>
                          <p className="text-body-md font-semibold text-on-surface">{v.value}<span className="ml-[2px] text-[12px] font-normal text-on-surface-variant">{v.unit}</span></p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {latestVisit.dxList.length > 0 && (
                  <>
                    <p className="pt-xs text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Diagnosis</p>
                    <div className="flex flex-wrap gap-xs">
                      {latestVisit.dxList.map((d, i) => (
                        <span key={i} className="rounded-md border border-primary/40 bg-surface-container-lowest px-sm py-xs text-label-sm font-semibold text-primary">{d}</span>
                      ))}
                    </div>
                  </>
                )}
                {latestVisit.rx.length > 0 && (
                  <>
                    <p className="pt-xs text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Prescribed</p>
                    <div className="space-y-xs">
                      {latestVisit.rx.flatMap((g) => g.items).map((item) => (
                        <div key={item.id} className="rounded-md border border-outline-variant bg-surface-container-lowest px-sm py-xs">
                          <p className="text-body-sm font-semibold text-on-surface">{item.genericName}</p>
                          <p className="text-[12px] text-on-surface-variant">{item.dosage} · {item.quantity}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </aside>

          {/* RIGHT: tabs */}
          <Card>
            <div className="mb-md">
              <Tabs tabs={TABS.map((t) => t.id === "timeline" ? { ...t, label: `Visits ${visits.length}` } : t.id === "labs" ? { ...t, label: patientLabResults.length ? `Lab Results ${patientLabResults.length}` : t.label } : t.id === "documents" ? { ...t, label: patientDocuments.length ? `Documents ${patientDocuments.length}` : t.label } : t.id === "vaccinations" ? { ...t, label: patientVaccinations.length ? `Vaccinations ${patientVaccinations.length}` : t.label } : t)} activeId={reprintOpen ? "" : tab} onChange={(t) => { setReprintOpen(false); setTab(t); }} />
              {chartError && <p role="alert" className="mt-sm text-body-sm text-error">{chartError}</p>}
            </div>

            {tab === "timeline" && !reprintOpen && (
              visits.length === 0 ? (
                <EmptyState icon="event" message="No appointments with you yet." />
              ) : (
                <div className="space-y-sm">
                  {visits.map((v) => {
                    const open = (expandedConsultationId ?? visits[0]?.booking.id) === v.booking.id;
                    const c = v.consult;
                    const hasSoap = !!c && [c.subjective, c.objective, c.assessment, c.plan].some((f) => f.trim() !== "");
                    return (
                      <div key={v.booking.id} className="rounded-lg border border-outline-variant">
                        <button
                          type="button"
                          onClick={() => setExpandedConsultationId(open ? "" : v.booking.id)}
                          aria-expanded={open}
                          className="flex w-full flex-wrap items-start justify-between gap-sm p-md text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-sm">
                              <span className="text-label-md tabular-nums text-on-surface-variant">{v.booking.appointmentDate}</span>
                              {v.booking.queueNumber && <span className="font-mono text-label-sm text-on-surface-variant">{v.booking.queueNumber}</span>}
                              <span className="text-body-md font-semibold text-on-surface">{c?.chiefComplaint || v.booking.serviceNames.join(", ") || "Consultation"}</span>
                            </span>
                            {v.dx && <span className="mt-xs block text-body-sm text-on-surface-variant">{v.dx}</span>}
                            <span className="mt-xs flex flex-wrap gap-xs">
                              {v.rx.length > 0 && <span className="rounded-md bg-status-info-surface px-sm py-[2px] text-[12px] font-semibold text-status-info">RX {v.rx.flatMap((g) => g.items).length}</span>}
                              {v.booking.medCert && <span className="rounded-md bg-status-info-surface px-sm py-[2px] text-[12px] font-semibold text-status-info">MED CERT</span>}
                            </span>
                          </span>
                          <span className="flex items-center gap-sm">
                            <StatusPill status={v.booking.status} />
                            <Icon name={open ? "expand_less" : "expand_more"} className="text-[18px] text-on-surface-variant" />
                          </span>
                        </button>
                        {open && (
                          <div className="grid gap-md border-t border-outline-variant p-md md:grid-cols-2">
                            <div className="space-y-sm text-body-sm">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Notes</p>
                              {hasSoap && c ? (
                                <>
                                  <p><strong className="text-primary">Subjective</strong><br />{c.subjective || "Not recorded."}</p>
                                  <p><strong className="text-primary">Objective</strong><br />{c.objective || "Not recorded."}</p>
                                  <p><strong className="text-primary">Assessment</strong><br />{c.assessment || "Not recorded."}</p>
                                  <p><strong className="text-primary">Plan</strong><br />{c.plan || "Not recorded."}</p>
                                </>
                              ) : (
                                <p className="text-on-surface-variant">No SOAP notes recorded for this visit.</p>
                              )}
                              {v.vitals.length > 0 && (
                                <>
                                  <p className="pt-sm text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Vitals</p>
                                  <div className="grid grid-cols-3 gap-xs">
                                    {v.vitals.map((vt) => (
                                      <div key={vt.id} className="rounded-md border border-outline-variant px-sm py-xs">
                                        <p className="text-[12px] text-on-surface-variant">{vt.label}</p>
                                        <p className="text-body-sm font-semibold text-on-surface">{vt.value}<span className="ml-[2px] text-[12px] font-normal text-on-surface-variant">{vt.unit}</span></p>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="space-y-sm text-body-sm">
                              <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Prescription</p>
                              {v.rx.length === 0 ? (
                                <p className="text-on-surface-variant">None prescribed.</p>
                              ) : (
                                v.rx.map((group) => (
                                  <div key={group.id} className="space-y-xs">
                                    {group.items.map((item) => (
                                      <div key={item.id} className="rounded-md border border-outline-variant px-sm py-xs">
                                        <p className="font-semibold text-on-surface">{item.genericName}</p>
                                        <p className="text-[12px] text-on-surface-variant">{item.dosage} · {item.quantity}</p>
                                        {item.instruction && <p className="text-[12px] text-on-surface-variant">{item.instruction}</p>}
                                      </div>
                                    ))}
                                    <div className="flex flex-wrap gap-xs pt-xs">
                                      <button type="button" onClick={() => setPrintPreviewGroup(group)} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Print prescription</button>
                                      {referredBookingId && (
                                        <>
                                          <Link href={`/doctor/patients/${patient.id}/prescriptions/${group.id}`} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Edit</Link>
                                          <Link href={`/doctor/patients/${patient.id}/prescriptions/create?copyFrom=${group.id}&bookingId=${referredBookingId}`} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Copy</Link>
                                          <button type="button" onClick={() => setDeleteRxGroupId(group.id)} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px] !text-error")}>Delete</button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                              {referredBookingId && v.booking.id === referredBookingId && (
                                <Link href={`/doctor/patients/${patient.id}/prescriptions/create?bookingId=${referredBookingId}`} className={buttonStyles("primary", "!min-h-8 !px-sm !text-[13px]")}>New Prescription</Link>
                              )}
                              <p className="pt-sm text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Visit &amp; fee</p>
                              <p className="text-on-surface">
                                {v.booking.visitType === "FollowUp" ? "Follow-up visit" : "New visit"}
                                {v.booking.discount ? ` · ${v.booking.discount} discount` : ""} · ₱{v.booking.totalFee}
                              </p>
                              {referredBookingId === v.booking.id && (
                                <Link href={`/doctor/consultation/${v.booking.id}/vitals`} className="text-label-md text-primary hover:underline">Add vitals</Link>
                              )}
                              {/* //JJQR - AI (Nov 25, 2026) - owner: results belong to ONE consultation — this visit's files + Upload buttons that tag new files to THIS visit */}
                              <p className="pt-sm text-[12px] font-semibold uppercase tracking-[0.04em] text-on-surface-variant">Results &amp; files</p>
                              {filesOf(v.booking.id).length === 0 ? (
                                <p className="text-on-surface-variant">No results or files for this visit yet.</p>
                              ) : (
                                filesOf(v.booking.id).map((f) => (
                                  <div key={f.kind + f.id} className="flex items-center justify-between gap-sm rounded-md border border-outline-variant px-sm py-xs">
                                    <span className="min-w-0">
                                      <span className="block break-words font-semibold text-on-surface">{f.title}</span>
                                      <span className="block text-[12px] text-on-surface-variant">{f.kind === "lab-result" ? "Lab result" : "Document"} · {/* //JJQR - AI (2026-11-25) - owner: upload date in Manila time, not raw UTC */}uploaded {formatUploadedManila(f.uploadedAt, false)}{/* //JJQR - END */}</span>
                                    </span>
                                    <button type="button" onClick={() => openFile(f.kind, f.id)} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Open</button>
                                  </div>
                                ))
                              )}
                              {NO_UPLOAD_STATUSES.has(v.booking.status) ? (
                                <p className="text-on-surface-variant">This visit did not take place, so files cannot be added to it.</p>
                              ) : (
                                <div className="flex flex-wrap gap-xs">
                                  <button type="button" onClick={() => setUploadFor({ bookingId: v.booking.id, date: v.booking.appointmentDate, kind: "lab" })} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Upload result</button>
                                  <button type="button" onClick={() => setUploadFor({ bookingId: v.booking.id, date: v.booking.appointmentDate, kind: "doc" })} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Upload document</button>
                                </div>
                              )}
                              {/* //JJQR - END */}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          {/* //JJQR - AI (Nov 25, 2026) - desktop parity: each file shows the visit it belongs to + Open; uploading is done inside that visit or in the consult's Lab Orders step */}
          {(tab === "labs" || tab === "documents") && !reprintOpen && (
            <p className="mb-sm text-body-sm text-on-surface-variant">
              To add a {tab === "labs" ? "result" : "document"}, open the visit on the Visits tab and press {tab === "labs" ? "Upload result" : "Upload document"}, or upload it from the consultation&apos;s Lab Orders step.
            </p>
          )}
          {tab === "labs" && !reprintOpen && (
            patientLabResults.length === 0 ? (
              <EmptyState icon="science" message="No lab results yet." />
            ) : (
              <div className="space-y-sm">
                {patientLabResults.map((l) => (
                  <div key={l.id} className="flex items-center gap-md rounded-xl border border-outline-variant p-md">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon name="science" className="text-[16px]" />
                    </div>
                    <p className="min-w-0 flex-1 text-body-md text-on-surface">{l.resultTitle}</p>
                    <span className="text-body-sm tabular-nums text-on-surface-variant">Visit {visitDateOf(l.bookingId)}</span>
                    <button type="button" onClick={() => openFile("lab-result", l.id)} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Open</button>
                  </div>
                ))}
              </div>
            )
          )}
          {tab === "documents" && !reprintOpen && (
            patientDocuments.length === 0 ? (
              <EmptyState icon="description" message="No documents yet." />
            ) : (
              <div className="space-y-sm">
                {patientDocuments.map((d) => (
                  <div key={d.id} className="flex items-center gap-md rounded-xl border border-outline-variant p-md">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon name="description" className="text-[16px]" />
                    </div>
                    <p className="min-w-0 flex-1 text-body-md text-on-surface">{d.title}</p>
                    <span className="text-body-sm tabular-nums text-on-surface-variant">Visit {visitDateOf(d.bookingId)}</span>
                    <button type="button" onClick={() => openFile("document", d.id)} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Open</button>
                  </div>
                ))}
              </div>
            )
          )}
          {/* //JJQR - END */}
          {/* //JJQR - AI (Nov 25, 2026) - owner: Reprint view (opened by the left panel's "Reprint" button): every visit with something printable, one button per printout */}
          {reprintOpen && (
            <div className="space-y-md">
              <div className="flex flex-wrap items-start justify-between gap-sm">
                <div>
                  <h2 className="text-headline-sm text-on-surface">Reprint</h2>
                  <p className="text-body-sm text-on-surface-variant">Everything you can print for this patient. Pick what to print.</p>
                </div>
                <button type="button" onClick={() => setReprintOpen(false)} className="text-label-md text-primary hover:underline">← Back to Visits</button>
              </div>
              {/* code review: also say "nothing to reprint" when the visits exist but none has a prescription, lab request or certificate */}
              {(() => {
                const printable = visits.filter((v) => v.rx.length > 0 || reprintInfo[v.booking.id]?.hasLabs || reprintInfo[v.booking.id]?.hasCert);
                if (printable.length === 0 && (reprintChecked || visits.length === 0))
                  return <EmptyState icon="print" message="Nothing to reprint yet. Prescriptions, lab requests and medical certificates from this patient's visits will be listed here." />;
                return (
                <div className="space-y-sm">
                  {printable
                    .map((v) => {
                      const info = reprintInfo[v.booking.id];
                      return (
                        <div key={v.booking.id} className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-outline-variant p-md">
                          <span className="min-w-0">
                            <span className="block text-label-md tabular-nums text-on-surface-variant">{v.booking.appointmentDate}</span>
                            <span className="block text-body-md font-semibold text-on-surface">{v.consult?.chiefComplaint || v.booking.serviceNames.join(", ") || "Consultation"}</span>
                            {v.dx && <span className="block text-body-sm text-on-surface-variant">{v.dx}</span>}
                          </span>
                          <span className="flex flex-wrap gap-xs">
                            {v.rx.map((g, i) => (
                              <button key={g.id} type="button" onClick={() => setPrintPreviewGroup(g)} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>
                                {v.rx.length === 1 ? "Prescription" : `Prescription ${i + 1}`}
                              </button>
                            ))}
                            {info?.hasLabs && <button type="button" disabled={printing} onClick={() => runPrint("lab request", () => printLabOrdersForBooking(v.booking.id))} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Lab request</button>}
                            {info?.hasCert && <button type="button" disabled={printing} onClick={() => runPrint("medical certificate", () => printMedicalCertificateForBooking(v.booking.id))} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Medical certificate</button>}
                          </span>
                        </div>
                      );
                    })}
                  {!reprintChecked && <p className="text-body-sm text-on-surface-variant">Checking lab requests and certificates…</p>}
                </div>
                );
              })()}
            </div>
          )}
          {/* //JJQR - END */}
          {tab === "vaccinations" && !reprintOpen && (
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
      </div>

      <Modal
        isOpen={printPreviewGroup !== null}
        onClose={() => setPrintPreviewGroup(null)}
        title="Print Preview"
        footer={
          <Button
            onClick={async () => {
              if (!printPreviewGroup || !patient) return;
              //JJQR - AI (Oct 31, 2026)
              const supabase = null as never;
              const [clinic, doctor] = await Promise.all([
                queryClinicSettings(supabase),
                queryDoctorById(supabase, printPreviewGroup.doctorId || doctorId),
              ]);
              printPrescription({
                clinic: clinic
                  ? {
                      clinic_name: clinic.clinic_name,
                      address: clinic.address,
                      contact_number: clinic.contact_number,
                    }
                  : { clinic_name: "Grace Medical Clinic", address: "", contact_number: null },
                doctor: {
                  full_name: doctor?.staff_accounts?.full_name ?? "",
                  license_number: doctor?.license_number ?? null,
                  ptr_number: doctor?.ptr_number ?? null,
                  s2_number: doctor?.s2_number ?? null,
                },
                patient: {
                  full_name: patient.fullName,
                  patient_code: patient.patientCode,
                  date_of_birth: patient.dateOfBirth,
                  sex: patient.sex,
                  address: null,
                },
                items: printPreviewGroup.items.map((item) => ({
                  generic_name: item.genericName,
                  dosage: item.dosage,
                  quantity: item.quantity,
                  instruction: item.instruction,
                  meal_relation: item.mealRelation ?? null,
                  timing: item.timing ?? null,
                  //JJQR - AI (Nov 20, 2026)
                  as_needed: asNeededToWire(item.asNeeded),
                  //JJQR - END
                  duration_kind: item.durationKind ?? null,
                  duration_value: item.durationValue ?? null,
                  indication: item.indication ?? null,
                  is_controlled_substance: item.isControlledSubstance,
                  route: item.route ?? null,
                })),
                date: printPreviewGroup.createdAt,
              });
              //JJQR - END
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

      {/* //JJQR - AI (Nov 25, 2026) - upload to the visit whose button was pressed (one or several files) */}
      {uploadFor && (
        <VisitUploadModal
          isOpen
          onClose={() => setUploadFor(null)}
          onUploaded={() => { setExpandedConsultationId(uploadFor.bookingId); reload(); }}
          patientId={patient.id}
          bookingId={uploadFor.bookingId}
          visitDate={uploadFor.date}
          kind={uploadFor.kind}
        />
      )}
      {/* //JJQR - END */}

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
