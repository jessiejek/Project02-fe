"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Toast } from "@/components/ui/Toast";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/ui/Icon";
import { VitalsEditor } from "@/components/doctor/VitalsEditor";
import { PrescriptionForm } from "@/components/doctor/PrescriptionForm";
import { SoapFieldToolbar } from "@/components/doctor/SoapFieldToolbar";
import { cn } from "@/lib/cn";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { queryVitalFieldTemplates } from "@/lib/data/lookups";
import { queryAuditLogs, queryClinicSettings, type ClinicSettingsRow } from "@/lib/data/admin";
import {
  queryConsultationByBooking,
  queryConsultationById,
  queryConsultations,
  queryDiagnoses,
  queryFollowUps,
  querySoapTemplates,
  createSoapTemplate,
  upsertConsultationByBooking,
  replaceDiagnoses,
  upsertFollowUpByConsultation,
  deleteFollowUpByConsultation,
  upsertMedicalCertificateByConsultation,
  writeAuditLog,
} from "@/lib/data/clinical";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryBookingById } from "@/lib/data/bookings";
import { queryPatientById } from "@/lib/data/patients";
import { printMedicalCertificate } from "@/lib/print-forms";
import { one, serviceNames } from "@/lib/one";
import type { Consultation, Diagnosis, SoapTemplate, PrescriptionGroup, VitalFieldTemplate } from "@/data/types";
import type { Database } from "@/data/supabase-types";

type DbLineItem = Database["public"]["Tables"]["prescription_line_items"]["Row"];

interface ConsultationBooking {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  serviceNames: string[];
  totalFee: number;
  // §16.6 — doctor-set fee-line inputs, seeded from the booking row.
  visitType: "New" | "FollowUp";
  discountCategory: "Senior" | "PWD" | "";
  medCertRequested: boolean;
}

interface PatientHistoryEntry {
  id: string;
  appointmentDate: string;
  chiefComplaint: string;
}

function toDiagnosisType(d: Diagnosis) {
  return d.type as "Primary" | "Secondary" | "Differential" | "Comorbidity";
}

const SECTIONS = [
  "SOAP & Chief Complaint",
  "Vital Signs",
  "Diagnosis",
  "Prescription",
  "Lab Orders",
  "Vaccinations",
  "Follow-up",
  "Professional Fee Decision",
];

// Doctor.md §4: sections 1 (Chief Complaint), 2 (BP+HR), 3 (>=1 diagnosis) are
// the only ones gating completion — see "Required fields to complete a
// consultation". Everything else, including Professional Fee Decision, is
// optional/recommended (the code previously also gated on PF Decision, which
// contradicted that explicit section).
const REQUIRED_SECTIONS = [0, 1, 2];

type SectionStatus = "complete" | "warning" | "partial" | "empty";

const STATUS_ICON: Record<SectionStatus, { icon: string; cls: string }> = {
  complete: { icon: "check_circle", cls: "text-green-600" },
  warning: { icon: "warning", cls: "text-amber-500" },
  partial: { icon: "incomplete_circle", cls: "text-blue-500" },
  empty: { icon: "radio_button_unchecked", cls: "text-on-surface-variant" },
};

interface LabOrderDraft {
  testName: string;
  reason: string;
  specimenType: string;
  notes: string;
}
interface VaccinationDraft {
  vaccineName: string;
  doseNumber: string;
  route: string;
  site: string;
  lotNumber: string;
  expiry: string;
  manufacturer: string;
}

const BLANK_LAB: LabOrderDraft = { testName: "", reason: "", specimenType: "", notes: "" };
const BLANK_VAX: VaccinationDraft = { vaccineName: "", doseNumber: "", route: "", site: "", lotNumber: "", expiry: "", manufacturer: "" };

const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl+1 – Ctrl+8", description: "Jump to that numbered section" },
  { keys: "Ctrl+S", description: "Save Draft (or Save Changes in amend mode)" },
  { keys: "Ctrl+Enter", description: "Complete Consultation (when required fields are valid)" },
  { keys: "?", description: "Show this help" },
];

function toLabDraft(items: Consultation["labOrders"]): LabOrderDraft[] {
  return (items ?? []).map((i) => ({ testName: i.testName, reason: i.reason ?? "", specimenType: i.specimenType ?? "", notes: i.notes ?? "" }));
}
function toVaxDraft(items: Consultation["vaccinationsAdministered"]): VaccinationDraft[] {
  return (items ?? []).map((i) => ({
    vaccineName: i.vaccineName,
    doseNumber: i.doseNumber ?? "",
    route: i.route ?? "",
    site: i.site ?? "",
    lotNumber: i.lotNumber ?? "",
    expiry: i.expiry ?? "",
    manufacturer: i.manufacturer ?? "",
  }));
}

function ConsultationWorkflow({ bookingId }: { bookingId: string }) {
  const searchParams = useSearchParams();
  const { session } = useSession();
  const initialMode = (searchParams.get("mode") as "complete" | "view" | "amend") ?? "complete";

  const [loaded, setLoaded] = useState(false);
  const [booking, setBooking] = useState<ConsultationBooking | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  // Doctor.md §4: "View Last Visit SOAP" quick reference — the most recent
  // PRIOR consultation for this SAME patient (excludes this bookingId,
  // matched on patientId so a different patient's record can never surface).
  const [lastVisitSoap, setLastVisitSoap] = useState<Consultation | undefined>(undefined);
  const [lastVisitVitalReadings, setLastVisitVitalReadings] = useState<{ templateId: string; value: string }[]>([]);
  const [patientHistory, setPatientHistory] = useState<PatientHistoryEntry[]>([]);
  const [vitalTemplates, setVitalTemplates] = useState<VitalFieldTemplate[]>([]);
  const [vitalReadings, setVitalReadings] = useState<{ templateId: string; value: string }[]>([]);

  const [mode, setMode] = useState(initialMode);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [amendHistoryOpen, setAmendHistoryOpen] = useState(false);
  const [lastVisitOpen, setLastVisitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [openSection, setOpenSection] = useState(0);
  // Bumped after each in-place prescription save to remount the embedded
  // PrescriptionForm with the freshly-saved group (its own internal state
  // otherwise wouldn't know a save just happened, since it isn't the one
  // navigating anywhere).
  const [rxVersion, setRxVersion] = useState(0);
  const [rxSavedAt, setRxSavedAt] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  // Progress is a floating panel (not a fixed sidebar column) so the
  // accordion itself can use the full page width. Minimized, it collapses to
  // a pill showing whichever section is currently open — e.g. "1/5 SOAP &
  // Chief Complaint" — instead of a generic label.
  const [progressMinimized, setProgressMinimized] = useState(false);

  // Doctor.md view-mode "History" button opens an audit-log drawer of
  // amendments — reads from the real audit_logs table (entity_type
  // 'Consultation'), appended to on every amend save.
  const [amendmentHistory, setAmendmentHistory] = useState<{ timestamp: string; author: string; section: string }[]>([]);

  // "Same ConsultationSummaryComponent" (Doctor.md §4) means view mode must
  // read the full recorded consultation, not just SOAP+diagnoses — this is
  // the record view mode displays, updated in place when amend mode saves.
  const [savedConsultation, setSavedConsultation] = useState<Consultation | undefined>(undefined);

  // Section 1: SOAP
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  // SOAP templates — fills all 5 fields at once, the same speed tooling as
  // Prescriptions' Templates tab, added after a UX review flagged retyping
  // common encounter types by hand as real, recurring friction.
  const [soapTemplates, setSoapTemplates] = useState<SoapTemplate[]>([]);
  const [pendingTemplate, setPendingTemplate] = useState<SoapTemplate | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");

  function doApplyTemplate(template: SoapTemplate) {
    setChiefComplaint(template.chiefComplaint ?? "");
    setSubjective(template.subjective ?? "");
    setObjective(template.objective ?? "");
    setAssessment(template.assessment ?? "");
    setPlan(template.plan ?? "");
    setPendingTemplate(null);
  }

  function applyTemplate(template: SoapTemplate) {
    const hasContent = [chiefComplaint, subjective, objective, assessment, plan].some((f) => f.trim() !== "");
    if (hasContent) {
      setPendingTemplate(template);
    } else {
      doApplyTemplate(template);
    }
  }

  async function saveAsTemplate() {
    if (!newTemplateTitle.trim() || !booking) return;
    const supabase = createClient();
    const data = await createSoapTemplate(supabase, booking.doctorId, {
      title: newTemplateTitle.trim(),
      is_system_template: false,
      chief_complaint: chiefComplaint || null,
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
    });
    setSoapTemplates((prev) => [
      ...prev,
      {
        id: data.id,
        doctorId: data.doctor_id,
        title: data.title,
        isSystemTemplate: data.is_system_template,
        chiefComplaint: data.chief_complaint ?? undefined,
        subjective: data.subjective ?? undefined,
        objective: data.objective ?? undefined,
        assessment: data.assessment ?? undefined,
        plan: data.plan ?? undefined,
      },
    ]);
    setNewTemplateTitle("");
    setSaveTemplateOpen(false);
  }

  // Section 2: Vital Signs — rebuilt per clinic-vitals-fe.md. Vitals are no
  // longer local form state; they live in PatientVitalReading rows (keyed by
  // this bookingId) edited on the standalone Vitals Details page. This
  // section just reads that data for the read-only summary + progress gate —
  // read from the real patient_vital_readings rows (Implementation-Phases/
  // 07-consultations-vitals.md Verification), refreshed after VitalsEditor saves.
  const defaultVitalTemplates = vitalTemplates.filter((t) => t.isDefault);
  const filledVitals: Record<string, string> = Object.fromEntries(
    defaultVitalTemplates.map((t) => [t.formKey, vitalReadings.find((r) => r.templateId === t.id)?.value ?? ""]),
  );
  async function reloadVitalReadings() {
    const supabase = createClient();
    const { data } = await supabase.from("patient_vital_readings").select("template_id, value").eq("booking_id", bookingId);
    setVitalReadings((data ?? []).map((r) => ({ templateId: r.template_id, value: r.value })));
  }

  // Section 3: Diagnosis
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [newDiagnosisText, setNewDiagnosisText] = useState("");

  function addDiagnosis() {
    if (!newDiagnosisText.trim()) return;
    setDiagnoses((prev) => [
      ...prev,
      { code: "—", description: newDiagnosisText.trim(), type: prev.length === 0 ? "Primary" : "Secondary" },
    ]);
    setNewDiagnosisText("");
  }
  function removeDiagnosis(index: number) {
    setDiagnoses((prev) => prev.filter((_, i) => i !== index));
  }
  function makePrimary(index: number) {
    setDiagnoses((prev) =>
      prev.map((d, i) => ({ ...d, type: i === index ? "Primary" : d.type === "Primary" ? "Secondary" : d.type })),
    );
  }

  // Section 4: Prescription — rebuilt per clinic-prescriptions-fe.md. No more
  // local draft state; prescriptions live in PrescriptionGroup (keyed by
  // bookingId), edited on the standalone Prescription Builder page. Real
  // fetch lives in the main load effect below (Phase 8).
  const [prescriptionGroup, setPrescriptionGroup] = useState<PrescriptionGroup | undefined>(undefined);

  // Section 5: Lab Orders — seeded from the existing record. Lab orders have
  // no real table yet (Implementation-Phases/09-lab-orders-vaccinations-documents.md),
  // so this stays local-only, same as before this phase's real-data wiring.
  const [labOrders, setLabOrders] = useState<LabOrderDraft[]>([]);
  const [newLab, setNewLab] = useState<LabOrderDraft>(BLANK_LAB);

  function addLabOrder() {
    if (!newLab.testName.trim()) return;
    setLabOrders((prev) => [...prev, newLab]);
    setNewLab(BLANK_LAB);
  }
  function removeLabOrder(index: number) {
    setLabOrders((prev) => prev.filter((_, i) => i !== index));
  }

  // Section 6: Vaccinations — seeded from the existing record (staged
  // "pending" until Complete Consultation, per Doctor.md §4). Also local-only
  // for the same reason as Lab Orders above — real table is Phase 9's job.
  const [vaccinations, setVaccinations] = useState<VaccinationDraft[]>([]);
  const [newVax, setNewVax] = useState<VaccinationDraft>(BLANK_VAX);

  function addVaccination() {
    if (!newVax.vaccineName.trim()) return;
    setVaccinations((prev) => [...prev, newVax]);
    setNewVax(BLANK_VAX);
  }
  function removeVaccination(index: number) {
    setVaccinations((prev) => prev.filter((_, i) => i !== index));
  }

  // Section 7: Follow-up — seeded from the existing record. follow_ups is a
  // real table (1:1 with consultations), wired for real in this phase.
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [followUpReminder, setFollowUpReminder] = useState(true);

  // Section 8: Professional Fee Decision — seeded from the existing record.
  // Optional for completion (see REQUIRED_SECTIONS above); the tabs' own
  // sub-fields (amount / waive reason) are what's "required" once a tab is chosen.
  // No real table backs this yet, so it stays local-only like Lab Orders/Vaccinations.
  const [pfDecision, setPfDecision] = useState<"charge" | "waive" | null>(null);
  const [pfAmount, setPfAmount] = useState("");
  const [pfWaiveReason, setPfWaiveReason] = useState("");
  // §16.6 — doctor picks the fee line; the backend recomputes the booking total
  // on consultation save. Seeded from the booking row in the load effect.
  const [visitType, setVisitType] = useState<"New" | "FollowUp">("New");
  const [discountCategory, setDiscountCategory] = useState<"Senior" | "PWD" | "">("");
  const [medCertRequested, setMedCertRequested] = useState(false);
  const [feeSchedule, setFeeSchedule] = useState<{
    consultation: number;
    followUp: number;
    seniorPwd: number;
    medCert: number;
  } | null>(null);
  // §16.8 Form 2 — medical certificate issue + print.
  const [clinicRow, setClinicRow] = useState<ClinicSettingsRow | null>(null);
  const [mcExaminedAt, setMcExaminedAt] = useState("");
  const [mcPurposeException, setMcPurposeException] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);

  // §16.6 preview of the flat-line fee the backend will compute on save.
  const previewFee = (() => {
    if (!feeSchedule) return null;
    const subtotal = discountCategory
      ? feeSchedule.seniorPwd
      : visitType === "FollowUp"
        ? feeSchedule.followUp
        : feeSchedule.consultation;
    return subtotal + (medCertRequested ? feeSchedule.medCert : 0);
  })();

  // Single load effect: real booking (joined), consultation + diagnoses +
  // follow_up, last-visit SOAP + its vitals, this booking's own vital
  // readings (for the completion gate), soap_templates, and patient history.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const bookingRow = await queryBookingById(supabase, bookingId);
      if (cancelled) return;
      if (!bookingRow) {
        setLoaded(true);
        return;
      }
      const realBooking: ConsultationBooking = {
        id: bookingRow.booking_id,
        patientId: bookingRow.patient_id,
        doctorId: bookingRow.doctor_id,
        doctorName: bookingRow.doctors?.staff_accounts?.full_name ?? "",
        appointmentDate: bookingRow.appointment_date,
        serviceNames: bookingRow.booking_services.map((s) => s.services?.name ?? "").filter(Boolean),
        totalFee: Number(bookingRow.total_fee),
        visitType: bookingRow.visit_type ?? "New",
        discountCategory: bookingRow.discount_category ?? "",
        medCertRequested: bookingRow.med_cert_requested ?? false,
      };

      const [consultRes, templates, vitalsRes, soapTemplatesRes, patientConsultsRes, rxRes] = await Promise.all([
        queryConsultationByBooking(supabase, bookingId).then((data) => ({ data })),
        queryVitalFieldTemplates(supabase),
        supabase.from("patient_vital_readings").select("template_id, value").eq("booking_id", bookingId),
        querySoapTemplates(supabase, realBooking.doctorId).then((data) => ({ data })),
        queryConsultations(supabase, { patientId: realBooking.patientId }).then((rows) => ({
          data: rows
            .filter((c) => c.booking_id !== bookingId)
            .map((c) => ({
              consultation_id: c.consultation_id,
              booking_id: c.booking_id,
              chief_complaint: c.chief_complaint,
              status: c.status,
              bookings: c.bookings,
            })),
        })),
        supabase.from("prescription_groups").select("*, prescription_line_items(*)").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;

      if (rxRes.data) {
        const g = rxRes.data;
        setPrescriptionGroup({
          id: g.group_id,
          patientId: g.patient_id,
          doctorId: g.doctor_id,
          bookingId: g.booking_id,
          createdAt: g.created_at.slice(0, 10),
          items: (g.prescription_line_items ?? []).map((i: DbLineItem) => ({
            id: i.id,
            rxId: i.medicine_id,
            genericName: i.generic_name,
            dosage: i.dosage,
            quantity: i.quantity,
            instruction: i.instruction ?? "",
            isControlledSubstance: i.is_controlled_substance,
          })),
        });
      }

      setVitalTemplates(
        templates.map((t) => ({ id: t.template_id, description: t.description, formKey: t.form_key, unit: t.unit, icon: t.icon, isDefault: t.is_default })),
      );
      setVitalReadings((vitalsRes.data ?? []).map((r) => ({ templateId: r.template_id, value: r.value })));
      setSoapTemplates(
        (soapTemplatesRes.data ?? []).map((t) => ({
          id: t.id,
          doctorId: t.doctor_id,
          title: t.title,
          isSystemTemplate: t.is_system_template,
          chiefComplaint: t.chief_complaint ?? undefined,
          subjective: t.subjective ?? undefined,
          objective: t.objective ?? undefined,
          assessment: t.assessment ?? undefined,
          plan: t.plan ?? undefined,
        })),
      );

      const patientConsults = (patientConsultsRes.data ?? [])
        .map((c) => {
          const b = Array.isArray(c.bookings) ? c.bookings[0] : c.bookings;
          return { consultationId: c.consultation_id, bookingId: c.booking_id, chiefComplaint: c.chief_complaint ?? "", appointmentDate: b?.appointment_date ?? "" };
        })
        .filter((c) => c.appointmentDate)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      setPatientHistory(patientConsults.map((c) => ({ id: c.consultationId, appointmentDate: c.appointmentDate, chiefComplaint: c.chiefComplaint })));

      const prior = patientConsults[0];
      if (prior) {
        const [priorRes, priorReadingsRes] = await Promise.all([
          queryConsultationById(supabase, prior.consultationId).then((data) => ({ data })),
          supabase.from("patient_vital_readings").select("template_id, value").eq("booking_id", prior.bookingId),
        ]);
        if (priorRes.data) {
          setLastVisitSoap({
            id: priorRes.data.consultation_id,
            bookingId: priorRes.data.booking_id,
            patientId: priorRes.data.patient_id,
            doctorName: realBooking.doctorName,
            appointmentDate: prior.appointmentDate,
            chiefComplaint: priorRes.data.chief_complaint ?? "",
            subjective: priorRes.data.subjective ?? "",
            objective: priorRes.data.objective ?? "",
            assessment: priorRes.data.assessment ?? "",
            plan: priorRes.data.plan ?? "",
            diagnoses: [],
          });
        }
        setLastVisitVitalReadings((priorReadingsRes.data ?? []).map((r) => ({ templateId: r.template_id, value: r.value })));
      }

      let loadedConsultation: Consultation | undefined;
      if (consultRes.data) {
        setConsultationId(consultRes.data.consultation_id);
        const [diagRes, followRes] = await Promise.all([
          queryDiagnoses(supabase, consultRes.data.consultation_id).then((data) => ({ data })),
          queryFollowUps(supabase, { consultationId: consultRes.data.consultation_id }).then((rows) => ({ data: rows[0] ?? null })),
        ]);
        const diagnosesLoaded: Diagnosis[] = (diagRes.data ?? []).map((d) => ({
          code: d.icd10_code ?? "—",
          description: d.custom_description ?? "",
          type: d.type as Diagnosis["type"],
        }));
        loadedConsultation = {
          id: consultRes.data.consultation_id,
          bookingId,
          patientId: consultRes.data.patient_id,
          doctorName: realBooking.doctorName,
          appointmentDate: realBooking.appointmentDate,
          chiefComplaint: consultRes.data.chief_complaint ?? "",
          subjective: consultRes.data.subjective ?? "",
          objective: consultRes.data.objective ?? "",
          assessment: consultRes.data.assessment ?? "",
          plan: consultRes.data.plan ?? "",
          diagnoses: diagnosesLoaded,
          followUpDate: followRes.data?.follow_up_date ?? undefined,
          followUpReason: followRes.data?.reason ?? undefined,
          followUpInstructions: followRes.data?.instructions ?? undefined,
          followUpReminder: followRes.data?.reminder_enabled ?? true,
        };
        if (consultRes.data.status === "Completed" || consultRes.data.status === "Amended") {
          const logs = await queryAuditLogs(supabase, {
            entityType: "Consultation",
            entityId: consultRes.data.consultation_id,
          });
          setAmendmentHistory(
            logs.map((l) => ({
              timestamp: new Date(l.performed_at).toLocaleString(),
              author: realBooking.doctorName,
              section: l.details ?? "Consultation record",
            })),
          );
        }
      }

      setBooking(realBooking);
      setSavedConsultation(loadedConsultation);
      setPfAmount(String(realBooking.totalFee || ""));
      setVisitType(realBooking.visitType);
      setDiscountCategory(realBooking.discountCategory);
      setMedCertRequested(realBooking.medCertRequested);
      queryClinicSettings(supabase)
        .then((s) => {
          if (!cancelled && s) {
            setClinicRow(s);
            setFeeSchedule({
              consultation: s.fee_consultation,
              followUp: s.fee_follow_up,
              seniorPwd: s.fee_senior_pwd,
              medCert: s.fee_med_cert,
            });
          }
        })
        .catch(() => {});
      if (loadedConsultation) {
        setChiefComplaint(loadedConsultation.chiefComplaint);
        setSubjective(loadedConsultation.subjective);
        setObjective(loadedConsultation.objective);
        setAssessment(loadedConsultation.assessment);
        setPlan(loadedConsultation.plan);
        setDiagnoses(loadedConsultation.diagnoses);
        setFollowUpDate(loadedConsultation.followUpDate ?? "");
        setFollowUpReason(loadedConsultation.followUpReason ?? "");
        setFollowUpInstructions(loadedConsultation.followUpInstructions ?? "");
        setFollowUpReminder(loadedConsultation.followUpReminder ?? true);
      }
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // Doctor.md requires BP + HR when those templates exist; never read hardcoded
  // Record keys that may be missing before templates load (or if form_key differs).
  const requiredVitalTemplates = defaultVitalTemplates.filter(
    (t) => t.formKey === "blood_pressure" || t.formKey === "pulse_rate",
  );
  const vitalsSatisfied =
    requiredVitalTemplates.length > 0
      ? requiredVitalTemplates.every((t) => (filledVitals[t.formKey] ?? "").trim() !== "")
      : defaultVitalTemplates.length > 0 &&
        defaultVitalTemplates.every((t) => (filledVitals[t.formKey] ?? "").trim() !== "");
  const sectionSatisfied = [
    chiefComplaint.trim() !== "",
    vitalsSatisfied,
    diagnoses.length > 0,
    (prescriptionGroup?.items.length ?? 0) > 0,
    labOrders.length > 0,
    vaccinations.length > 0,
    followUpDate.trim() !== "",
    pfDecision !== null && (pfDecision === "charge" ? pfAmount.trim() !== "" : pfWaiveReason.trim().length >= 5),
  ];
  const sectionHasDraft = [
    false,
    false,
    false,
    false,
    newLab.testName.trim() !== "",
    newVax.vaccineName.trim() !== "",
    followUpReason.trim() !== "" || followUpInstructions.trim() !== "",
    pfDecision !== null,
  ];
  function sectionStatus(i: number): SectionStatus {
    if (sectionSatisfied[i]) return "complete";
    if (REQUIRED_SECTIONS.includes(i)) return "warning";
    return sectionHasDraft[i] ? "partial" : "empty";
  }

  // Sections with a fixed set of fields (SOAP, Vital Signs, Follow-up) show a
  // live "filled/total" count while in progress instead of a static icon —
  // list-based sections (Diagnosis/Prescription/Lab/Vaccinations/PF Decision)
  // keep the plain icon status since they don't have a fixed field count.
  const FRACTION_FIELDS: Partial<Record<number, string[]>> = {
    0: [chiefComplaint, subjective, objective, assessment, plan],
    1: defaultVitalTemplates.map((t) => filledVitals[t.formKey] ?? ""),
    6: [followUpDate, followUpReason, followUpInstructions],
  };

  function renderSectionIndicator(i: number, className: string) {
    const fields = FRACTION_FIELDS[i];
    if (fields) {
      const filled = fields.filter((f) => (f ?? "").trim() !== "").length;
      if (filled === 0) {
        const required = REQUIRED_SECTIONS.includes(i);
        return <Icon name={required ? "warning" : "radio_button_unchecked"} className={cn(className, required ? "text-amber-500" : "text-on-surface-variant")} />;
      }
      if (filled === fields.length) {
        return <Icon name="check_circle" className={cn(className, "text-green-600")} />;
      }
      return (
        <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 px-xs font-bold text-blue-700", className)}>
          {filled}/{fields.length}
        </span>
      );
    }
    const status = sectionStatus(i);
    return <Icon name={STATUS_ICON[status].icon} className={cn(className, STATUS_ICON[status].cls)} />;
  }

  // What the minimized floating Progress pill shows — the section currently
  // open (i.e. whichever one you're working in), as "1/5 SOAP & Chief
  // Complaint" for fraction-tracked sections, or just its name otherwise.
  function currentSectionLabel(): string {
    if (openSection < 0) return "Progress";
    const fields = FRACTION_FIELDS[openSection];
    const name = SECTIONS[openSection];
    if (fields) {
      const filled = fields.filter((f) => (f ?? "").trim() !== "").length;
      return `${filled}/${fields.length} ${name}`;
    }
    return name;
  }

  // Doctor.md's "Required fields to complete a consultation" section is
  // explicit: Chief Complaint, >=1 diagnosis, BP, HR — "everything else
  // (...PF decision) is optional/recommended." This previously also gated on
  // Professional Fee Decision, contradicting that section outright.
  const canComplete = sectionSatisfied[0] && sectionSatisfied[1] && sectionSatisfied[2];

  function buildConsultationRecord(): Consultation {
    return {
      id: consultationId ?? `c${Date.now()}`,
      bookingId,
      patientId: booking!.patientId,
      doctorName: booking!.doctorName,
      appointmentDate: booking!.appointmentDate,
      chiefComplaint,
      subjective,
      objective,
      assessment,
      plan,
      diagnoses,
      labOrders,
      vaccinationsAdministered: vaccinations,
      feeDecision:
        pfDecision === "charge"
          ? { type: "Charge", amount: Number(pfAmount) || 0 }
          : pfDecision === "waive"
            ? { type: "Waive", waiveReason: pfWaiveReason }
            : undefined,
      followUpDate: followUpDate || undefined,
      followUpReason: followUpReason || undefined,
      followUpInstructions: followUpInstructions || undefined,
      followUpReminder,
    };
  }

  // Shared write path for Save Draft / Complete Consultation / Save Changes
  // (amend) — upserts the consultations row keyed on booking_id, then
  // delete-reinserts consultation_diagnoses (matches the UI's own
  // add/remove/mark-primary array semantics) and upserts/clears follow_ups
  // (Implementation-Phases/07-consultations-vitals.md §7a/7b/7d).
  async function persistConsultation(status: "Draft" | "Completed" | "Amended"): Promise<string | null> {
    if (!booking) return null;
    const supabase = createClient();

    let saved;
    try {
      saved = await upsertConsultationByBooking(supabase, bookingId, {
        patient_id: booking.patientId,
        doctor_id: booking.doctorId,
        status,
        chief_complaint: chiefComplaint || null,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        // §16.6 — backend recomputes total_fee / amount_due from these.
        visit_type: visitType,
        med_cert_requested: medCertRequested,
        discount_category: discountCategory || null,
      });
    } catch {
      return null;
    }
    const savedId = saved.consultation_id;
    setConsultationId(savedId);

    await replaceDiagnoses(
      supabase,
      savedId,
      diagnoses.map((d) => ({ icd10_code: null, custom_description: d.description, type: toDiagnosisType(d) })),
    );

    if (followUpDate) {
      await upsertFollowUpByConsultation(supabase, savedId, {
        patient_id: booking.patientId,
        doctor_id: booking.doctorId,
        follow_up_date: followUpDate,
        reason: followUpReason || null,
        instructions: followUpInstructions || null,
        reminder_enabled: followUpReminder,
        status: "Pending",
      });
    } else {
      await deleteFollowUpByConsultation(supabase, savedId);
    }

    return savedId;
  }

  async function handleSaveDraft() {
    await persistConsultation("Draft");
    setDraftSavedAt(new Date().toLocaleTimeString());
  }

  async function handleComplete() {
    await persistConsultation("Completed");
    setSavedConsultation(buildConsultationRecord());
    setChecklistOpen(false);
    setJustCompleted(true);
  }

  // §16.8 Form 2 — save the certificate row (upsert on consultation) then print
  // it on the shared clinic letterhead. Requires a saved consultation.
  async function handleIssueMedCert() {
    if (!booking || !clinicRow) return;
    setIssuingCert(true);
    const supabase = createClient();
    try {
      const consultId = consultationId ?? (await persistConsultation("Draft"));
      if (!consultId) return;
      const today = new Date().toISOString().slice(0, 10);
      const cert = {
        patient_id: booking.patientId,
        doctor_id: booking.doctorId,
        issue_date: today,
        examined_at: mcExaminedAt || clinicRow.clinic_name,
        examination_date_from: today,
        examination_date_to: today,
        diagnosis_text: assessment || null,
        recommendations: plan || null,
        purpose_exception: mcPurposeException || null,
        come_back_on: followUpDate || null,
      };
      await upsertMedicalCertificateByConsultation(supabase, consultId, cert);
      const [doc, pat] = await Promise.all([
        queryDoctorById(supabase, booking.doctorId),
        queryPatientById(supabase, booking.patientId),
      ]);
      printMedicalCertificate({
        clinic: {
          clinic_name: clinicRow.clinic_name,
          address: clinicRow.address,
          contact_number: clinicRow.contact_number,
        },
        doctor: {
          full_name: booking.doctorName || (doc?.staff_accounts?.full_name ?? ""),
          license_number: doc?.license_number ?? null,
          ptr_number: doc?.ptr_number ?? null,
        },
        patient: {
          full_name: pat ? `${pat.first_name} ${pat.last_name}`.trim() : "",
          patient_code: pat?.patient_code,
          date_of_birth: pat?.date_of_birth ?? null,
          sex: pat?.sex ?? null,
          address: pat?.address ?? null,
        },
        cert,
      });
    } finally {
      setIssuingCert(false);
    }
  }

  function currentFormSnapshot() {
    return JSON.stringify({
      chiefComplaint, subjective, objective, assessment, plan,
      diagnoses, labOrders, vaccinations,
      followUpDate, followUpReason, followUpInstructions, followUpReminder,
      pfDecision, pfAmount, pfWaiveReason,
    });
  }
  const [amendSnapshot, setAmendSnapshot] = useState<string | null>(null);
  const isDirty = mode === "amend" && amendSnapshot !== null && currentFormSnapshot() !== amendSnapshot;

  function enterAmendMode() {
    setAmendSnapshot(currentFormSnapshot());
    setMode("amend");
  }

  function resetFormFields(source: Consultation | undefined) {
    setChiefComplaint(source?.chiefComplaint ?? "");
    setSubjective(source?.subjective ?? "");
    setObjective(source?.objective ?? "");
    setAssessment(source?.assessment ?? "");
    setPlan(source?.plan ?? "");
    setDiagnoses(source?.diagnoses ?? []);
    setLabOrders(toLabDraft(source?.labOrders));
    setVaccinations(toVaxDraft(source?.vaccinationsAdministered));
    setFollowUpDate(source?.followUpDate ?? "");
    setFollowUpReason(source?.followUpReason ?? "");
    setFollowUpInstructions(source?.followUpInstructions ?? "");
    setFollowUpReminder(source?.followUpReminder ?? true);
    setPfDecision(source?.feeDecision ? (source.feeDecision.type === "Charge" ? "charge" : "waive") : null);
    setPfAmount(String(source?.feeDecision?.amount ?? booking?.totalFee ?? ""));
    setPfWaiveReason(source?.feeDecision?.waiveReason ?? "");
  }

  function finishCancelAmend() {
    resetFormFields(savedConsultation);
    setAmendSnapshot(null);
    setMode("view");
  }

  function requestCancelAmend() {
    if (isDirty) setDiscardConfirmOpen(true);
    else finishCancelAmend();
  }

  async function handleSaveChanges() {
    if (!canComplete || !booking) return;
    const savedId = await persistConsultation("Amended");
    if (!savedId) return;
    const supabase = createClient();
    const details = "Consultation record";
    await writeAuditLog(supabase, {
      entity_type: "Consultation",
      entity_id: savedId,
      action: "Amended",
      details,
    });
    setSavedConsultation(buildConsultationRecord());
    setAmendmentHistory((prev) => [
      { timestamp: new Date().toLocaleString(), author: booking.doctorName, section: details },
      ...prev,
    ]);
    setAmendSnapshot(null);
    setMode("view");
  }

  // Doctor.md §4: Ctrl+1..8 jump, Ctrl+S save, Ctrl+Enter complete, `?` help.
  useEffect(() => {
    if (mode === "view") return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable = !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && /^[1-8]$/.test(e.key)) {
        e.preventDefault();
        setOpenSection(Number(e.key) - 1);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (mode === "complete") handleSaveDraft();
        else handleSaveChanges();
      } else if (mod && e.key === "Enter") {
        e.preventDefault();
        if (mode === "complete" && canComplete) setChecklistOpen(true);
      } else if (e.key === "?" && !isEditable) {
        e.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, canComplete]);

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <p className="text-body-md text-on-surface-variant">Loading…</p>
      </AppShell>
    );
  }
  if (!booking) notFound();

  if (justCompleted) {
    return (
      <AppShell role="doctor">
        <div className="mx-auto max-w-[40rem] space-y-lg">
          <div className="flex flex-col gap-sm rounded-lg bg-green-50 px-md py-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-sm text-label-md">
              <Icon name="check_circle" />
              Consultation saved
            </span>
            <div className="flex flex-col gap-sm sm:flex-row">
              <Link href="/doctor/dashboard">
                <Button variant="secondary" className="w-full sm:w-auto">Back to Queue</Button>
              </Link>
              <Link href="/doctor/dashboard">
                <Button className="w-full sm:w-auto">Next Patient →</Button>
              </Link>
            </div>
          </div>
          <Card className="space-y-sm text-body-md text-on-surface-variant">
            <p><strong>Chief Complaint:</strong> {chiefComplaint}</p>
            <p><strong>Diagnoses:</strong> {diagnoses.map((d) => d.description).join(", ")}</p>
            <p>
              <strong>Professional Fee:</strong>{" "}
              {pfDecision === "waive" ? `Waived (${pfWaiveReason})` : pfDecision === "charge" ? `₱${pfAmount}` : "Not yet decided"}
            </p>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (mode === "view") {
    const sc = savedConsultation;
    return (
      <AppShell role="doctor">
        <div className="mx-auto max-w-[40rem] space-y-lg">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <p className="text-label-md text-on-surface-variant">
              Completed {booking.appointmentDate} by {booking.doctorName}
            </p>
            <div className="flex flex-wrap gap-sm">
              <Button variant="secondary" onClick={() => setAmendHistoryOpen(true)}>
                History
              </Button>
              <Button onClick={enterAmendMode}>Edit Consultation</Button>
            </div>
          </div>
          {sc && (
            <>
              <Card className="space-y-sm text-body-md text-on-surface-variant">
                <p><strong>Chief Complaint:</strong> {sc.chiefComplaint}</p>
                <p><strong>Subjective:</strong> {sc.subjective}</p>
                <p><strong>Objective:</strong> {sc.objective}</p>
                <p><strong>Assessment:</strong> {sc.assessment}</p>
                <p><strong>Plan:</strong> {sc.plan}</p>
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Vital Signs</h4>
                <p className="text-body-md text-on-surface-variant">
                  {vitalReadings.length > 0
                    ? defaultVitalTemplates.map((t) => `${t.description} ${filledVitals[t.formKey] || "—"}${t.unit ? ` ${t.unit}` : ""}`).join(" · ")
                    : "No vitals recorded."}
                </p>
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Diagnoses</h4>
                <p className="text-body-md text-on-surface-variant">
                  {sc.diagnoses.length > 0 ? sc.diagnoses.map((d) => `${d.description} (${d.type})`).join(", ") : "None recorded."}
                </p>
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Prescriptions</h4>
                {prescriptionGroup && prescriptionGroup.items.length > 0 ? (
                  <div className="space-y-xs">
                    {prescriptionGroup.items.map((rx, i) => (
                      <p key={rx.id} className="text-body-md text-on-surface-variant">
                        {i + 1}. {rx.genericName} #{rx.quantity} — Sig. {rx.dosage} {rx.instruction}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">None prescribed.</p>
                )}
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Lab Orders</h4>
                {sc.labOrders && sc.labOrders.length > 0 ? (
                  <div className="space-y-xs">
                    {sc.labOrders.map((lab, i) => (
                      <p key={i} className="text-body-md text-on-surface-variant">
                        {lab.testName} — {lab.reason}{lab.specimenType ? ` (${lab.specimenType})` : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">None ordered.</p>
                )}
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Vaccinations</h4>
                {sc.vaccinationsAdministered && sc.vaccinationsAdministered.length > 0 ? (
                  <div className="space-y-xs">
                    {sc.vaccinationsAdministered.map((v, i) => (
                      <p key={i} className="text-body-md text-on-surface-variant">
                        {v.vaccineName} — Dose #{v.doseNumber}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">None administered.</p>
                )}
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Follow-up</h4>
                <p className="text-body-md text-on-surface-variant">
                  {sc.followUpDate ? `${sc.followUpDate} — ${sc.followUpReason ?? ""}${sc.followUpInstructions ? ` (${sc.followUpInstructions})` : ""}${sc.followUpReminder ? " · reminder on" : ""}` : "No follow-up scheduled."}
                </p>
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Professional Fee</h4>
                <p className="text-body-md text-on-surface-variant">
                  {sc.feeDecision?.type === "Waive"
                    ? `Waived — ${sc.feeDecision.waiveReason ?? ""}`
                    : sc.feeDecision?.type === "Charge"
                      ? `₱${sc.feeDecision.amount}`
                      : "Not recorded."}
                </p>
              </Card>
            </>
          )}
        </div>

        <Drawer isOpen={amendHistoryOpen} onClose={() => setAmendHistoryOpen(false)} title="Amendment History">
          {amendmentHistory.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No amendments have been made to this record.</p>
          ) : (
            <div className="space-y-md">
              {amendmentHistory.map((entry, i) => (
                <div key={i} className="rounded-lg border border-outline-variant p-md text-body-md text-on-surface-variant">
                  <p><strong>{entry.timestamp}</strong> — {entry.author}</p>
                  <p>Changed: {entry.section}</p>
                </div>
              ))}
            </div>
          )}
        </Drawer>
      </AppShell>
    );
  }

  // mode === "complete" | "amend"
  return (
    <AppShell role="doctor">
      <div className="space-y-lg">
        {mode === "amend" && (
          <Toast variant="warning" message="Manual save only — autosave is off in amend mode." dismissible={false} />
        )}
        {draftSavedAt && mode === "complete" && (
          <Toast key={draftSavedAt} variant="success" message={`Draft saved at ${draftSavedAt}.`} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-md">
          <h1 className="text-headline-md text-on-surface">Consultation — {booking.serviceNames.join(", ")}</h1>
          <div className="flex flex-wrap gap-sm">
            <Button variant="secondary" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts help">
              <Icon name="help" className="text-[18px]" />
            </Button>
            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
              View Patient History
            </Button>
            {mode === "complete" ? (
              <>
                <Button variant="secondary" onClick={handleSaveDraft}>Save Draft</Button>
                <Button disabled={!canComplete} onClick={() => setChecklistOpen(true)}>
                  Complete Consultation
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={requestCancelAmend}>
                  Cancel
                </Button>
                <Button disabled={!canComplete} onClick={handleSaveChanges}>Save Changes</Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-md">
            {SECTIONS.map((section, i) => {
              const isOpen = openSection === i;
              return (
                <Card key={section}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(isOpen ? -1 : i)}
                    className="-m-lg flex w-[calc(100%+2*var(--spacing-lg))] cursor-pointer items-center justify-between rounded-xl p-lg text-left transition-colors hover:bg-surface-container-low"
                  >
                    <h3 className="flex items-center gap-sm text-headline-sm text-on-surface">
                      {renderSectionIndicator(i, "text-[18px]")}
                      {i + 1}. {section}
                    </h3>
                    <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
                  </button>

                  {isOpen && i === 0 && (
                    <div className="mt-md space-y-md">
                      <div className="flex flex-wrap items-center justify-between gap-sm">
                        {lastVisitSoap && (
                          <button
                            type="button"
                            onClick={() => setLastVisitOpen(true)}
                            className="text-label-md text-primary hover:underline"
                          >
                            View Last Visit SOAP
                          </button>
                        )}
                        <div className="ml-auto flex items-center gap-md">
                          {soapTemplates.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const t = soapTemplates.find((x) => x.id === e.target.value);
                                if (t) applyTemplate(t);
                              }}
                              aria-label="Use SOAP template"
                              className="rounded-lg border border-outline-variant px-sm py-xs text-label-sm"
                            >
                              <option value="">Use Template…</option>
                              {soapTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title}
                                  {t.isSystemTemplate ? " (system)" : ""}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => setSaveTemplateOpen(true)}
                            className="text-label-sm text-primary hover:underline"
                          >
                            Save as Template
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="mb-xs flex items-center justify-between">
                          <span className="text-label-sm text-on-surface-variant">Chief Complaint*</span>
                          <SoapFieldToolbar doctorId={booking.doctorId} field="chiefComplaint" fieldLabel="Chief Complaint" value={chiefComplaint} onInsert={setChiefComplaint} />
                        </div>
                        <textarea placeholder="Chief Complaint*" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
                      </div>
                      <div>
                        <div className="mb-xs flex items-center justify-between">
                          <span className="text-label-sm text-on-surface-variant">Subjective</span>
                          <SoapFieldToolbar doctorId={booking.doctorId} field="subjective" fieldLabel="Subjective" value={subjective} onInsert={setSubjective} />
                        </div>
                        <textarea placeholder="Subjective" value={subjective} onChange={(e) => setSubjective(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
                      </div>
                      <div>
                        <div className="mb-xs flex items-center justify-between">
                          <span className="text-label-sm text-on-surface-variant">Objective</span>
                          <SoapFieldToolbar doctorId={booking.doctorId} field="objective" fieldLabel="Objective" value={objective} onInsert={setObjective} />
                        </div>
                        <textarea placeholder="Objective" value={objective} onChange={(e) => setObjective(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
                      </div>
                      <div>
                        <div className="mb-xs flex items-center justify-between">
                          <span className="text-label-sm text-on-surface-variant">Assessment</span>
                          <SoapFieldToolbar doctorId={booking.doctorId} field="assessment" fieldLabel="Assessment" value={assessment} onInsert={setAssessment} />
                        </div>
                        <textarea placeholder="Assessment" value={assessment} onChange={(e) => setAssessment(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
                      </div>
                      <div>
                        <div className="mb-xs flex items-center justify-between">
                          <span className="text-label-sm text-on-surface-variant">Plan</span>
                          <SoapFieldToolbar doctorId={booking.doctorId} field="plan" fieldLabel="Plan" value={plan} onInsert={setPlan} />
                        </div>
                        <textarea placeholder="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
                      </div>
                    </div>
                  )}

                  {isOpen && i === 1 && (
                    <div className="mt-md space-y-md">
                      {lastVisitVitalReadings.length > 0 && (
                        <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-sm text-on-surface-variant">
                          Last visit ({lastVisitSoap!.appointmentDate}):{" "}
                          {defaultVitalTemplates
                            .map((t) => `${t.description} ${lastVisitVitalReadings.find((r) => r.templateId === t.id)?.value ?? "—"}${t.unit ? ` ${t.unit}` : ""}`)
                            .join(" · ")}
                        </p>
                      )}
                      <VitalsEditor bookingId={bookingId} patientId={booking.patientId} onSaved={reloadVitalReadings} />
                    </div>
                  )}

                  {isOpen && i === 2 && (
                    <div className="mt-md space-y-md">
                      <div className="space-y-sm">
                        {diagnoses.map((d, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-lg border border-outline-variant p-md">
                            <span className="text-body-md">
                              {d.description} <span className="text-label-sm text-on-surface-variant">({d.type})</span>
                            </span>
                            <div className="flex items-center gap-sm">
                              {d.type !== "Primary" && (
                                <button type="button" onClick={() => makePrimary(idx)} className="text-label-sm text-primary hover:underline">
                                  Mark Primary
                                </button>
                              )}
                              <button type="button" onClick={() => removeDiagnosis(idx)} className="text-on-surface-variant">
                                <Icon name="close" className="text-[18px]" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {diagnoses.length === 0 && <p className="text-label-md text-on-surface-variant">No diagnoses added yet — at least 1 required.</p>}
                      </div>
                      <div className="flex gap-sm">
                        <input
                          placeholder="Diagnosis / ICD-10 description*"
                          value={newDiagnosisText}
                          onChange={(e) => setNewDiagnosisText(e.target.value)}
                          className="flex-1 rounded-lg border border-outline-variant px-md py-sm"
                        />
                        <Button variant="secondary" onClick={addDiagnosis}>Add</Button>
                      </div>
                    </div>
                  )}

                  {isOpen && i === 3 && (
                    <div className="mt-md space-y-md">
                      {rxSavedAt && <Toast key={rxSavedAt} variant="success" message={`Prescription saved at ${rxSavedAt}.`} />}
                      <PrescriptionForm
                        key={rxVersion}
                        mode={prescriptionGroup ? "edit" : "create"}
                        patientId={booking.patientId}
                        doctorId={booking.doctorId}
                        bookingId={bookingId}
                        group={prescriptionGroup}
                        embedded
                        onSaved={async () => {
                          const supabase = createClient();
                          const { data: g } = await supabase
                            .from("prescription_groups")
                            .select("*, prescription_line_items(*)")
                            .eq("booking_id", bookingId)
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle();
                          if (g) {
                            setPrescriptionGroup({
                              id: g.group_id,
                              patientId: g.patient_id,
                              doctorId: g.doctor_id,
                              bookingId: g.booking_id,
                              createdAt: g.created_at.slice(0, 10),
                              items: (g.prescription_line_items ?? []).map((i: DbLineItem) => ({
                                id: i.id,
                                rxId: i.medicine_id,
                                genericName: i.generic_name,
                                dosage: i.dosage,
                                quantity: i.quantity,
                                instruction: i.instruction ?? "",
                                isControlledSubstance: i.is_controlled_substance,
                              })),
                            });
                          }
                          setRxVersion((v) => v + 1);
                          setRxSavedAt(new Date().toLocaleTimeString());
                        }}
                      />
                    </div>
                  )}

                  {isOpen && i === 4 && (
                    <div className="mt-md space-y-md">
                      <div className="space-y-sm">
                        {labOrders.map((lab, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-lg border border-outline-variant p-md">
                            <span className="text-body-md">
                              {lab.testName} — {lab.reason}{lab.specimenType ? ` (${lab.specimenType})` : ""}
                            </span>
                            <button type="button" onClick={() => removeLabOrder(idx)} className="text-on-surface-variant">
                              <Icon name="close" className="text-[18px]" />
                            </button>
                          </div>
                        ))}
                        {labOrders.length === 0 && <p className="text-label-md text-on-surface-variant">No lab orders added (optional).</p>}
                      </div>
                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                        <input placeholder="Test Name" value={newLab.testName} onChange={(e) => setNewLab({ ...newLab, testName: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Reason / Clinical Indication" value={newLab.reason} onChange={(e) => setNewLab({ ...newLab, reason: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Specimen Type" value={newLab.specimenType} onChange={(e) => setNewLab({ ...newLab, specimenType: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Notes" value={newLab.notes} onChange={(e) => setNewLab({ ...newLab, notes: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                      </div>
                      <Button variant="secondary" onClick={addLabOrder}>Add Lab Order</Button>
                    </div>
                  )}

                  {isOpen && i === 5 && (
                    <div className="mt-md space-y-md">
                      <div className="space-y-sm">
                        {vaccinations.map((v, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-lg border border-outline-variant p-md">
                            <span className="text-body-md">
                              {v.vaccineName} — Dose #{v.doseNumber}
                              {v.route ? ` · ${v.route}` : ""}{v.site ? ` · ${v.site}` : ""}{v.lotNumber ? ` · Lot ${v.lotNumber}` : ""}
                            </span>
                            <button type="button" onClick={() => removeVaccination(idx)} className="text-on-surface-variant">
                              <Icon name="close" className="text-[18px]" />
                            </button>
                          </div>
                        ))}
                        {vaccinations.length === 0 && <p className="text-label-md text-on-surface-variant">No vaccinations staged (optional).</p>}
                      </div>
                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
                        <input placeholder="Vaccine Name" value={newVax.vaccineName} onChange={(e) => setNewVax({ ...newVax, vaccineName: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Dose #" value={newVax.doseNumber} onChange={(e) => setNewVax({ ...newVax, doseNumber: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Route" value={newVax.route} onChange={(e) => setNewVax({ ...newVax, route: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Site" value={newVax.site} onChange={(e) => setNewVax({ ...newVax, site: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Lot #" value={newVax.lotNumber} onChange={(e) => setNewVax({ ...newVax, lotNumber: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <DatePicker placeholder="Expiry" value={newVax.expiry} onChange={(expiry) => setNewVax({ ...newVax, expiry })} />
                        <input placeholder="Manufacturer" value={newVax.manufacturer} onChange={(e) => setNewVax({ ...newVax, manufacturer: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                      </div>
                      <Button variant="secondary" onClick={addVaccination}>Stage Vaccination</Button>
                      <p className="text-label-sm text-on-surface-variant">Saved on Complete Consultation, per Doctor.md §4.</p>
                    </div>
                  )}

                  {isOpen && i === 6 && (
                    <div className="mt-md space-y-md">
                      <DatePicker value={followUpDate} onChange={setFollowUpDate} />
                      <input placeholder="Reason" value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
                      <textarea placeholder="Instructions" value={followUpInstructions} onChange={(e) => setFollowUpInstructions(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
                      <label className="flex items-center gap-sm text-body-md text-on-surface-variant">
                        <input type="checkbox" checked={followUpReminder} onChange={(e) => setFollowUpReminder(e.target.checked)} className="h-5 w-5" />
                        Send reminder
                      </label>
                    </div>
                  )}

                  {isOpen && i === 7 && (
                    <div className="mt-md space-y-md">
                      {/* §16.6 — fee line the doctor selects; backend recomputes the booking total on save. */}
                      <div className="space-y-sm rounded-lg bg-surface-container-low p-md">
                        <div className="flex flex-wrap items-center gap-sm">
                          <span className="text-label-md text-on-surface-variant">Visit type</span>
                          {(["New", "FollowUp"] as const).map((vt) => (
                            <button
                              key={vt}
                              type="button"
                              onClick={() => setVisitType(vt)}
                              className={cn(
                                "rounded-full border px-md py-xs text-label-md",
                                visitType === vt
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-outline-variant text-on-surface-variant",
                              )}
                            >
                              {vt === "New" ? "New" : "Follow-up"}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-sm">
                          <span className="text-label-md text-on-surface-variant">Discount</span>
                          <select
                            value={discountCategory}
                            onChange={(e) => setDiscountCategory(e.target.value as "Senior" | "PWD" | "")}
                            className="rounded-lg border border-outline-variant px-md py-xs text-label-md"
                          >
                            <option value="">None</option>
                            <option value="Senior">Senior citizen</option>
                            <option value="PWD">PWD</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-sm text-body-md text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={medCertRequested}
                            onChange={(e) => setMedCertRequested(e.target.checked)}
                            className="h-5 w-5"
                          />
                          Medical certificate requested
                        </label>
                        {medCertRequested && (
                          <div className="space-y-sm rounded-lg border border-outline-variant p-md">
                            <p className="text-label-md text-on-surface-variant">
                              Medical certificate (§16.8). Diagnosis and recommendations use the
                              Assessment / Plan above; follow-up date fills &ldquo;come back on&rdquo;.
                            </p>
                            <input
                              value={mcExaminedAt}
                              onChange={(e) => setMcExaminedAt(e.target.value)}
                              placeholder={`Examined in… (default: ${clinicRow?.clinic_name ?? "clinic"})`}
                              className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
                            />
                            <input
                              value={mcPurposeException}
                              onChange={(e) => setMcPurposeException(e.target.value)}
                              placeholder="Purpose exception (the &ldquo;except ___&rdquo; blank) — optional"
                              className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
                            />
                            <Button
                              variant="secondary"
                              disabled={issuingCert || !clinicRow}
                              onClick={handleIssueMedCert}
                            >
                              {issuingCert ? "Issuing…" : "Save & Print Certificate"}
                            </Button>
                          </div>
                        )}
                        {previewFee !== null && (
                          <p className="text-label-md text-on-surface">
                            Computed clinic fee: <strong>₱{previewFee}</strong>
                            <span className="text-on-surface-variant"> — applied to the booking on save.</span>
                          </p>
                        )}
                      </div>
                      <div className="flex gap-sm border-b border-outline-variant">
                        <button
                          type="button"
                          onClick={() => setPfDecision("charge")}
                          className={cn("border-b-2 px-xs py-sm text-label-md", pfDecision === "charge" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
                        >
                          Charge PF
                        </button>
                        <button
                          type="button"
                          onClick={() => setPfDecision("waive")}
                          className={cn("border-b-2 px-xs py-sm text-label-md", pfDecision === "waive" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
                        >
                          Waive PF
                        </button>
                      </div>
                      {pfDecision === "charge" && (
                        <div className="space-y-md">
                          <input placeholder="Amount*" value={pfAmount} onChange={(e) => setPfAmount(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
                          <select className="w-full rounded-lg border border-outline-variant px-md py-sm">
                            <option>Pay at Clinic</option>
                            <option>Online</option>
                          </select>
                          <textarea placeholder="Notes" className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
                        </div>
                      )}
                      {pfDecision === "waive" && (
                        <textarea
                          placeholder="Reason (minimum 5 characters)*"
                          value={pfWaiveReason}
                          onChange={(e) => setPfWaiveReason(e.target.value)}
                          className="w-full rounded-lg border border-outline-variant p-md"
                          rows={3}
                        />
                      )}
                      {pfDecision === null && <p className="text-label-md text-on-surface-variant">Optional — choose Charge or Waive if a decision has been made.</p>}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      </div>

      <Modal
        isOpen={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        title="Save as Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsTemplate} disabled={!newTemplateTitle.trim()}>
              Save
            </Button>
          </>
        }
      >
        <input
          value={newTemplateTitle}
          onChange={(e) => setNewTemplateTitle(e.target.value)}
          placeholder='Title (e.g. "Annual Physical — Normal")'
          className="w-full rounded-lg border border-outline-variant px-md py-sm"
        />
      </Modal>

      <Modal
        isOpen={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        title="Replace current SOAP notes?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingTemplate(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => pendingTemplate && doApplyTemplate(pendingTemplate)}>
              Replace
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">
          This will overwrite your current Chief Complaint / Subjective / Objective / Assessment / Plan text with the
          &ldquo;{pendingTemplate?.title}&rdquo; template.
        </p>
      </Modal>

      <Modal
        isOpen={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        title="Completion Checklist"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChecklistOpen(false)}>
              Go Back
            </Button>
            <Button onClick={handleComplete}>
              Confirm &amp; Complete
            </Button>
          </>
        }
      >
        <ul className="space-y-sm text-body-md">
          {SECTIONS.map((s, i) => (
            <li key={s} className="flex items-center gap-sm">
              {renderSectionIndicator(i, "text-[18px]")}
              {s}
            </li>
          ))}
        </ul>
        {!sectionSatisfied[6] && (
          <p className="mt-md rounded-lg bg-amber-50 px-md py-sm text-label-md text-amber-700">
            No follow-up set — confirm this is intentional?
          </p>
        )}
      </Modal>

      <Modal
        isOpen={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        title="Discard changes?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscardConfirmOpen(false)}>
              Keep Editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDiscardConfirmOpen(false);
                finishCancelAmend();
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">You have unsaved changes to this consultation. Discard them?</p>
      </Modal>

      <Modal isOpen={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard Shortcuts" footer={<Button onClick={() => setHelpOpen(false)}>Close</Button>}>
        <ul className="space-y-sm text-body-md text-on-surface-variant">
          {KEYBOARD_SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-md">
              <span className="rounded bg-surface-container-high px-sm py-1 font-mono text-label-sm">{s.keys}</span>
              <span>{s.description}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Drawer isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Patient History">
        <div className="space-y-md">
          {patientHistory.map((c) => (
            <div key={c.id} className="rounded-lg border border-outline-variant p-md text-body-md text-on-surface-variant">
              <p><strong>{c.appointmentDate}</strong> — {booking.doctorName}</p>
              <p>{c.chiefComplaint}</p>
            </div>
          ))}
        </div>
      </Drawer>

      <Modal isOpen={lastVisitOpen} onClose={() => setLastVisitOpen(false)} title="Last Visit SOAP" footer={<Button onClick={() => setLastVisitOpen(false)}>Close</Button>}>
        {lastVisitSoap && (
          <div className="space-y-sm text-body-md text-on-surface-variant">
            <p><strong>Date:</strong> {lastVisitSoap.appointmentDate}</p>
            <p><strong>Subjective:</strong> {lastVisitSoap.subjective}</p>
            <p><strong>Objective:</strong> {lastVisitSoap.objective}</p>
            <p><strong>Assessment:</strong> {lastVisitSoap.assessment}</p>
            <p><strong>Plan:</strong> {lastVisitSoap.plan}</p>
          </div>
        )}
      </Modal>

      <div className="fixed bottom-lg right-lg z-40 w-[17rem] max-w-[calc(100vw-2*var(--spacing-lg))]">
        <Card className="shadow-lg">
          <button
            type="button"
            onClick={() => setProgressMinimized((v) => !v)}
            className="flex w-full items-center justify-between gap-sm text-left"
          >
            <span className="flex items-center gap-sm text-label-md font-bold text-on-surface-variant">
              <Icon name="monitoring" className="text-[16px]" />
              {progressMinimized ? currentSectionLabel() : "Progress"}
            </span>
            <Icon name={progressMinimized ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
          </button>
          {!progressMinimized && (
            <ul className="mt-md space-y-sm text-label-md text-on-surface-variant">
              {SECTIONS.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(i)}
                    className={cn(
                      "flex w-full items-center gap-sm rounded-lg px-xs py-1 text-left transition-colors hover:bg-surface-container-low",
                      openSection === i && "bg-primary/10 font-medium text-on-surface",
                    )}
                  >
                    {renderSectionIndicator(i, "text-[16px]")}
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

// Stitch consultation_workflow_active / amend_mode / qa_fully_expanded
// (completion checklist) / consultation_post_completion_landing — one
// stateful component per React-Conversion-Guide.md §4.
export default function ConsultationPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  return (
    <Suspense>
      <ConsultationWorkflow bookingId={bookingId} />
    </Suspense>
  );
}
