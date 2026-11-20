"use client";

import "./consultation.css";
import { ClinicalNoteField } from "@/components/doctor/ClinicalNoteField";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { todayManila } from "@/lib/clock";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { useSearchParams, notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill, type PillTone } from "@/components/ui/StatusPill";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { Toast } from "@/components/ui/Toast";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/ui/Icon";
import { VitalsEditor } from "@/components/doctor/VitalsEditor";
import { PatientHistoryModal } from "@/components/doctor/PatientHistoryModal";
import { PrescriptionForm } from "@/components/doctor/PrescriptionForm";
import { SoapFieldToolbar } from "@/components/doctor/SoapFieldToolbar";
//JJQR - AI (Nov 19, 2026)
import { stepIndicator, nextMissingSection } from "@/lib/clinical/consult-steps";
//JJQR - END
//JJQR - AI (Nov 19, 2026) - template-library hook, SOAP merge helpers, Manage deep links
import { useTemplateLibrary } from "@/lib/clinical/useTemplateLibrary";
import { SOAP_KEYS, SOAP_FIELD_LABELS, hasSoapContent, mergeSoapTemplate, splitAddedText, soapEqual, type SoapApplyMode, type SoapFieldOutcome, type SoapValues } from "@/lib/clinical/soap-merge";
import { manageTemplatesHref } from "@/lib/clinical/template-links";
//JJQR - END
//JJQR - AI (Oct 31, 2026)
import {
  ConsultPatientBanner,
  allergiesNeedPrescriptionReview,
} from "@/components/doctor/ConsultPatientBanner";
import { DiagnosisCombobox } from "@/components/doctor/DiagnosisCombobox";
import { GrowthChart } from "@/components/doctor/GrowthChart";
import {
  queryPatientAllergies,
  replacePatientAllergies,
  queryPatientById,
  updatePatient,
  type PatientAllergyRow,
  type PatientRow,
} from "@/lib/data/patients";
import { queryPatientLabValues, type PatientLabValueRow } from "@/lib/data/clinical";
import { ANC_PRESETS, matchLabTests, type AncPresetId } from "@/lib/clinical/anc-labs";
import { estimatePercentile } from "@/lib/clinical/growth";
import {
  computeNipStatus,
  inferDoseNumberFromLabel,
  nipDueForAgeMonths,
} from "@/lib/clinical/nip-schedule";
import {
  defaultSpecialtyFromDoctor,
  matchesSpecialtyFilter,
  SPECIALTY_CHIP_LABELS,
  type Specialty,
} from "@/lib/clinical/template-specialty";
//JJQR - END
import { cn } from "@/lib/cn";
import { useSession } from "@/components/providers/SessionProvider";
import { queryVitalFieldTemplates, queryLabTestCatalog, type LabTestRow } from "@/lib/data/lookups";
import { queryLabOrdersByBooking, replaceLabOrdersByConsultation } from "@/lib/data/labs";
import { queryVaccinationsByConsultation, queryVaccinations, replaceVaccinationsByConsultation, type VaccinationRow } from "@/lib/data/patientFiles";
import { updateQueueEntry } from "@/lib/data/queue";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { queryAuditLogs, queryClinicSettings, type ClinicSettingsRow } from "@/lib/data/admin";
import {
  queryConsultationByBooking,
  queryConsultationById,
  queryConsultations,
  queryDiagnoses,
  queryFollowUps,
  createSoapTemplate,
  createDiagnosisTemplate,
  upsertConsultationByBooking,
  replaceDiagnoses,
  upsertFollowUpByConsultation,
  deleteFollowUpByConsultation,
  upsertMedicalCertificateByConsultation,
  queryMedicalCertificateByConsultation,
  deleteMedicalCertificateByConsultation,
  queryRxGroups,
  queryVitalReadings,
  type RxGroupRow,
  createMedicalCertificateTemplate,
  type MedicalCertificateTemplateRow,
} from "@/lib/data/clinical";
import { queryDoctorById, type DoctorRow } from "@/lib/data/doctors";
import { queryBookingById } from "@/lib/data/bookings";
import { printMedicalCertificate } from "@/lib/print-forms";
//JJQR - AI (Nov 20, 2026) E1
import {
  diagnosisTextFromConsult,
  examinedAtFromClinic,
  patientAddressFromProfile,
  shouldApplyTemplateDiagnosis,
  medCertFeeAddOn,
} from "@/lib/clinical/med-cert-fields";
//JJQR - END
import {
  printLabOrdersForBooking,
  printPrescriptionForBooking,
} from "@/lib/consult-print";
import { formatConsultationDiagnosisLabel } from "@/lib/data/clinical";
import { formatPeso } from "@/lib/format";
import {
  computeClinicFee,
  pfEditorAmountFromStored,
  pfEditorDecisionFromStored,
  pfViewDecisionFromStored,
  shouldPrefillChargeAmount,
  type ClinicFeeSchedule,
} from "@/lib/clinical/preview-fee";
import type {
  Consultation,
  Diagnosis,
  SoapTemplate,
  PrescriptionGroup,
  PrescriptionLineItem,
  VitalFieldTemplate,
} from "@/data/types";
import type { Database } from "@/data/supabase-types";

type DbLineItem = Database["public"]["Tables"]["prescription_line_items"]["Row"];

function mapRxGroup(g: RxGroupRow): PrescriptionGroup {
  return {
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
      mealRelation: (i.meal_relation as "Before" | "After" | null) ?? null,
      timing: i.timing ?? null,
      durationKind: (i.duration_kind as "Maintain" | "Days" | "Weeks" | null) ?? null,
      durationValue: i.duration_value ?? null,
      indication: i.indication ?? null,
      //JJQR - AI (Oct 31, 2026)
      route: i.route ?? null,
      //JJQR - END
    })),
  };
}

interface ConsultationBooking {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  patientSex: string;
  patientDob: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  totalFee: number;
  paymentStatus: string;
  // §16.6 — doctor-set fee-line inputs, seeded from the booking row.
  visitType: "New" | "FollowUp";
  discountCategory: "Senior" | "PWD" | "";
  medCertRequested: boolean;
}

function toDiagnosisType(d: Diagnosis) {
  return d.type as "Primary" | "Secondary" | "Differential" | "Comorbidity";
}

const SECTIONS = [
  "Clinical notes",
  "Vital Signs",
  "Diagnosis",
  "Prescription",
  "Lab Orders",
  "Vaccinations",
  "Follow-up",
  "Medical Certificate",
  "Professional Fee Decision",
];

// Doctor.md §4: sections 1 (Chief Complaint), 2 (BP+HR), 3 (>=1 diagnosis) are
// the only ones gating completion — see "Required fields to complete a
// consultation". Everything else, including Professional Fee Decision, is
// optional/recommended (the code previously also gated on PF Decision, which
// contradicted that explicit section).
/** Consult2 / Grace clinic: always chart Rx + follow-up as well as SOAP/vitals/Dx. */
const REQUIRED_SECTIONS = [0, 1, 2, 3, 6];
/** Vaccinations + PF — hidden until "Show more" (Labs + Med cert in default stack). */
const OCCASIONAL_SECTIONS = [5, 8] as const;
const SECTION_ORDER = [0, 1, 2, 3, 4, 6, 7, 5, 8] as const;

//JJQR - AI (Nov 20, 2026) C6
/** 1-based section index from ?section=9 or #section-9 (Clinical notes = 1). */
function parseConsultSectionParam(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > SECTIONS.length) return null;
  return n - 1;
}

//JJQR - AI (Nov 20, 2026) F1 — completed-visit summary: read-only PF line (section 9 is the only editor)
function formatProfessionalFeeLine(opts: {
  decision: "charge" | "waive" | null;
  amount: string;
  waiveReason: string;
  computedTotal?: number | null;
}): string {
  if (opts.decision === "waive") {
    const reason = opts.waiveReason.trim();
    return reason ? `Professional fee: Waive — ${reason}` : "Professional fee: Waive";
  }
  if (opts.decision === "charge") {
    const raw = opts.amount.trim();
    const n = Number(raw);
    if (raw !== "" && Number.isFinite(n)) return `Professional fee: Charge ${formatPeso(n)}`;
    //JJQR - AI (Nov 20, 2026) F4 — Charge with a null amount keeps the label and hints the clinic total
    const hint =
      opts.computedTotal != null && Number.isFinite(opts.computedTotal)
        ? ` (Total: ${formatPeso(opts.computedTotal)})`
        : "";
    return `Professional fee: Charge${hint}`;
  }
  return "Professional fee: Decide at desk";
}
//JJQR - END

type SectionStatus = "complete" | "warning" | "partial" | "empty";

const STATUS_ICON: Record<SectionStatus, { icon: string; cls: string }> = {
  complete: { icon: "check_circle", cls: "text-status-success" },
  warning: { icon: "warning", cls: "text-status-warning" },
  partial: { icon: "incomplete_circle", cls: "text-status-info" },
  empty: { icon: "radio_button_unchecked", cls: "text-on-surface-variant" },
};

interface LabOrderDraft {
  labTestId: string | null; // set = from the catalog; null = handwritten
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

const BLANK_LAB: LabOrderDraft = { labTestId: null, testName: "", reason: "", specimenType: "", notes: "" };
const BLANK_VAX: VaccinationDraft = { vaccineName: "", doseNumber: "", route: "", site: "", lotNumber: "", expiry: "", manufacturer: "" };

const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl+1 – Ctrl+8", description: "Jump to that numbered section" },
  { keys: "Ctrl+S", description: "Save Draft (complete mode) or save progress in amend (stays in amend)" },
  { keys: "Ctrl+Enter", description: "Complete Consultation (when required fields are valid)" },
  { keys: "?", description: "Show this help" },
];

//JJQR - AI (Oct 31, 2026) — soft hint when assessment text omits primary diagnosis wording
const ASSESSMENT_DX_STOPWORDS = new Set([
  "acute",
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "in",
  "on",
  "with",
  "without",
  "unspecified",
  "other",
]);

function assessmentOmitsPrimaryDiagnosis(primaryDescription: string, assessmentText: string): boolean {
  const hay = assessmentText.toLowerCase();
  const significant = primaryDescription
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !ASSESSMENT_DX_STOPWORDS.has(w));
  if (significant.length === 0) return false;
  return !significant.some((w) => hay.includes(w));
}

function showAssessmentDiagnosisMismatchHint(diagnoses: Diagnosis[], assessmentText: string): boolean {
  if (!assessmentText.trim() || diagnoses.length === 0) return false;
  const primary = diagnoses.find((d) => d.type === "Primary") ?? diagnoses[0];
  return assessmentOmitsPrimaryDiagnosis(primary.description, assessmentText);
}
//JJQR - END

function toLabDraft(items: Consultation["labOrders"]): LabOrderDraft[] {
  return (items ?? []).map((i) => ({ labTestId: null, testName: i.testName, reason: i.reason ?? "", specimenType: i.specimenType ?? "", notes: i.notes ?? "" }));
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
  //JJQR - AI (Oct 31, 2026)
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [patientAllergies, setPatientAllergies] = useState<PatientAllergyRow[]>([]);
  const [nkda, setNkda] = useState(false);
  const formDirtyRef = useRef(false);
  //JJQR - AI (Nov 20, 2026) C4
  const lastSavedPayloadRef = useRef<string | null>(null);
  const [inlineSaved, setInlineSaved] = useState(false);
  //JJQR - END
  //JJQR - AI (Oct 31, 2026) — F-010 beforeunload baseline
  const completeBaselineRef = useRef<string | null>(null);
  const consultationFinalizedRef = useRef(false);
  //JJQR - END
  const [booking, setBooking] = useState<ConsultationBooking | null>(null);
  const [consultationId, setConsultationId] = useState<string | null>(null);
  // Doctor.md §4: "View Last Visit SOAP" quick reference — the most recent
  // PRIOR consultation for this SAME patient (excludes this bookingId,
  // matched on patientId so a different patient's record can never surface).
  const [lastVisitSoap, setLastVisitSoap] = useState<Consultation | undefined>(undefined);
  const [lastVisitVitalReadings, setLastVisitVitalReadings] = useState<{ templateId: string; value: string }[]>([]);
  //JJQR - AI (Oct 31, 2026) — prior visit Rx lines for PrescriptionForm
  const [priorRxItems, setPriorRxItems] = useState<PrescriptionLineItem[]>([]);
  const [patientDetail, setPatientDetail] = useState<PatientRow | null>(null);
  //JJQR - AI (Nov 20, 2026) E1
  const [doctorProfile, setDoctorProfile] = useState<DoctorRow | null>(null);
  const patientAddressMissingRef = useRef(false);
  //JJQR - END
  const [patientLabValues, setPatientLabValues] = useState<PatientLabValueRow[]>([]);
  const [patientVaxHistory, setPatientVaxHistory] = useState<VaccinationRow[]>([]);
  const [soapSpecialtyFilter, setSoapSpecialtyFilter] = useState<Specialty | "All">("All");
  //JJQR - END
  const [vitalTemplates, setVitalTemplates] = useState<VitalFieldTemplate[]>([]);
  const [vitalReadings, setVitalReadings] = useState<{ templateId: string; value: string }[]>([]);

  const [mode, setMode] = useState(initialMode);
  const [checklistOpen, setChecklistOpen] = useState(false);
  //JJQR - AI (Oct 31, 2026)
  //JJQR - AI (Nov 19, 2026) - warnings on required steps only after the doctor tries to complete
  const [completeAttempted, setCompleteAttempted] = useState(false);
  //JJQR - END
  //JJQR - END
  const [historyOpen, setHistoryOpen] = useState(false);
  const [amendHistoryOpen, setAmendHistoryOpen] = useState(false);
  const [lastVisitOpen, setLastVisitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  //JJQR - AI (Nov 20, 2026) C5 — Review section modal removed; footer Save draft / Save amendment / Ctrl+S persist.
  const [labsConfirmPrint, setLabsConfirmPrint] = useState<boolean | null>(null);
  const [certConfirmPrint, setCertConfirmPrint] = useState<boolean | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [openSection, setOpenSection] = useState(() => {
    const fromQuery = parseConsultSectionParam(searchParams.get("section"));
    if (fromQuery !== null) return fromQuery;
    if (typeof window === "undefined") return 0;
    const m = window.location.hash.match(/^#section-(\d+)$/i);
    return parseConsultSectionParam(m?.[1]) ?? 0;
  });
  //JJQR - AI (Oct 31, 2026)
  const [allergyReviewed, setAllergyReviewed] = useState(false);
  //JJQR - END
  //JJQR - AI (Oct 31, 2026) — complete mode shows all sections; no occasional toggle
  /** Consult2: occasional sections hidden until the doctor asks for them (not in complete mode). */
  const [showOccasional, setShowOccasional] = useState(false);
  //JJQR - AI (Nov 20, 2026) C6
  const [seenSectionQuery, setSeenSectionQuery] = useState(() => searchParams.get("section"));
  const sectionQuery = searchParams.get("section");
  if (sectionQuery !== seenSectionQuery) {
    setSeenSectionQuery(sectionQuery);
    const idx = parseConsultSectionParam(sectionQuery);
    if (idx !== null) {
      setInlineSaved(false);
      if (OCCASIONAL_SECTIONS.includes(idx as (typeof OCCASIONAL_SECTIONS)[number])) setShowOccasional(true);
      setOpenSection(idx);
    }
  }
  //JJQR - AI (Nov 19, 2026) - Vaccinations + Fee sit behind "More" in every mode (the open one always stays visible)
  const revealOccasionalSections = showOccasional || OCCASIONAL_SECTIONS.includes(openSection as (typeof OCCASIONAL_SECTIONS)[number]);
  //JJQR - END
  const visibleSectionOrder = SECTION_ORDER.filter(
    (i) => revealOccasionalSections || !OCCASIONAL_SECTIONS.includes(i as (typeof OCCASIONAL_SECTIONS)[number]),
  );
  function goToSection(i: number) {
    if (i !== openSection) setInlineSaved(false);
    if (OCCASIONAL_SECTIONS.includes(i as (typeof OCCASIONAL_SECTIONS)[number])) setShowOccasional(true);
    setOpenSection(i);
  }
  //JJQR - END
  //JJQR - END
  /** Explicit escape hatch when Grace would omit medicines (rare). */
  const [noMedsConfirmed, setNoMedsConfirmed] = useState(false);
  // Bumped after each in-place prescription save to remount the embedded
  // PrescriptionForm with the freshly-saved group (its own internal state
  // otherwise wouldn't know a save just happened, since it isn't the one
  // navigating anywhere).
  const [rxVersion, setRxVersion] = useState(0);
  const [rxSavedAt, setRxSavedAt] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  //JJQR - AI (Oct 31, 2026)
  const [amendSavedAt, setAmendSavedAt] = useState<string | null>(null);
  //JJQR - END
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  // Save Draft / Complete / Save Changes all funnel through persistConsultation,
  // which makes several sequential API calls — if any of them throws, the
  // whole thing used to fail silently (the button just... did nothing).
  // Surface it instead.
  const [saveError, setSaveError] = useState("");
  const [completing, setCompleting] = useState(false);
  // Progress is a floating panel (not a fixed sidebar column) so the
  // accordion itself can use the full page width. Minimized, it collapses to
  // a pill showing whichever section is currently open — e.g. "1/5 SOAP &
  // Chief Complaint" — instead of a generic label.
  // Progress used to be a floating panel — it always cost screen space, either
  // a wide list overlapping the form or a pill sitting in a gutter too narrow
  // for it. Now it's a header button that opens a normal anchored dropdown:
  // zero footprint closed, and open is a deliberate, dismissible action.

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
  //JJQR - AI (Nov 19, 2026) - lists come from the shared hook; each loads on its own, so one failure never breaks the page
  const templateLib = useTemplateLibrary(booking?.doctorId);
  const soapTemplates = useMemo<SoapTemplate[]>(
    () => templateLib.soap.items.map((t) => ({
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
    [templateLib.soap.items],
  );
  const mcTemplates = templateLib.certs.items;
  const diagnosisTemplates = templateLib.diagnoses.items;
  // Small page-level notice for template saves/applies (success + error).
  const noticeSeq = useRef(0);
  const [tplNotice, setTplNotice] = useState<{ id: number; variant: "success" | "error" | "warning"; message: string } | null>(null);
  function notifyTpl(variant: "success" | "error" | "warning", message: string) {
    setTplNotice({ id: ++noticeSeq.current, variant, message });
  }
  useEffect(() => {
    if (!tplNotice) return;
    const t = setTimeout(() => setTplNotice((cur) => (cur && cur.id === tplNotice.id ? null : cur)), 8000);
    return () => clearTimeout(t);
  }, [tplNotice]);
  //JJQR - END
  const [pendingTemplate, setPendingTemplate] = useState<SoapTemplate | null>(null);
  //JJQR - AI (Nov 19, 2026) - Replace/Append choice + Undo snapshot for SOAP template apply
  const [soapApplyMode, setSoapApplyMode] = useState<SoapApplyMode>("append");
  const [templateUndo, setTemplateUndo] = useState<{ id: number; title: string; before: SoapValues; applied: SoapValues } | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState("");
  const currentSoap: SoapValues = { chiefComplaint, subjective, objective, assessment, plan };
  const soapSetters: Record<(typeof SOAP_KEYS)[number], (v: string) => void> = {
    chiefComplaint: setChiefComplaint,
    subjective: setSubjective,
    objective: setObjective,
    assessment: setAssessment,
    plan: setPlan,
  };
  function writeSoap(values: SoapValues) {
    SOAP_KEYS.forEach((k) => soapSetters[k](values[k]));
    formDirtyRef.current = true;
  }
  // Undo is only offered while the notes are exactly what the template apply produced — never overwrites later typing.
  const undoAvailable = templateUndo !== null && soapEqual(currentSoap, templateUndo.applied);
  useEffect(() => {
    if (!templateUndo) return;
    const t = setTimeout(() => setTemplateUndo((cur) => (cur && cur.id === templateUndo.id ? null : cur)), 15000);
    return () => clearTimeout(t);
  }, [templateUndo]);
  //JJQR - END

  function doApplyTemplate(template: SoapTemplate, mode: SoapApplyMode = soapApplyMode) {
    //JJQR - AI (Nov 19, 2026) - Replace/Append; blank template fields never wipe existing text
    const { values } = mergeSoapTemplate(currentSoap, template, mode);
    if (!soapEqual(values, currentSoap)) {
      setTemplateUndo({ id: ++noticeSeq.current, title: template.title, before: currentSoap, applied: values });
      writeSoap(values);
    }
    setPendingTemplate(null);
    //JJQR - END
  }
  function undoTemplateApply() {
    if (!templateUndo || !undoAvailable) return;
    writeSoap(templateUndo.before);
    setTemplateUndo(null);
    notifyTpl("success", "Template undone — your previous notes are back.");
  }

  function applyTemplate(template: SoapTemplate) {
    //JJQR - AI (Nov 19, 2026) - all 5 boxes empty: apply directly (no preview) and still offer Undo; any text: preview first (Replace/Append), append is the safe default
    if (!hasSoapContent(currentSoap)) {
      if (!hasSoapContent(template)) {
        notifyTpl("warning", `“${template.title}” is empty — there is nothing to apply.`);
        return;
      }
      doApplyTemplate(template, "replace");
      return;
    }
    setSoapApplyMode("append");
    setPendingTemplate(template);
    //JJQR - END
  }

  async function saveAsTemplate() {
    //JJQR - AI (Nov 19, 2026) - blocked when all 5 fields are empty; failures are shown, never swallowed
    if (!newTemplateTitle.trim() || !booking || savingTemplate) return;
    if (!hasSoapContent(currentSoap)) {
      setSaveTemplateError("Nothing to save — all five SOAP fields are empty. Type something first.");
      return;
    }
    setSavingTemplate(true);
    setSaveTemplateError("");
    try {
      const supabase = null as never;
      const data = await createSoapTemplate(supabase, booking.doctorId, {
        title: newTemplateTitle.trim(),
        is_system_template: false,
        chief_complaint: chiefComplaint || null,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
      });
      templateLib.soap.add(data);
      notifyTpl("success", `SOAP template “${data.title}” saved.`);
      setNewTemplateTitle("");
      setSaveTemplateOpen(false);
    } catch {
      setSaveTemplateError("The template was not saved. Your notes are unchanged — please try again.");
      notifyTpl("error", "SOAP template was not saved. Your notes are unchanged.");
    } finally {
      setSavingTemplate(false);
    }
    //JJQR - END
  }

  //JJQR - AI (Nov 19, 2026) - "Save as Template" click: refuse with a visible reason when all 5 fields are empty
  function openSaveTemplate() {
    if (!hasSoapContent(currentSoap)) {
      notifyTpl("warning", "Can’t save an empty template — fill in at least one SOAP field first.");
      return;
    }
    setSaveTemplateError("");
    setSaveTemplateOpen(true);
  }
  //JJQR - END

  //JJQR - AI (Nov 19, 2026) - certificate templates: confirm before replacing filled fields; blank template fields keep your text
  const [pendingMcTemplate, setPendingMcTemplate] = useState<MedicalCertificateTemplateRow | null>(null);
  const [savingMcTemplate, setSavingMcTemplate] = useState(false);

  async function saveMcAsTemplate() {
    if (!saveMcTplTitle.trim() || !booking || savingMcTemplate) return;
    if (!mcDiagnosis.trim() && !mcRecommendations.trim() && !mcPurposeException.trim()) {
      notifyTpl("warning", "Can’t save an empty certificate template — fill in at least one field first.");
      return;
    }
    setSavingMcTemplate(true);
    try {
      const supabase = null as never;
      const data = await createMedicalCertificateTemplate(supabase, booking.doctorId, {
        title: saveMcTplTitle.trim(),
        is_system_template: false,
        diagnosis_text: mcDiagnosis || null,
        recommendations: mcRecommendations || null,
        purpose_exception: mcPurposeException || null,
      });
      templateLib.certs.add(data);
      notifyTpl("success", `Certificate template “${data.title}” saved.`);
      setSaveMcTplTitle("");
      setSaveMcTplOpen(false);
    } catch {
      notifyTpl("error", "Certificate template was not saved. Your certificate text is unchanged.");
    } finally {
      setSavingMcTemplate(false);
    }
  }
  //JJQR - END

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
    const supabase = null as never;
    const data = await queryVitalReadings(supabase, { bookingId });
    setVitalReadings(data.map((r) => ({ templateId: r.template_id, value: r.value })));
  }

  // Section 3: Diagnosis
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);

  function addDiagnosisLine(text: string, icd10Code: string | null = null) {
    const t = text.trim();
    if (!t) return;
    setDiagnoses((prev) => [
      ...prev,
      {
        code: icd10Code ?? "—",
        description: t,
        type: prev.length === 0 ? "Primary" : "Secondary",
        //JJQR - AI (Oct 31, 2026)
        icd10Code,
        //JJQR - END
      },
    ]);
    formDirtyRef.current = true;
  }
  //JJQR - AI (Nov 20, 2026) C1 C2
  function addSavedDiagnosisTemplate(t: { body: string; icd10_code?: string | null }) {
    addDiagnosisLine(t.body, t.icd10_code ?? null);
  }
  async function saveTypedDiagnosisToMyDiagnoses(text: string) {
    const label = text.trim();
    const body = label;
    if (!label) return;
    try {
      const created = await createDiagnosisTemplate(null as never, { label, body, icd10_code: null });
      templateLib.diagnoses.add(created);
      notifyTpl("success", `Diagnosis “${created.label}” saved.`);
      addDiagnosisLine(created.body, created.icd10_code ?? null);
    } catch {
      notifyTpl("error", "Diagnosis was not saved. The diagnosis text is unchanged — please try again.");
    }
  }
  //JJQR - END

  //JJQR - AI (Oct 31, 2026)
  async function persistAllergies(nextRows: PatientAllergyRow[], nextNkda: boolean) {
    if (!booking) return;
    const payload = nextNkda
      ? [{ allergen: "NKDA", is_nkda: true }]
      : nextRows.filter((a) => !a.is_nkda).map((a) => ({
          allergen: a.allergen,
          reaction: a.reaction,
          severity: a.severity,
          is_nkda: false,
        }));
    const saved = await replacePatientAllergies(null as never, booking.patientId, payload);
    setPatientAllergies(saved);
    setNkda(saved.some((a) => a.is_nkda));
    setAllergyReviewed(false);
    formDirtyRef.current = true;
  }
  //JJQR - END

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
  const [labCatalog, setLabCatalog] = useState<LabTestRow[]>([]);
  const [savingLabs, setSavingLabs] = useState(false);
  const [printingLabs, setPrintingLabs] = useState(false);
  const [printingRx, setPrintingRx] = useState(false);
  const [labsSavedAt, setLabsSavedAt] = useState<string | null>(null);

  function addLabOrder() {
    if (!newLab.testName.trim()) return;
    setLabOrders((prev) => [...prev, { ...newLab, labTestId: null }]);
    setNewLab(BLANK_LAB);
  }
  function removeLabOrder(index: number) {
    setLabOrders((prev) => prev.filter((_, i) => i !== index));
  }
  function toggleCatalogTest(t: LabTestRow) {
    setLabOrders((prev) => {
      const at = prev.findIndex((l) => l.labTestId === t.lab_test_id);
      if (at >= 0) return prev.filter((_, i) => i !== at);
      return [...prev, { labTestId: t.lab_test_id, testName: t.name, reason: "", specimenType: "", notes: "" }];
    });
  }
  function applyAncPreset(presetId: AncPresetId) {
    const { catalogMatches, missingNames } = matchLabTests(labCatalog, presetId);
    setLabOrders((prev) => {
      let next = [...prev];
      for (const t of catalogMatches) {
        if (!next.some((l) => l.labTestId === t.lab_test_id)) {
          next = [...next, { labTestId: t.lab_test_id, testName: t.name, reason: "", specimenType: "", notes: "" }];
        }
      }
      for (const name of missingNames) {
        const key = name.toLowerCase();
        if (!next.some((l) => l.testName.trim().toLowerCase() === key)) {
          next = [...next, { labTestId: null, testName: name, reason: "", specimenType: "", notes: "" }];
        }
      }
      return next;
    });
  }

  // §16.8 Form 3 — persist the lab request (replace-all on consultation) then
  // optionally print it. Requires a saved consultation.
  function labPrintOverrides() {
    return {
      tests: labOrders.filter((l) => l.testName.trim()).map((l) => l.testName.trim()),
      catalog: labCatalog.map((t) => ({ name: t.name })),
      diagnoses: diagnoses
        .map((d) =>
          formatConsultationDiagnosisLabel({
            icd10_code: d.icd10Code ?? null,
            custom_description: d.description,
          }),
        )
        .filter(Boolean),
      clinicalNotes: [assessment, plan].filter(Boolean).join("\n"),
      date: booking?.appointmentDate,
    };
  }

  async function runPrintLabOrders() {
    if (!booking) return;
    const { tests } = labPrintOverrides();
    if (tests.length === 0) return;
    setPrintingLabs(true);
    try {
      await printLabOrdersForBooking(bookingId, labPrintOverrides());
    } finally {
      setPrintingLabs(false);
    }
  }

  async function runPrintPrescription() {
    const group = prescriptionGroup;
    if (!booking || !group?.items.length) return;
    setPrintingRx(true);
    try {
      await printPrescriptionForBooking(bookingId, {
        date: booking.appointmentDate,
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
          route: i.route ?? null,
        })),
      });
    } finally {
      setPrintingRx(false);
    }
  }

  function consultPrintButtons(className?: string) {
    const showRx = (prescriptionGroup?.items.length ?? 0) > 0;
    const showLabs = labOrders.some((l) => l.testName.trim());
    //JJQR - AI (Oct 31, 2026)
    return (
      <div className={className ?? "flex flex-wrap gap-sm"}>
        <Button
          variant="secondary"
          loading={printingRx}
          disabled={!showRx}
          onClick={() => void runPrintPrescription()}
        >
          <Icon name="print" className="text-[16px]" />
          Print Prescription
        </Button>
        <Button
          variant="secondary"
          loading={printingLabs}
          disabled={!showLabs}
          onClick={() => void runPrintLabOrders()}
        >
          <Icon name="print" className="text-[16px]" />
          Print Lab Orders
        </Button>
      </div>
    );
    //JJQR - END
  }

  async function handleSaveLabOrders(printAfter: boolean) {
    if (!booking) return;
    setSavingLabs(true);
    const supabase = null as never;
    try {
      //JJQR - AI (Oct 31, 2026) — amend section saves persist as Amended, stay in amend
      const consultId =
        consultationId ?? (await persistConsultation(mode === "amend" ? "Amended" : "Draft"));
      if (!consultId) return;
      await replaceLabOrdersByConsultation(
        supabase,
        consultId,
        labOrders
          .filter((l) => l.testName.trim())
          .map((l) => ({
            lab_test_id: l.labTestId,
            test_name: l.testName.trim(),
            clinical_indication: l.reason || null,
            specimen_type: l.specimenType || null,
            notes: l.notes || null,
          })),
      );
      setLabsSavedAt(new Date().toLocaleTimeString());
      if (mode === "amend") setAmendSnapshot(currentFormSnapshot());
      if (printAfter) await runPrintLabOrders();
      //JJQR - END
    } finally {
      setSavingLabs(false);
    }
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
  function giveNipVaccineToday(label: string) {
    const dose = inferDoseNumberFromLabel(label);
    setVaccinations((prev) => {
      const norm = label.toLowerCase();
      if (prev.some((v) => v.vaccineName.trim().toLowerCase() === norm)) return prev;
      return [...prev, { ...BLANK_VAX, vaccineName: label, doseNumber: dose }];
    });
  }

  // Section 7: Follow-up — seeded from the existing record. follow_ups is a
  // real table (1:1 with consultations), wired for real in this phase.
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [followUpReminder, setFollowUpReminder] = useState(true);
  //JJQR - AI (Oct 31, 2026)
  const [followUpMode, setFollowUpMode] = useState<"dated" | "prn" | "none">("dated");
  const [noFollowUpConfirmed, setNoFollowUpConfirmed] = useState(false);
  //JJQR - END
  // Tracks whether a follow-up row existed on load, so persistConsultation can
  // skip the DELETE call entirely when there was never one to delete — the
  // API 404s either way, but a consultation with no follow-up hits this on
  // every single save, and a "failed" request in devtools for a no-op is
  // just noise a doctor shouldn't have to see.
  const followUpExisted = useRef(false);

  // Section 8: Professional Fee Decision — seeded from the existing record.
  // Optional for completion (see REQUIRED_SECTIONS above); the tabs' own
  // sub-fields (amount / waive reason) are what's "required" once a tab is chosen.
  // No real table backs this yet, so it stays local-only like Lab Orders/Vaccinations.
  //JJQR - AI (Nov 20, 2026) F5 — Charge is the editor default until a stored decision loads
  const [pfDecision, setPfDecision] = useState<"charge" | "waive" | null>("charge");
  const [pfAmount, setPfAmount] = useState("");
  const [pfWaiveReason, setPfWaiveReason] = useState("");
  // §16.6 — doctor picks the fee line; the backend recomputes the booking total
  // on consultation save. Seeded from the booking row in the load effect.
  const [visitType, setVisitType] = useState<"New" | "FollowUp">("New");
  // What staff tagged it as at check-in, kept separately so the doctor can
  // see (and reverse) their own override without losing that context.
  const [staffVisitType, setStaffVisitType] = useState<"New" | "FollowUp" | null>(null);
  const [discountCategory, setDiscountCategory] = useState<"Senior" | "PWD" | "">("");
  const [feeSchedule, setFeeSchedule] = useState<ClinicFeeSchedule | null>(null);
  // §16.8 Form 2 — medical certificate (its own section, index 7).
  const [clinicRow, setClinicRow] = useState<ClinicSettingsRow | null>(null);
  const [mcAddress, setMcAddress] = useState("");
  const [mcExaminedAt, setMcExaminedAt] = useState("");
  //JJQR - AI (Nov 20, 2026) E1 — exam dates default to today (Manila); overwritten if a saved cert hydrates
  const [mcExamFrom, setMcExamFrom] = useState(() => todayManila());
  const [mcExamTo, setMcExamTo] = useState(() => todayManila());
  //JJQR - END

  // Standard clinical patient identifier: Name, Sex, Birthday (+ age) — this
  // is what should always be on screen, not a services list that's empty for
  // every walk-in visit (there are no itemized "services" in a flat-fee,
  // no-appointment-slots clinic — see AGENTS/memory).
  function patientAge(dob: string): number | null {
    if (!dob) return null;
    const [ty, tm, td] = todayManila().split("-").map(Number);
    const [by, bm, bd] = dob.split("-").map(Number);
    if (!by) return null;
    let age = ty - by;
    if (tm < bm || (tm === bm && td < bd)) age--;
    return age;
  }
  function formatDob(dob: string): string {
    if (!dob) return "";
    return new Date(`${dob}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }
  function patientAgeMonths(dob: string): number | null {
    const years = patientAge(dob);
    if (years == null || !dob) return null;
    const [ty, tm, td] = todayManila().split("-").map(Number);
    const [by, bm, bd] = dob.split("-").map(Number);
    if (!by) return null;
    let months = (ty - by) * 12 + (tm - bm);
    if (td < bd) months--;
    return Math.max(0, months);
  }
  function vitalFormValue(filled: Record<string, string>, ...keys: string[]): string {
    for (const k of keys) {
      const v = filled[k]?.trim();
      if (v) return v;
    }
    for (const [k, v] of Object.entries(filled)) {
      if (keys.some((part) => k.includes(part)) && v.trim()) return v.trim();
    }
    return "";
  }
  function renalCueText(): string | null {
    const lab = patientLabValues.find((l) => l.creatinine_mg_dl != null || l.egfr != null);
    if (lab) {
      const parts = [
        lab.creatinine_mg_dl != null ? `Cr ${lab.creatinine_mg_dl} mg/dL` : null,
        lab.egfr != null ? `eGFR ${lab.egfr}` : null,
        lab.collected_at ? `(${lab.collected_at.slice(0, 10)})` : null,
      ].filter(Boolean);
      if (parts.length) return `Renal labs: ${parts.join(", ")}`;
    }
    if (patientDetail?.last_creatinine_mg_dl != null || patientDetail?.last_egfr != null) {
      return `Last renal: Cr ${patientDetail.last_creatinine_mg_dl ?? "—"} mg/dL, eGFR ${patientDetail.last_egfr ?? "—"}${
        patientDetail.last_renal_labs_date ? ` (${patientDetail.last_renal_labs_date.slice(0, 10)})` : ""
      }`;
    }
    return null;
  }
  function pedsVitalRangeNote(ageYears: number | null): string | null {
    if (ageYears == null || ageYears >= 18) return null;
    if (ageYears < 1) return "Pediatric normals (approx): HR 100–160 / RR 30–60";
    if (ageYears < 3) return "Pediatric normals (approx): HR 90–150 / RR 24–40";
    if (ageYears < 6) return "Pediatric normals (approx): HR 80–140 / RR 22–34";
    if (ageYears < 12) return "Pediatric normals (approx): HR 70–120 / RR 18–30";
    return "Pediatric normals (approx): HR 60–100 / RR 12–20";
  }
  function growthPercentileNotes(): string[] {
    if (!booking) return [];
    const ageMo = patientAgeMonths(booking.patientDob);
    if (ageMo == null || ageMo > 60) return [];
    const notes: string[] = [];
    const w = Number.parseFloat(vitalFormValue(filledVitals, "weight"));
    const h = Number.parseFloat(vitalFormValue(filledVitals, "height"));
    const hc = Number.parseFloat(vitalFormValue(filledVitals, "head", "hc"));
    if (Number.isFinite(w)) {
      const p = estimatePercentile(booking.patientSex, ageMo, "weight", w);
      if (p != null) notes.push(`Weight ≈ ${p}th %ile`);
    }
    if (Number.isFinite(h)) {
      const p = estimatePercentile(booking.patientSex, ageMo, "height", h);
      if (p != null) notes.push(`Height ≈ ${p}th %ile`);
    }
    if (Number.isFinite(hc)) {
      const p = estimatePercentile(booking.patientSex, ageMo, "hc", hc);
      if (p != null) notes.push(`HC ≈ ${p}th %ile`);
    }
    return notes;
  }
  const patientAgeYears = booking ? patientAge(booking.patientDob) : null;
  const clinicalBannerProps = {
    isPregnant: !!patientDetail?.is_pregnant,
    lmpDate: patientDetail?.lmp_date ?? null,
    gravida: patientDetail?.gravida ?? null,
    para: patientDetail?.para ?? null,
    rhFactor: patientDetail?.rh_factor ?? null,
    guardianName: patientDetail?.guardian_name ?? null,
    guardianRelationship: patientDetail?.guardian_relationship ?? null,
    ageYears: patientAgeYears,
  };
  const renalCue = renalCueText();
  const weightKgFromVitals = (() => {
    const n = Number.parseFloat(vitalFormValue(filledVitals, "weight"));
    return Number.isFinite(n) ? n : null;
  })();
  const nipDueRows = patientAgeMonths(booking?.patientDob ?? "") != null
    ? nipDueForAgeMonths(patientAgeMonths(booking!.patientDob)!)
    : [];
  const patientAgeMo = booking ? patientAgeMonths(booking.patientDob) : null;
  const nipStatusRows =
    patientAgeMo != null
      ? computeNipStatus(
          patientAgeMo,
          [
            ...patientVaxHistory.map((v) => v.vaccine_name),
            ...vaccinations.map((v) => v.vaccineName),
          ],
        )
      : [];
  const filteredSoapTemplates = useMemo(
    () => soapTemplates.filter((t) => matchesSpecialtyFilter("soap", t.title, soapSpecialtyFilter)),
    [soapTemplates, soapSpecialtyFilter],
  );
  const growthChartPoint = (() => {
    if (patientAgeMo == null) return [];
    const w = Number.parseFloat(vitalFormValue(filledVitals, "weight"));
    const h = Number.parseFloat(vitalFormValue(filledVitals, "height"));
    const hc = Number.parseFloat(vitalFormValue(filledVitals, "head", "hc"));
    const pt: { ageMonths: number; weight?: number; height?: number; hc?: number } = { ageMonths: patientAgeMo };
    if (Number.isFinite(w)) pt.weight = w;
    if (Number.isFinite(h)) pt.height = h;
    if (Number.isFinite(hc)) pt.hc = hc;
    return [pt];
  })();
  function patientIdentifierLine(b: ConsultationBooking): string {
    const age = patientAge(b.patientDob);
    return [
      b.patientCode || null,
      b.patientSex || null,
      b.patientDob ? `${formatDob(b.patientDob)}${age !== null ? ` (${age}y)` : ""}` : null,
    ].filter(Boolean).join(" · ");
  }
  const [mcDiagnosis, setMcDiagnosis] = useState("");
  const [mcRecommendations, setMcRecommendations] = useState("");
  const [mcPurposeException, setMcPurposeException] = useState("");
  const [mcComeBackOn, setMcComeBackOn] = useState("");
  const [certExists, setCertExists] = useState(false);
  const [issuingCert, setIssuingCert] = useState(false);
  const [certSavedAt, setCertSavedAt] = useState<string | null>(null);
  // Doctor's reusable "reason for the cert" text (managed in Settings).
  const [saveMcTplOpen, setSaveMcTplOpen] = useState(false);
  const [saveMcTplTitle, setSaveMcTplTitle] = useState("");

  //JJQR - AI (Nov 20, 2026) E4 — add-on follows a filled/issued certificate
  const medCertRequested = medCertFeeAddOn({
    certExists,
    recommendations: mcRecommendations,
    purposeException: mcPurposeException,
    comeBackOn: mcComeBackOn,
  });
  //JJQR - END

  //JJQR - AI (Nov 20, 2026) F3 — one total line; same math as the former inline previewFee
  const feePreview = feeSchedule
    ? computeClinicFee(feeSchedule, visitType, discountCategory, medCertRequested)
    : null;
  const previewFee = feePreview?.total ?? null;
  //JJQR - END

  //JJQR - AI (Nov 20, 2026) F5 — show/persist the Total as Charge amount when nothing is stored; editor state stays empty until she types or saves
  const pfAmountShown =
    previewFee !== null &&
    shouldPrefillChargeAmount(pfDecision, pfAmount, savedConsultation?.feeDecision?.type ?? null)
      ? String(previewFee)
      : pfAmount;
  //JJQR - END

  //JJQR - AI (Nov 20, 2026) E1 — diagnosis on the certificate follows diagnoses, then Assessment (no sync effect)
  const mcDiagnosisDefault = diagnosisTextFromConsult(
    diagnoses.map((d) => d.description),
    assessment,
  );
  const [mcDiagnosisDirty, setMcDiagnosisDirty] = useState(false);
  const mcDiagnosisField = !certExists && !mcDiagnosisDirty ? mcDiagnosisDefault : mcDiagnosis;
  //JJQR - END

  //JJQR - AI (Nov 20, 2026) E2 — templates never overwrite address, examined at, exam dates, patient/doctor, or diagnosis when diagnoses/Assessment exist
  function mcTemplateFieldPlan(template: MedicalCertificateTemplateRow) {
    const applyDx = shouldApplyTemplateDiagnosis(
      diagnoses.map((d) => d.description),
      assessment,
    );
    const rows = [
      ...(applyDx
        ? [{ label: "Diagnosis / Impressions", current: mcDiagnosisField, next: template.diagnosis_text ?? "", set: (v: string) => { setMcDiagnosisDirty(true); setMcDiagnosis(v); } }]
        : []),
      { label: "Recommendations", current: mcRecommendations, next: template.recommendations ?? "", set: setMcRecommendations },
      { label: "Purpose exception", current: mcPurposeException, next: template.purpose_exception ?? "", set: setMcPurposeException },
    ];
    return rows.filter((r) => r.next.trim() !== "");
  }
  function doApplyMcTemplate(template: MedicalCertificateTemplateRow) {
    mcTemplateFieldPlan(template).forEach((r) => r.set(r.next));
    setPendingMcTemplate(null);
  }
  function applyMcTemplate(template: MedicalCertificateTemplateRow) {
    const overwriting = mcTemplateFieldPlan(template).filter((r) => r.current.trim() !== "" && r.current.trim() !== r.next.trim());
    if (overwriting.length > 0) setPendingMcTemplate(template);
    else doApplyMcTemplate(template);
  }
  //JJQR - END

  // Single load effect: real booking (joined), consultation + diagnoses +
  // follow_up, last-visit SOAP + its vitals, this booking's own vital
  // readings (for the completion gate), soap_templates, and patient history.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      //JJQR - AI (Oct 31, 2026)
      setLoadError(null);
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 20_000);
      try {
      //JJQR - END
      const supabase = null as never;
      const bookingRow = await queryBookingById(supabase, bookingId);
      if (cancelled) return;
      if (!bookingRow) {
        return;
      }
      //JJQR - AI (Oct 31, 2026)
      const allergyRows = await queryPatientAllergies(supabase, bookingRow.patient_id).catch(() => [] as PatientAllergyRow[]);
      const [patientRow, labVals, vaxHistory, doctorRow] = await Promise.all([
        queryPatientById(supabase, bookingRow.patient_id).catch(() => null),
        queryPatientLabValues(supabase, bookingRow.patient_id),
        queryVaccinations(supabase, bookingRow.patient_id).catch(() => [] as VaccinationRow[]),
        queryDoctorById(supabase, bookingRow.doctor_id).catch(() => null),
      ]);
      if (!cancelled) {
        setPatientAllergies(allergyRows);
        setNkda(allergyRows.some((a) => a.is_nkda));
        setPatientDetail(patientRow);
        setPatientLabValues(labVals);
        setPatientVaxHistory(vaxHistory);
        //JJQR - AI (Nov 20, 2026) E1
        setDoctorProfile(doctorRow);
        patientAddressMissingRef.current = !(patientRow?.address ?? "").trim();
        setMcAddress(patientAddressFromProfile(patientRow?.address, patientRow?.city));
        //JJQR - END
        if (doctorRow?.specialization) {
          setSoapSpecialtyFilter(defaultSpecialtyFromDoctor(doctorRow.specialization));
        }
      }
      //JJQR - END
      const realBooking: ConsultationBooking = {
        id: bookingRow.booking_id,
        patientId: bookingRow.patient_id,
        patientName: [bookingRow.patients?.first_name, bookingRow.patients?.last_name].filter(Boolean).join(" "),
        patientCode: bookingRow.patients?.patient_code ?? "",
        patientSex: bookingRow.patients?.sex ?? "",
        patientDob: bookingRow.patients?.date_of_birth ?? "",
        doctorId: bookingRow.doctor_id,
        doctorName: bookingRow.doctors?.staff_accounts?.full_name ?? "",
        appointmentDate: bookingRow.appointment_date,
        totalFee: Number(bookingRow.total_fee),
        paymentStatus: bookingRow.payments?.status ?? "Not recorded",
        visitType: bookingRow.visit_type ?? "New",
        discountCategory: bookingRow.discount_category ?? "",
        medCertRequested: bookingRow.med_cert_requested ?? false,
      };

      const [consultRes, templates, vitalsRes, patientConsultsRes, rxRes] = await Promise.all([
        queryConsultationByBooking(supabase, bookingId).then((data) => ({ data })),
        queryVitalFieldTemplates(supabase),
        queryVitalReadings(supabase, { bookingId }).then((data) => ({ data })),
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
        queryRxGroups(supabase, { bookingId }).then((rows) => ({ data: rows[0] ?? null })),
      ]);
      if (cancelled) return;

      //JJQR - AI (Nov 19, 2026) - SOAP / diagnosis / certificate template lists now load via useTemplateLibrary (independent of this load)
      if (rxRes.data) {
        setPrescriptionGroup(mapRxGroup(rxRes.data));
      } else if (
        consultRes.data &&
        (consultRes.data.status === "Completed" || consultRes.data.status === "Amended")
      ) {
        //JJQR - AI (Oct 31, 2026) — completed no-Rx visits already passed the no-meds gate
        setNoMedsConfirmed(true);
        //JJQR - END
      }

      setVitalTemplates(
        templates.map((t) => ({ id: t.template_id, description: t.description, formKey: t.form_key, unit: t.unit, icon: t.icon, isDefault: t.is_default })),
      );
      setVitalReadings((vitalsRes.data ?? []).map((r) => ({ templateId: r.template_id, value: r.value })));
      //JJQR - END

      const patientConsults = (patientConsultsRes.data ?? [])
        .map((c) => {
          const b = Array.isArray(c.bookings) ? c.bookings[0] : c.bookings;
          return { consultationId: c.consultation_id, bookingId: c.booking_id, chiefComplaint: c.chief_complaint ?? "", appointmentDate: b?.appointment_date ?? "" };
        })
        .filter((c) => c.appointmentDate)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      const prior = patientConsults[0];
      if (prior) {
        const [priorRes, priorReadingsRes, priorRxRes] = await Promise.all([
          queryConsultationById(supabase, prior.consultationId).then((data) => ({ data })),
          queryVitalReadings(supabase, { bookingId: prior.bookingId }).then((data) => ({ data })),
          queryRxGroups(supabase, { bookingId: prior.bookingId }).then((rows) => ({ data: rows[0] ?? null })),
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
          //JJQR - AI (Oct 31, 2026)
          setPriorRxItems(priorRxRes.data ? mapRxGroup(priorRxRes.data).items : []);
          //JJQR - END
        }
        setLastVisitVitalReadings((priorReadingsRes.data ?? []).map((r) => ({ templateId: r.template_id, value: r.value })));
      } else {
        //JJQR - AI (Oct 31, 2026)
        setPriorRxItems([]);
        //JJQR - END
      }

      let loadedConsultation: Consultation | undefined;
      if (consultRes.data) {
        setConsultationId(consultRes.data.consultation_id);
        const [diagRes, followRes, vaxRows] = await Promise.all([
          queryDiagnoses(supabase, consultRes.data.consultation_id).then((data) => ({ data })),
          queryFollowUps(supabase, { consultationId: consultRes.data.consultation_id }).then((rows) => ({ data: rows[0] ?? null })),
          queryVaccinationsByConsultation(supabase, consultRes.data.consultation_id),
        ]);
        const vaccinationsLoaded = vaxRows.map((v) => ({
          vaccineName: v.vaccine_name,
          doseNumber: v.dose_number != null ? String(v.dose_number) : "",
          route: v.route ?? "",
          site: v.site ?? "",
          lotNumber: v.lot_number ?? "",
          expiry: v.expiry_date ?? "",
          manufacturer: v.manufacturer ?? "",
        }));
        const feeDecisionLoaded =
          consultRes.data.pf_decision === "Charge"
            ? { type: "Charge" as const, amount: consultRes.data.pf_amount ?? undefined }
            : consultRes.data.pf_decision === "Waive"
              ? { type: "Waive" as const, waiveReason: consultRes.data.pf_waive_reason ?? "" }
              : undefined;
        const diagnosesLoaded: Diagnosis[] = (diagRes.data ?? []).map((d) => ({
          code: d.icd10_code ?? "—",
          description: d.custom_description ?? "",
          type: d.type as Diagnosis["type"],
          //JJQR - AI (Oct 31, 2026)
          icd10Code: d.icd10_code ?? null,
          //JJQR - END
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
          vaccinationsAdministered: vaccinationsLoaded,
          feeDecision: feeDecisionLoaded,
          followUpDate: followRes.data?.follow_up_date ?? undefined,
          followUpReason: followRes.data?.reason ?? undefined,
          followUpInstructions: followRes.data?.instructions ?? undefined,
          followUpReminder: followRes.data?.reminder_enabled ?? true,
        };
        if (consultRes.data.status === "Completed" || consultRes.data.status === "Amended") {
          //JJQR - AI (Oct 31, 2026) — F-010: no beforeunload on finalized records
          consultationFinalizedRef.current = true;
          // Completed/amended records open in read-only view unless URL forces another mode.
          if (!searchParams.get("mode")) {
            setMode("view");
          }
          //JJQR - END
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
      setVisitType(realBooking.visitType);
      setStaffVisitType(realBooking.visitType);
      setDiscountCategory(realBooking.discountCategory);
      queryClinicSettings(supabase)
        .then((s) => {
          if (!cancelled && s) {
            setClinicRow(s);
            setFeeSchedule({
              consultation: s.fee_consultation,
              followUp: s.fee_follow_up,
              seniorPwd: s.fee_senior_pwd,
              medCert: s.fee_med_cert,
              discountPct: s.discount_pct,
            });
            //JJQR - AI (Nov 20, 2026) E1 — keep a saved certificate's examined-at if already hydrated
            setMcExaminedAt((prev) => prev || examinedAtFromClinic(s.clinic_name, s.address));
            //JJQR - END
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
        followUpExisted.current = Boolean(loadedConsultation.followUpDate);
        if ((loadedConsultation.followUpReason ?? "").includes("PRN")) {
          setFollowUpMode("prn");
        } else if (!loadedConsultation.followUpDate && !loadedConsultation.followUpReason) {
          //JJQR - AI (Nov 20, 2026) - B-40: a visit that was completed/amended with no follow-up passed the "No follow-up for this visit" gate; restore that choice
          // so amend mode doesn't re-open with Follow-up unsatisfied (which left Save amendment / Review disabled with no reason)
          if (consultRes.data?.status === "Completed" || consultRes.data?.status === "Amended") {
            setFollowUpMode("none");
            setNoFollowUpConfirmed(true);
          } else {
            setFollowUpMode("dated");
          }
          //JJQR - END
        } else {
          setFollowUpMode("dated");
        }
        setVaccinations(toVaxDraft(loadedConsultation.vaccinationsAdministered));
        const fd = loadedConsultation.feeDecision;
        //JJQR - AI (Nov 20, 2026) F4 F5 — restore Charge/Waive as stored; null becomes Charge in the editor only
        setPfDecision(pfEditorDecisionFromStored(fd));
        setPfAmount(pfEditorAmountFromStored(fd));
        setPfWaiveReason(fd?.type === "Waive" ? (fd.waiveReason ?? "") : "");
        //JJQR - END
      }

      // §16.8 Form 3 — lab-test catalog + any lab orders already on this booking.
      queryLabTestCatalog(supabase).then((rows) => { if (!cancelled) setLabCatalog(rows); }).catch(() => {});
      queryLabOrdersByBooking(supabase, bookingId)
        .then((rows) => {
          if (cancelled || rows.length === 0) return;
          setLabOrders(
            rows.map((r) => ({
              labTestId: r.lab_test_id,
              testName: r.test_name,
              reason: r.clinical_indication ?? "",
              specimenType: r.specimen_type ?? "",
              notes: r.notes ?? "",
            })),
          );
        })
        .catch(() => {});

      // §16.8 Form 2 — hydrate an already-issued certificate if there is one.
      const consultId = consultRes.data?.consultation_id;
      if (consultId) {
        queryMedicalCertificateByConsultation(supabase, consultId)
          .then((mc) => {
            if (cancelled || !mc) return;
            setCertExists(true);
            setMcAddress(mc.patient_address_snapshot ?? "");
            setMcExaminedAt(mc.examined_at ?? "");
            setMcExamFrom(mc.examination_date_from ?? "");
            setMcExamTo(mc.examination_date_to ?? "");
            setMcDiagnosis(mc.diagnosis_text ?? "");
            setMcDiagnosisDirty(true);
            setMcRecommendations(mc.recommendations ?? "");
            setMcPurposeException(mc.purpose_exception ?? "");
            setMcComeBackOn(mc.come_back_on ?? "");
          })
          .catch(() => {});
      }
      //JJQR - AI (Oct 31, 2026)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load consultation data.");
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoaded(true);
      }
      //JJQR - END
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookingId, loadAttempt]);

  function applyFollowUpMode(mode: "dated" | "prn" | "none") {
    setFollowUpMode(mode);
    if (mode === "prn") {
      setFollowUpDate(todayManila());
      setFollowUpReason("PRN / return if needed");
      if (!followUpInstructions.trim()) {
        setFollowUpInstructions("PRN — return if symptoms recur");
      }
      setNoFollowUpConfirmed(false);
    } else if (mode === "none") {
      setFollowUpDate("");
      setFollowUpReason("");
      setFollowUpInstructions("");
      setFollowUpReminder(false);
    } else {
      setNoFollowUpConfirmed(false);
    }
    formDirtyRef.current = true;
  }



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
    false,
    certExists,
    pfDecision !== null && (pfDecision === "charge" ? pfAmountShown.trim() !== "" : pfWaiveReason.trim().length >= 5),
  ];
  const rxSatisfied = sectionSatisfied[3] || noMedsConfirmed;
  const followUpSatisfied =
    followUpMode === "dated"
      ? followUpDate.trim() !== ""
      : followUpMode === "prn"
        ? true
        : noFollowUpConfirmed;
  sectionSatisfied[6] = followUpSatisfied;

  function isRequiredSectionDone(i: number): boolean {
    if (i === 3) return rxSatisfied;
    if (i === 6) return followUpSatisfied;
    return sectionSatisfied[i];
  }

  const missingRequiredSections = REQUIRED_SECTIONS.filter((i) => !isRequiredSectionDone(i));
  //JJQR - AI (Nov 20, 2026) - B-40: say WHICH section is missing wherever Save / Review / Complete is disabled
  const missingSectionNames = missingRequiredSections.map((i) => SECTIONS[i]).join(", ");
  //JJQR - END
  const sectionHasDraft = [
    false,
    false,
    false,
    false,
    newLab.testName.trim() !== "",
    newVax.vaccineName.trim() !== "",
    followUpReason.trim() !== "" || followUpInstructions.trim() !== "" || followUpMode !== "dated",
    mcDiagnosis.trim() !== "" || mcRecommendations.trim() !== "" || mcAddress.trim() !== "",
    pfDecision !== null,
  ];
  const allergyAckRequired = allergiesNeedPrescriptionReview(nkda, patientAllergies);
  function sectionStatus(i: number): SectionStatus {
    const satisfied = i === 3 ? rxSatisfied : i === 6 ? followUpSatisfied : sectionSatisfied[i];
    //JJQR - AI (Nov 19, 2026) - empty circle until the doctor tries to complete; only then the warning
    return stepIndicator({ satisfied, required: REQUIRED_SECTIONS.includes(i), hasDraft: sectionHasDraft[i], attemptedComplete: completeAttempted });
    //JJQR - END
  }

  // Sections with a fixed set of fields (SOAP, Vital Signs, Follow-up) show a
  // live "filled/total" count while in progress instead of a static icon —
  // list-based sections (Diagnosis/Prescription/Lab/Vaccinations/PF Decision)
  // keep the plain icon status since they don't have a fixed field count.
  const FRACTION_FIELDS: Partial<Record<number, string[]>> = {
    0: [chiefComplaint, subjective, objective, assessment, plan],
    1: defaultVitalTemplates.map((t) => filledVitals[t.formKey] ?? ""),
    6:
      followUpMode === "dated"
        ? [followUpDate, followUpReason, followUpInstructions]
        : followUpMode === "prn"
          ? [followUpReason, followUpInstructions]
          : noFollowUpConfirmed
            ? ["confirmed"]
            : [],
  };

  function renderSectionIndicator(i: number, className: string) {
    const fields = FRACTION_FIELDS[i];
    if (fields) {
      const filled = fields.filter((f) => (f ?? "").trim() !== "").length;
      if (filled === 0) {
        //JJQR - AI (Nov 19, 2026)
        if (completeAttempted && REQUIRED_SECTIONS.includes(i) && !isRequiredSectionDone(i)) {
          return <Icon name="warning" className={cn(className, "text-status-warning")} />;
        }
        //JJQR - END
        return <Icon name="radio_button_unchecked" className={cn(className, "text-on-surface-variant")} />;
      }
      if (filled === fields.length) {
        return <Icon name="check_circle" className={cn(className, "text-status-success")} />;
      }
      return (
        <span
          title={`${filled} of ${fields.length} fields filled in this section`}
          aria-label={`${filled} of ${fields.length} fields filled`}
          className={cn("inline-flex shrink-0 items-center justify-center px-xs text-label-md font-semibold tabular-nums text-status-info", className)}
        >
          {filled}/{fields.length}
        </span>
      );
    }
    const status = sectionStatus(i);
    return <Icon name={STATUS_ICON[status].icon} className={cn(className, STATUS_ICON[status].cls)} />;
  }

  // Doctor.md's "Required fields to complete a consultation" section is
  // explicit: Chief Complaint, >=1 diagnosis, BP, HR — "everything else
  // (...PF decision) is optional/recommended." This previously also gated on
  // Professional Fee Decision, contradicting that section outright.
  const canComplete =
    sectionSatisfied[0] &&
    sectionSatisfied[1] &&
    sectionSatisfied[2] &&
    rxSatisfied &&
    followUpSatisfied;

  //JJQR - AI (Oct 31, 2026)
  const assessmentDiagnosisMismatch = useMemo(
    () => showAssessmentDiagnosisMismatchHint(diagnoses, assessment),
    [diagnoses, assessment],
  );
  //JJQR - END

  // Shared header-row Save for every section that has no save of its own
  // (Vitals, Prescription, Lab Orders and Medical Certificate already have
  // one) — saves everything currently on the page as a Draft (or, in amend
  // mode, as the Amended record) without moving the consultation to
  // Completed. Sits at the top-right of the section, in the same slot as
  // SOAP's "Use Template…"/"Save as Template" row — visible only while that
  // section is open, since it's the first thing rendered inside it. Opens
  // the review modal scoped to *this* section — the write underneath always
  // persists the whole record, but the doctor only sees the fields for the
  // section they clicked Save on.
  //JJQR - AI (Nov 20, 2026) C4 C5
  function renderSectionSaveHeader() {
    if (!inlineSaved && !(mode === "amend" && !canComplete && missingSectionNames)) return null;
    return (
      <div className="flex items-center justify-end gap-sm">
        {inlineSaved && (
          <p className="text-label-sm text-on-surface-variant" data-testid="consult-inline-saved">Saved</p>
        )}
        {/* JJQR - AI (Nov 20, 2026) - B-40: the button is locked until every required section is done; name what is missing */}
        {mode === "amend" && !canComplete && missingSectionNames && (
          <p role="status" className="text-label-md text-status-warning">Finish {missingSectionNames} to save changes.</p>
        )}
        {/* JJQR - END */}
      </div>
    );
  }
  //JJQR - END

  function buildConsultationRecord(): Consultation {
    return {
      //JJQR - AI (Oct 31, 2026) — avoid Date.now() impure call (eslint react-hooks/purity)
      id: consultationId ?? "draft",
      //JJQR - END
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
          ? { type: "Charge", amount: pfAmountShown.trim() === "" ? undefined : Number(pfAmountShown) }
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
  async function persistConsultation(
    status: "Draft" | "Completed" | "Amended",
    opts?: { medCertRequested?: boolean },
  ): Promise<string | null> {
    if (!booking) return null;
    const supabase = null as never;

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
        med_cert_requested: opts?.medCertRequested ?? medCertRequested,
        discount_category: discountCategory || null,
        // §16.6 — the doctor's PF call travels on the consultation row.
        pf_decision: pfDecision === "charge" ? "Charge" : pfDecision === "waive" ? "Waive" : null,
        pf_amount: pfDecision === "charge" ? Number(pfAmountShown) || null : null,
        pf_waive_reason: pfDecision === "waive" ? pfWaiveReason || null : null,
      });
    } catch {
      return null;
    }
    const savedId = saved.consultation_id;
    setConsultationId(savedId);

    await replaceDiagnoses(
      supabase,
      savedId,
      diagnoses.map((d) => ({
        //JJQR - AI (Oct 31, 2026)
        icd10_code: d.icd10Code ?? (d.code !== "—" ? d.code : null),
        //JJQR - END
        custom_description: d.description,
        type: toDiagnosisType(d),
      })),
    );

    if (followUpMode === "none" && noFollowUpConfirmed) {
      if (followUpExisted.current) {
        await deleteFollowUpByConsultation(supabase, savedId);
        followUpExisted.current = false;
      }
    } else {
      const effectiveDate =
        followUpMode === "prn" ? followUpDate.trim() || todayManila() : followUpDate.trim();
      if (effectiveDate) {
        await upsertFollowUpByConsultation(supabase, savedId, {
          patient_id: booking.patientId,
          doctor_id: booking.doctorId,
          follow_up_date: effectiveDate,
          reason: followUpReason || (followUpMode === "prn" ? "PRN / return if needed" : null),
          instructions:
            followUpInstructions ||
            (followUpMode === "prn" ? "PRN — return if symptoms recur" : null),
          reminder_enabled: followUpMode === "prn" ? false : followUpReminder,
          status: "Pending",
        });
        followUpExisted.current = true;
      } else if (followUpExisted.current) {
        // Only call DELETE when a follow-up actually existed at some point —
        // otherwise this is a guaranteed 404 on every single save.
        await deleteFollowUpByConsultation(supabase, savedId);
        followUpExisted.current = false;
      }
    }

    // §16.8 Form 3 — replace-all lab orders for this consultation.
    await replaceLabOrdersByConsultation(
      supabase,
      savedId,
      labOrders
        .filter((l) => l.testName.trim())
        .map((l) => ({
          lab_test_id: l.labTestId,
          test_name: l.testName.trim(),
          clinical_indication: l.reason || null,
          specimen_type: l.specimenType || null,
          notes: l.notes || null,
        })),
    );

    // Doctor.md §4 — the vaccinations staged this visit are a replace-all set,
    // keyed on the consultation (patient_vaccinations, Source = in-clinic).
    await replaceVaccinationsByConsultation(
      supabase,
      savedId,
      vaccinations
        .filter((v) => v.vaccineName.trim())
        .map((v) => ({
          vaccine_name: v.vaccineName.trim(),
          manufacturer: v.manufacturer || null,
          dose_number: v.doseNumber ? Number(v.doseNumber) || null : null,
          route: v.route || null,
          site: v.site || null,
          lot_number: v.lotNumber || null,
          expiry_date: v.expiry || null,
        })),
    );

    return savedId;
  }

  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState("");
  const draftSaveInFlight = useRef(false);
  async function handleSaveDraft() {
    if (draftSaveInFlight.current || consultationFinalizedRef.current) return;
    draftSaveInFlight.current = true;
    const snapshotBeingSaved = currentFormSnapshot();
    //JJQR - AI (Nov 20, 2026) C4
    const previousPayload = lastSavedPayloadRef.current ?? completeBaselineRef.current;
    if (previousPayload !== null && snapshotBeingSaved === previousPayload) {
      draftSaveInFlight.current = false;
      setSavingDraft(false);
      setInlineSaved(false);
      return;
    }
    //JJQR - END
    setSaveError("");
    setSavingDraft(true);
    try {
      const savedId = await persistConsultation("Draft");
      if (!savedId) throw new Error("Could not save the draft. Check your connection and try again.");
      completeBaselineRef.current = snapshotBeingSaved;
      lastSavedPayloadRef.current = snapshotBeingSaved;
      setSavedDraftSnapshot(snapshotBeingSaved);
      setDraftSavedAt(new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " PHT");
      setInlineSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the draft. Try again.");
    } finally {
      draftSaveInFlight.current = false;
      setSavingDraft(false);
    }
  }

  async function handleComplete() {
    setSaveError("");
    try {
      const savedId = await persistConsultation("Completed");
      if (!savedId) throw new Error("Could not complete the consultation. Check your connection and try again.");
      // The consultation row and the booking/queue row track status
      // separately — completing the clinical record does NOT by itself move
      // the booking off the queue. Staff's "Ready for Payment" list filters
      // on the booking's own status, so without this call a doctor could
      // finish a visit and it would just sit there, invisible to staff.
      const supabase = null as never;
      await updateQueueEntry(supabase, bookingId, "complete");
      setSavedConsultation(buildConsultationRecord());
      setChecklistOpen(false);
      //JJQR - AI (Oct 31, 2026) — F-010: clear dirty before success UI / navigation
      formDirtyRef.current = false;
      completeBaselineRef.current = currentFormSnapshot();
      consultationFinalizedRef.current = true;
      //JJQR - END
      setJustCompleted(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not complete the consultation. Try again.");
    }
  }

  // §16.8 Form 2 — save the certificate row (upsert on consultation) then print
  // it on the shared clinic letterhead. Requires a saved consultation.
  async function handleIssueMedCert(printAfter: boolean) {
    if (!booking || !clinicRow) return;
    setIssuingCert(true);
    const supabase = null as never;
    try {
      //JJQR - AI (Oct 31, 2026)
      const consultId = await persistConsultation(mode === "amend" ? "Amended" : "Draft", {
        medCertRequested: true,
      });
      if (!consultId) return;
      const today = todayManila();
      //JJQR - AI (Nov 20, 2026) E1 — persist a typed address onto the patient profile when none was on file
      const typedAddress = mcAddress.trim();
      if (typedAddress && patientAddressMissingRef.current) {
        try {
          await updatePatient(supabase, booking.patientId, { address: typedAddress });
          patientAddressMissingRef.current = false;
          setPatientDetail((p) => (p ? { ...p, address: typedAddress } : p));
        } catch {
          // Certificate still issues; profile write is best-effort.
        }
      }
      //JJQR - END
      const cert = {
        patient_id: booking.patientId,
        doctor_id: booking.doctorId,
        issue_date: today,
        patient_address_snapshot: typedAddress || null,
        examined_at: mcExaminedAt.trim() || examinedAtFromClinic(clinicRow.clinic_name, clinicRow.address),
        examination_date_from: mcExamFrom || today,
        examination_date_to: mcExamTo || mcExamFrom || today,
        diagnosis_text: mcDiagnosisField.trim() || null,
        recommendations: mcRecommendations || plan || null,
        purpose_exception: mcPurposeException || null,
        come_back_on: mcComeBackOn || followUpDate || null,
      };
      await upsertMedicalCertificateByConsultation(supabase, consultId, cert);
      setCertExists(true);
      setCertSavedAt(new Date().toLocaleTimeString());
      if (mode === "amend") setAmendSnapshot(currentFormSnapshot());
      if (!printAfter) return;
      //JJQR - END
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

  //JJQR - AI (Nov 20, 2026) E4 — clearing the certificate turns the fee add-on off
  async function handleRemoveCertificate() {
    if (issuingCert) return;
    setIssuingCert(true);
    const supabase = null as never;
    try {
      if (consultationId) {
        await deleteMedicalCertificateByConsultation(supabase, consultationId);
      }
      setCertExists(false);
      setMcRecommendations("");
      setMcPurposeException("");
      setMcComeBackOn("");
      setMcDiagnosis("");
      setMcDiagnosisDirty(false);
      setMcAddress(patientAddressFromProfile(patientDetail?.address, patientDetail?.city));
      setMcExaminedAt(examinedAtFromClinic(clinicRow?.clinic_name, clinicRow?.address));
      const today = todayManila();
      setMcExamFrom(today);
      setMcExamTo(today);
      setCertSavedAt(null);
      await persistConsultation(mode === "amend" ? "Amended" : "Draft", { medCertRequested: false });
    } finally {
      setIssuingCert(false);
    }
  }
  //JJQR - END

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
    const snap = currentFormSnapshot();
    setAmendSnapshot(snap);
    lastSavedPayloadRef.current = snap;
    setMode("amend");
  }

  //JJQR - AI (Nov 20, 2026) F1 — completed summary Edit opens section 9 in amend (even if behind More)
  function openProfessionalFeeForEdit() {
    setJustCompleted(false);
    enterAmendMode();
    goToSection(8);
  }
  //JJQR - END

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
    //JJQR - AI (Nov 20, 2026) F5 — cancel-amend restores stored Charge/Waive; null stored → Charge editor default
    setPfDecision(pfEditorDecisionFromStored(source?.feeDecision));
    //JJQR - AI (Nov 20, 2026) F4 — cancel-amend restores the stored amount, not booking.totalFee
    setPfAmount(pfEditorAmountFromStored(source?.feeDecision));
    setPfWaiveReason(source?.feeDecision?.type === "Waive" ? (source.feeDecision.waiveReason ?? "") : "");
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

  //JJQR - AI (Oct 31, 2026) — section/Ctrl+S saves persist without leaving amend
  async function persistAmendProgress(): Promise<boolean> {
    if (!canComplete || !booking) return false;
    //JJQR - AI (Nov 20, 2026) C4
    const snapshotBeingSaved = currentFormSnapshot();
    const previousPayload = lastSavedPayloadRef.current ?? amendSnapshot;
    if (previousPayload !== null && snapshotBeingSaved === previousPayload) {
      setInlineSaved(false);
      return true;
    }
    //JJQR - END
    setSaveError("");
    setSavingChanges(true);
    try {
      const savedId = await persistConsultation("Amended");
      if (!savedId) throw new Error("Could not save your changes. Check your connection and try again.");
      setSavedConsultation(buildConsultationRecord());
      setAmendmentHistory((prev) => [
        { timestamp: new Date().toLocaleString(), author: booking.doctorName, section: "Consultation amended" },
        ...prev,
      ]);
      lastSavedPayloadRef.current = snapshotBeingSaved;
      setAmendSnapshot(snapshotBeingSaved);
      setAmendSavedAt(new Date().toLocaleTimeString());
      setInlineSaved(true);
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save your changes. Try again.");
      return false;
    } finally {
      setSavingChanges(false);
    }
  }

  async function handleSaveChanges() {
    const ok = await persistAmendProgress();
    if (ok) {
      setAmendSnapshot(null);
      setMode("view");
    }
  }
  //JJQR - END

  const latestDraftSave = useRef(handleSaveDraft);
  const latestAmendSave = useRef(persistAmendProgress);
  useEffect(() => {
    latestDraftSave.current = handleSaveDraft;
    latestAmendSave.current = persistAmendProgress;
  });

  // Doctor.md §4: Ctrl+1..9 jump, Ctrl+S save, Ctrl+Enter complete, `?` help.
  useEffect(() => {
    if (mode === "view") return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable = !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        setInlineSaved(false);
        if (OCCASIONAL_SECTIONS.includes(idx as (typeof OCCASIONAL_SECTIONS)[number])) setShowOccasional(true);
        setOpenSection(idx);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (mode === "complete") void latestDraftSave.current();
        else void latestAmendSave.current();
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
  }, [mode, canComplete]);

  //JJQR - AI (Nov 20, 2026) C6
  useEffect(() => {
    function onHash() {
      const m = window.location.hash.match(/^#section-(\d+)$/i);
      const idx = parseConsultSectionParam(m?.[1]);
      if (idx === null) return;
      setInlineSaved(false);
      if (OCCASIONAL_SECTIONS.includes(idx as (typeof OCCASIONAL_SECTIONS)[number])) setShowOccasional(true);
      setOpenSection(idx);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  //JJQR - END

  //JJQR - AI (Oct 31, 2026) — F-010 beforeunload, F-022 autosave
  useEffect(() => {
    if (loaded && mode === "complete" && completeBaselineRef.current === null) {
      const baseline = currentFormSnapshot();
      completeBaselineRef.current = baseline;
      lastSavedPayloadRef.current = baseline;
      queueMicrotask(() => setSavedDraftSnapshot(baseline));
    }
  });

  useEffect(() => {
    if (!loaded) return;
    if (justCompleted || mode === "view" || consultationFinalizedRef.current) {
      formDirtyRef.current = false;
      return;
    }
    const dirty =
      mode === "amend"
        ? isDirty
        : completeBaselineRef.current !== null && currentFormSnapshot() !== completeBaselineRef.current;
    formDirtyRef.current = dirty;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (formDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  });

  useEffect(() => {
    if (mode !== "complete" || !loaded || !booking) return;
    const timer = setInterval(() => {
      if (formDirtyRef.current && !draftSaveInFlight.current && !consultationFinalizedRef.current) void latestDraftSave.current();
    }, 30_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loaded, booking?.id]);
  //JJQR - END

  if (!loaded) {
    return (
      <AppShell role="doctor">
        <div className="space-y-md">
          {/* JJQR - AI (Oct 31, 2026) — F-024 */}
          {loadError && (
            <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-error/30 bg-error/5 px-md py-sm">
              <p className="text-body-md text-error">{loadError}</p>
              <Button variant="secondary" onClick={() => { setLoaded(false); setLoadAttempt((n) => n + 1); }}>
                Retry
              </Button>
            </div>
          )}
          {/* JJQR - END */}
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </AppShell>
    );
  }
  if (!booking) notFound();

  if (justCompleted) {
    const labCount = labOrders.filter((l) => l.testName.trim()).length;
    const rxCount = prescriptionGroup?.items.length ?? 0;
    const followUpSummary =
      followUpMode === "none" && noFollowUpConfirmed
        ? "No follow-up"
        : followUpMode === "prn"
          ? `PRN — ${followUpReason || "return if needed"}`
          : followUpDate
            ? `${followUpDate}${followUpReason ? ` — ${followUpReason}` : ""}`
            : "Not set";
    return (
      <AppShell role="doctor">
        <div className="mx-auto max-w-[40rem] space-y-lg">
          <div className="flex flex-col gap-sm rounded-lg bg-status-success-surface px-md py-sm text-status-success sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-sm text-label-md">
              <Icon name="check_circle" />
              Consultation saved
            </span>
            <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
              {consultPrintButtons("flex flex-col gap-sm sm:flex-row")}
              <Link href="/doctor/dashboard" className={buttonStyles("secondary", "min-h-[44px] w-full sm:w-auto")}>
Back to Queue
</Link>
              <Link href="/doctor/dashboard" className={buttonStyles("primary", "min-h-[44px] w-full sm:w-auto")}>
Return to patient queue
</Link>
            </div>
          </div>
          <Card className="space-y-sm text-body-md text-on-surface-variant">
            <p className="text-body-md text-on-surface">
              <strong>Patient:</strong> {booking.patientName || "—"}
              {patientIdentifierLine(booking) ? ` · ${patientIdentifierLine(booking)}` : ""}
            </p>
            <p><strong>Chief Complaint:</strong> {chiefComplaint || "—"}</p>
            <p><strong>Diagnoses:</strong> {diagnoses.length ? diagnoses.map((d) => d.description).join(", ") : "—"}</p>
            <p><strong>Prescriptions:</strong> {rxCount} line{rxCount === 1 ? "" : "s"}</p>
            <p><strong>Lab orders:</strong> {labCount}</p>
            <p><strong>Follow-up:</strong> {followUpSummary}</p>
          </Card>
          {/*JJQR - AI (Nov 20, 2026) F1 — read-only PF line; Edit opens section 9 */}
          <p className="text-body-md text-on-surface">
            {formatProfessionalFeeLine({ decision: pfDecision, amount: pfAmountShown, waiveReason: pfWaiveReason, computedTotal: previewFee })}{" "}
            <button
              type="button"
              onClick={openProfessionalFeeForEdit}
              className="text-label-md text-primary underline-offset-2 hover:underline"
            >
              Edit
            </button>
          </p>
          {/*JJQR - END */}
        </div>
      </AppShell>
    );
  }

  if (mode === "view") {
    const sc = savedConsultation;
    return (
      <AppShell role="doctor">
        {/* JJQR - AI (Oct 31, 2026) — completed view: banner in same 40rem column as cards */}
        <div className="mx-auto w-full max-w-doctor-record space-y-lg">
        <ConsultPatientBanner
        className="!shadow-none tabular-nums"
          patientName={booking.patientName}
          patientCode={booking.patientCode}
          patientSex={booking.patientSex}
          patientDob={booking.patientDob}
          paymentStatus={booking.paymentStatus}
          allergies={patientAllergies}
          nkda={nkda}
          mode="view"
          contentClassName="max-w-none w-full"
          onToggleNkda={(next) => {
            setNkda(next);
            void persistAllergies(next ? [] : patientAllergies.filter((a) => !a.is_nkda), next);
          }}
          onAddAllergy={(allergen) => {
            const next = [
              ...patientAllergies.filter((a) => !a.is_nkda),
              {
                id: `local-${Date.now()}`,
                patient_id: booking.patientId,
                allergen,
                reaction: null,
                severity: null,
                is_nkda: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ];
            setPatientAllergies(next);
            setNkda(false);
            void persistAllergies(next, false);
          }}
          onRemoveAllergy={(index) => {
            const filtered = patientAllergies.filter((a) => !a.is_nkda);
            const next = filtered.filter((_, i) => i !== index);
            setPatientAllergies(next);
            void persistAllergies(next, false);
          }}
          {...clinicalBannerProps}
        />
        <div className="space-y-lg">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <div>
              <div className="flex flex-wrap items-center gap-sm">
                <h1 className="text-balance text-headline-lg font-semibold text-on-surface">Consultation record</h1>
              </div>
              {patientIdentifierLine(booking) && (
                <p className="text-label-sm text-on-surface-variant">{patientIdentifierLine(booking)}</p>
              )}
              <p className="text-label-md text-on-surface-variant">
                Completed {booking.appointmentDate} by {booking.doctorName}
              </p>
            </div>
            <div className="flex flex-wrap gap-sm">
              {consultPrintButtons()}
              <Button variant="secondary" onClick={() => setAmendHistoryOpen(true)}>
                History
              </Button>
              <Button onClick={enterAmendMode}>Edit Consultation</Button>
            </div>
          </div>
          {sc && (
            <>
              <Card className="space-y-md text-body-md leading-relaxed text-on-surface">
                <h2 className="text-headline-md font-semibold">Clinical note</h2>
                <p><strong>Chief Complaint:</strong> {sc.chiefComplaint || "Not recorded."}</p>
                <p><strong>Subjective:</strong> {sc.subjective || "Not recorded."}</p>
                <p><strong>Objective:</strong> {sc.objective || "Not recorded."}</p>
                <p><strong>Assessment:</strong> {sc.assessment || "Not recorded."}</p>
                <p><strong>Plan:</strong> {sc.plan || "Not recorded."}</p>
              </Card>
              <Card>
                <h2 className="mb-md text-headline-sm font-semibold text-on-surface">Vital Signs</h2>
                {vitalReadings.length > 0 ? <dl className="grid grid-cols-2 gap-lg sm:grid-cols-3">{defaultVitalTemplates.map(t => <div key={t.id}><dt className="text-label-md text-on-surface-variant">{t.description}</dt><dd className="mt-xs text-body-lg font-medium tabular-nums text-on-surface">{filledVitals[t.formKey] ? `${filledVitals[t.formKey]}${t.unit ? ` ${t.unit}` : ""}` : "Not recorded"}</dd></div>)}</dl> : <p className="text-body-md text-on-surface-variant">No vitals recorded.</p>}
              </Card>
              <Card>
                <h2 className="mb-md text-headline-sm font-semibold text-on-surface">Diagnoses</h2>
                <p className="text-body-md text-on-surface-variant">
                  {sc.diagnoses.length > 0 ? sc.diagnoses.map((d) => `${d.description} (${d.type})`).join(", ") : "No diagnoses recorded."}
                </p>
              </Card>
              <Card>
                <h2 className="mb-md text-headline-sm font-semibold text-on-surface">Prescriptions</h2>
                {prescriptionGroup && prescriptionGroup.items.length > 0 ? (
                  <div className="space-y-xs">
                    {prescriptionGroup.items.map((rx, i) => (
                      <p key={rx.id} className="text-body-md text-on-surface-variant">
                        {i + 1}. {rx.genericName} #{rx.quantity} — Sig. {rx.dosage} {rx.instruction}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">No prescriptions recorded.</p>
                )}
              </Card>
              <Card>
                <h2 className="mb-md text-headline-sm font-semibold text-on-surface">Lab Orders</h2>
                {sc.labOrders && sc.labOrders.length > 0 ? (
                  <div className="space-y-xs">
                    {sc.labOrders.map((lab, i) => (
                      <p key={i} className="text-body-md text-on-surface-variant">
                        {lab.testName} — {lab.reason}{lab.specimenType ? ` (${lab.specimenType})` : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">No lab orders recorded.</p>
                )}
              </Card>
              <Card>
                <h2 className="mb-md text-headline-sm font-semibold text-on-surface">Vaccinations</h2>
                {sc.vaccinationsAdministered && sc.vaccinationsAdministered.length > 0 ? (
                  <div className="space-y-xs">
                    {sc.vaccinationsAdministered.map((v, i) => (
                      <p key={i} className="text-body-md text-on-surface-variant">
                        {v.vaccineName} — Dose #{v.doseNumber}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-md text-on-surface-variant">No vaccinations recorded.</p>
                )}
              </Card>
              <Card>
                <h2 className="mb-md text-headline-sm font-semibold text-on-surface">Follow-up</h2>
                <p className="text-body-md text-on-surface-variant">
                  {sc.followUpDate ? `${sc.followUpDate} — ${sc.followUpReason ?? ""}${sc.followUpInstructions ? ` (${sc.followUpInstructions})` : ""}${sc.followUpReminder ? " · reminder on" : ""}` : "No follow-up recorded."}
                </p>
              </Card>
              {/*JJQR - AI (Nov 20, 2026) F1 F5 — read-only line uses the stored decision (Decide at desk when null) */}
              <p className="text-body-md text-on-surface">
                {formatProfessionalFeeLine({
                  decision: pfViewDecisionFromStored(sc.feeDecision),
                  amount: pfEditorAmountFromStored(sc.feeDecision),
                  waiveReason: sc.feeDecision?.type === "Waive" ? (sc.feeDecision.waiveReason ?? "") : "",
                  computedTotal: previewFee,
                })}{" "}
                <button
                  type="button"
                  onClick={openProfessionalFeeForEdit}
                  className="text-label-md text-primary underline-offset-2 hover:underline"
                >
                  Edit
                </button>
              </p>
              {/*JJQR - END */}
            </>
          )}
        </div>
        </div>
        {/* JJQR - END */}

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
      {/* JJQR - AI (Oct 31, 2026) — F-002 sticky patient banner */}
      <ConsultPatientBanner
        className="!shadow-none tabular-nums"
        patientName={booking.patientName}
        patientCode={booking.patientCode}
        patientSex={booking.patientSex}
        patientDob={booking.patientDob}
        paymentStatus={booking.paymentStatus}
        allergies={patientAllergies}
        nkda={nkda}
        mode={mode}
        onToggleNkda={(next) => {
          setNkda(next);
          void persistAllergies(next ? [] : patientAllergies.filter((a) => !a.is_nkda), next);
        }}
        onAddAllergy={(allergen) => {
          const next = [
            ...patientAllergies.filter((a) => !a.is_nkda),
            {
              id: `local-${Date.now()}`,
              patient_id: booking.patientId,
              allergen,
              reaction: null,
              severity: null,
              is_nkda: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
          setPatientAllergies(next);
          setNkda(false);
          void persistAllergies(next, false);
        }}
        onRemoveAllergy={(index) => {
          const filtered = patientAllergies.filter((a) => !a.is_nkda);
          const next = filtered.filter((_, i) => i !== index);
          setPatientAllergies(next);
          void persistAllergies(next, false);
        }}
        {...clinicalBannerProps}
      />
      {/* JJQR - END */}
      <div className="consultation-workspace min-w-0 space-y-lg">
        {mode === "amend" && (
          <Toast variant="info" message="Manual save only — autosave is off in amend mode." dismissible={false} />
        )}
        {saveError && <Toast key={saveError} variant="error" message={saveError} />}
        {/*JJQR - AI (Nov 19, 2026) - template save/apply notices + SOAP template Undo */}
        {tplNotice && <Toast key={tplNotice.id} variant={tplNotice.variant} message={tplNotice.message} />}
        {templateUndo && undoAvailable && (
          <Toast key={templateUndo.id} variant="info" message={`Applied “${templateUndo.title}”.`} actionLabel="Undo" onAction={undoTemplateApply} />
        )}
        {/*JJQR - END */}

        {/* JJQR - AI (Nov 20, 2026) C4 — no green Saved banner; footer + inline Saved after a real change */}

        <div className="flex flex-wrap items-center justify-between gap-md">
          <div>
            {/* JJQR - AI (Oct 31, 2026) — patient identity moved to ConsultPatientBanner */}
            <div className="flex flex-wrap items-center gap-sm">
              <h1 className="text-balance text-headline-lg font-semibold text-on-surface">{mode === "amend" ? "Amend consultation" : "Document consultation"}</h1>
            </div>
            {/* JJQR - END */}
            {/* Noticeable, and reversible — staff's New/Follow-up tag from
                check-in drives the fee, so the doctor needs to see it without
                digging into §9, and can flip it right here if it's wrong. */}
            <div className="mt-xs flex flex-wrap items-center gap-sm">
              {(["New", "FollowUp"] as const).map((vt) => (
                <button
                  key={vt}
                  type="button"
                  aria-pressed={visitType === vt}
                  onClick={() => setVisitType(vt)}
                  className={cn(
                    "min-h-[44px] rounded-nav border px-md py-xs text-label-md font-medium",
                    visitType === vt
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant text-on-surface-variant",
                  )}
                >
                  {vt === "New" ? "New visit" : "Follow-up visit"}
                </button>
              ))}
              {staffVisitType && visitType !== staffVisitType && (
                <span className="text-label-sm text-on-surface-variant">
                  (staff tagged this {staffVisitType === "New" ? "New" : "Follow-up"} at check-in)
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-sm">
            <Button variant="secondary" className="!h-11 !min-h-11 !w-11 !px-0 !py-0" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts help">
              <Icon name="help" className="text-[18px]" />
            </Button>
            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
              View Patient History
            </Button>
            {((prescriptionGroup?.items.length ?? 0) > 0 || labOrders.length > 0) && consultPrintButtons()}
            {mode === "amend" && <Button variant="secondary" onClick={requestCancelAmend}>Cancel amendment</Button>}
          </div>
        </div>

        {/* JJQR - AI (Oct 31, 2026) — in-flow sections rail (no viewport-fixed overlap with AppShell sidebar) */}
        <div className="space-y-lg">
          <nav
            aria-label="Consultation sections"
            data-testid="consult-section-nav"
            className="flex flex-wrap gap-sm border-b border-outline-variant pb-md"
          >
            {visibleSectionOrder.map((i, displayIdx) => (
              <button
                key={SECTIONS[i]}
                type="button"
                onClick={() => goToSection(i)}
                aria-pressed={openSection === i}
                aria-controls={openSection === i ? `consultation-section-${i}` : undefined}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-xs rounded-nav border px-sm py-sm text-left text-label-md transition-colors motion-reduce:transition-none",
                  openSection === i ? "border-primary bg-primary/10 font-semibold text-primary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low",
                )}
              >
                {renderSectionIndicator(i, "mt-0.5 shrink-0 text-[16px]")}
                <span className="min-w-0 flex-1 whitespace-normal leading-snug">
                  {displayIdx + 1}. {SECTIONS[i]}
                </span>
              </button>
            ))}
            {/*JJQR - AI (Nov 20, 2026) C6 - Vaccinations + Professional Fee live behind "More" in every mode */}
            <button
              type="button"
              onClick={() => setShowOccasional((v) => !v)}
              aria-expanded={showOccasional}
              className="flex min-h-11 cursor-pointer items-center gap-xs rounded-nav border border-dashed border-outline-variant px-sm py-sm text-label-md text-on-surface-variant hover:bg-surface-container-low"
            >
              {showOccasional ? "Less" : "More"}
              <Icon name={showOccasional ? "expand_less" : "expand_more"} className="text-[16px]" aria-hidden />
            </button>
            {/*JJQR - END */}
          </nav>

        <div className="min-w-0 space-y-md pb-[max(16rem,env(safe-area-inset-bottom))] lg:pb-28 lg:pb-[max(7rem,env(safe-area-inset-bottom))]">
            {/* JJQR - AI (Oct 31, 2026) — F-011 mobile section progress */}

            {/* JJQR - END */}
            {visibleSectionOrder.map((i, displayIdx) => {
              const section = SECTIONS[i];
              const isOpen = openSection === i;
              if (!isOpen) return null;
              return (
                <Card key={section} id={`consultation-section-${i}`} className="consultation-panel">
                  <div
                    className="flex min-h-11 w-full items-center justify-between gap-md border-b border-outline-variant pb-md text-left"
                  >
                    <h2 className="flex flex-wrap items-center gap-sm text-headline-md font-semibold text-on-surface">
                      {renderSectionIndicator(i, "text-[18px]")}
                      {displayIdx + 1}. {section}
                      {REQUIRED_SECTIONS.includes(i) && (
                        <span className="sr-only">Required before completion</span>
                      )}
                    </h2>

                  </div>

                  {isOpen && i === 0 && (
                    <div className="mt-md space-y-md">

                      {/*JJQR - AI (Nov 20, 2026) C3 C5 - the template picker, Save as Template and Manage are always visible at the top of Clinical notes */}
                      <div className="flex flex-wrap items-center gap-sm border-b border-outline-variant pb-md">
                        <select
                            value=""
                            onChange={(e) => {
                              const t = filteredSoapTemplates.find((x) => x.id === e.target.value);
                              if (t) applyTemplate(t);
                            }}
                            aria-label="Use SOAP template"
                            className="min-h-[44px] w-full rounded-lg border border-primary bg-primary/10 px-md py-xs text-label-md font-semibold text-primary sm:w-auto"
                          >
                            <option value="">Use template…</option>
                            {filteredSoapTemplates.length === 0 && soapTemplates.length > 0 && (
                              <option value="__empty" disabled>
                                No templates for this specialty
                              </option>
                            )}
                            {soapTemplates.length === 0 && (
                              <option value="__empty" disabled>
                                {/*JJQR - AI (Nov 19, 2026) - don't claim "none yet" when the list failed to load */}
                                {templateLib.soap.status === "error" ? "Templates unavailable" : "No templates yet"}
                                {/*JJQR - END */}
                              </option>
                            )}
                            {filteredSoapTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                                {t.isSystemTemplate ? " (system)" : ""}
                              </option>
                            ))}
                          </select>
                        {templateLib.soap.status === "error" && (
                          <span role="status" className="text-label-sm text-status-warning">
                            SOAP templates couldn&apos;t load.{" "}
                            <button type="button" onClick={templateLib.soap.reload} className="font-medium underline">Retry</button>
                          </span>
                        )}
                        {templateLib.soap.status === "loading" && (
                          <span role="status" className="text-label-sm text-on-surface-variant">Loading templates…</span>
                        )}
                        <button type="button" onClick={openSaveTemplate} className="min-h-[44px] px-sm text-label-md text-primary hover:underline">
                          Save as Template
                        </button>
                        <Link
                          href={manageTemplatesHref("soap")}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Manage templates (opens in a new tab)"
                          className="inline-flex min-h-[44px] items-center px-sm text-label-md text-on-surface-variant hover:text-primary hover:underline"
                        >
                          Manage templates
                        </Link>
                      </div>
                      {/*JJQR - END */}
                      <details className="border-b border-outline-variant pb-sm"><summary className="text-label-md font-medium text-on-surface">Previous note and specialty filter</summary><div className="mt-md flex w-full flex-col gap-md">
                        {lastVisitSoap && (
                          <button
                            type="button"
                            onClick={() => setLastVisitOpen(true)}
                            className="text-left text-label-md text-primary hover:underline"
                          >
                            View Last Appointment SOAP
                          </button>
                        )}
                        <div className="flex w-full gap-xs overflow-x-auto pb-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {SPECIALTY_CHIP_LABELS.map(({ id, label }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setSoapSpecialtyFilter(id)}
                              className={cn(
                                "shrink-0 rounded-full border px-sm py-xs text-label-sm",
                                soapSpecialtyFilter === id
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div></details>
                      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
                        <ClinicalNoteField id="note-chiefComplaint" label="Chief complaint" hint="Reason for this visit, in the patient’s own words." value={chiefComplaint} onChange={setChiefComplaint} required tools={<SoapFieldToolbar doctorId={booking.doctorId} field="chiefComplaint" fieldLabel="Chief complaint" value={chiefComplaint} onInsert={setChiefComplaint} />} />
                        <ClinicalNoteField id="note-subjective" label="Subjective" hint="Symptoms, relevant history and patient-reported concerns." value={subjective} onChange={setSubjective} tools={<SoapFieldToolbar doctorId={booking.doctorId} field="subjective" fieldLabel="Subjective" value={subjective} onInsert={setSubjective} />} />
                        <ClinicalNoteField id="note-objective" label="Objective" hint="Examination findings and observed measurements." value={objective} onChange={setObjective} tools={<SoapFieldToolbar doctorId={booking.doctorId} field="objective" fieldLabel="Objective" value={objective} onInsert={setObjective} />} />
                        <ClinicalNoteField id="note-assessment" label="Assessment" hint="Clinical impression and diagnostic reasoning." value={assessment} onChange={setAssessment} tools={<SoapFieldToolbar doctorId={booking.doctorId} field="assessment" fieldLabel="Assessment" value={assessment} onInsert={setAssessment} />} />
                        <ClinicalNoteField id="note-plan" label="Plan" hint="Management, counselling and next steps." value={plan} onChange={setPlan} tools={<SoapFieldToolbar doctorId={booking.doctorId} field="plan" fieldLabel="Plan" value={plan} onInsert={setPlan} />} />
                      </div>
                      {assessmentDiagnosisMismatch && <p role="status" className="text-label-md text-status-warning">Assessment does not mention the primary diagnosis. Review the diagnosis if the visit reason changed.</p>}
                    </div>
                  )}

                  {isOpen && i === 1 && (
                    <div className="mt-md space-y-md">
                      {lastVisitVitalReadings.length > 0 && (
                        <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-sm text-on-surface-variant">
                          Last appointment ({lastVisitSoap!.appointmentDate}):{" "}
                          {defaultVitalTemplates
                            .map((t) => `${t.description} ${lastVisitVitalReadings.find((r) => r.templateId === t.id)?.value ?? "—"}${t.unit ? ` ${t.unit}` : ""}`)
                            .join(" · ")}
                        </p>
                      )}
                      {pedsVitalRangeNote(patientAgeYears) && (
                        <p className="text-label-sm text-on-surface-variant">{pedsVitalRangeNote(patientAgeYears)}</p>
                      )}
                      {growthPercentileNotes().length > 0 && (
                        <p className="text-label-sm text-primary">{growthPercentileNotes().join(" · ")}</p>
                      )}
                      {patientAgeYears != null && patientAgeYears < 18 && patientAgeMo != null && booking && (
                        <GrowthChart sex={booking.patientSex} ageMonths={patientAgeMo} points={growthChartPoint} />
                      )}
                      <VitalsEditor embedded bookingId={bookingId} patientId={booking.patientId} onSaved={reloadVitalReadings} />
                    </div>
                  )}

                  {isOpen && i === 2 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader()}
                      {assessmentDiagnosisMismatch && (
                        <p className="rounded-lg border border-status-warning-border bg-status-warning-surface px-md py-sm text-label-sm text-status-warning">
                          Assessment text doesn&apos;t mention the primary diagnosis — update Diagnosis if the visit reason changed.
                        </p>
                      )}
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

                      {/*JJQR - AI (Nov 20, 2026) C1 C2 C3 — one combobox + one Manage deep link */}
                      <div className="flex items-center justify-end">
                        <Link
                          href={manageTemplatesHref("diagnoses")}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Manage saved diagnoses (opens in a new tab)"
                          className="inline-flex min-h-[44px] shrink-0 items-center text-label-sm text-on-surface-variant hover:underline"
                        >
                          Manage
                        </Link>
                      </div>
                      <DiagnosisCombobox
                        saved={diagnosisTemplates}
                        onAdd={addDiagnosisLine}
                        onPickSaved={addSavedDiagnosisTemplate}
                        onSaveToMyDiagnoses={saveTypedDiagnosisToMyDiagnoses}
                      />
                      {/*JJQR - END */}
                    </div>
                  )}

                  {isOpen && i === 3 && (
                    <div className="mt-md space-y-md">
                      {rxSavedAt && <Toast key={rxSavedAt} variant="success" message={`Prescription saved at ${rxSavedAt}.`} />}
                      <label className="flex min-h-[44px] items-start gap-sm rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-body-md text-on-surface">
                        <input
                          type="checkbox"
                          className="mt-xs"
                          checked={noMedsConfirmed}
                          onChange={(e) => setNoMedsConfirmed(e.target.checked)}
                        />
                        <span>
                          <strong>No medicines this visit</strong>
                          <span className="block text-label-md text-on-surface-variant">
                            Only check if you are intentionally not prescribing. Required for Complete when the Rx list is empty.
                          </span>
                        </span>
                      </label>
                      {allergyAckRequired && !allergyReviewed && (
                        <div id="rx-allergy-review-banner" className="flex flex-col gap-sm rounded-lg border border-status-warning-border bg-status-warning-surface px-md py-sm sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-label-md text-status-warning">
                            Review allergies (NKDA or add) before prescribing.
                          </p>
                          <Button variant="secondary" className="min-h-[44px] shrink-0" onClick={() => setAllergyReviewed(true)}>
                            Acknowledge
                          </Button>
                        </div>
                      )}
                      {renalCue && (
                        <p className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-label-sm text-on-surface-variant">
                          {renalCue}
                        </p>
                      )}
                      <PrescriptionForm
                        key={rxVersion}
                        mode={prescriptionGroup ? "edit" : "create"}
                        patientId={booking.patientId}
                        doctorId={booking.doctorId}
                        bookingId={bookingId}
                        group={prescriptionGroup}
                        embedded
                        patientAllergies={patientAllergies.filter((a) => !a.is_nkda).map((a) => a.allergen)}
                        allergyAckRequired={allergyAckRequired}
                        allergyAcked={allergyReviewed}
                        //JJQR - AI (Oct 31, 2026) — soft banner above; do not auto-ack or jump sections
                        //JJQR - AI (Nov 19, 2026) - still no auto-ack; bring the banner into view so the doctor sees what to tap
                        onNeedAllergyAck={() => document.getElementById("rx-allergy-review-banner")?.scrollIntoView({ block: "center", behavior: "smooth" })}
                        //JJQR - END
                        priorRxItems={priorRxItems}
                        patientPregnant={!!patientDetail?.is_pregnant}
                        patientAgeYears={patientAgeYears}
                        weightKg={weightKgFromVitals}
                        //JJQR - END
                        onSaved={async () => {
                          const supabase = null as never;
                          const rows = await queryRxGroups(supabase, { bookingId });
                          if (rows[0]) setPrescriptionGroup(mapRxGroup(rows[0]));
                          setRxVersion((v) => v + 1);
                          setRxSavedAt(new Date().toLocaleTimeString());
                        }}
                      />
                    </div>
                  )}

                  {isOpen && i === 4 && (
                    <div className="mt-md space-y-md">
                      {labsSavedAt && <Toast key={labsSavedAt} variant="success" message={`Lab request saved at ${labsSavedAt}.`} />}

                      {renalCue && (
                        <p className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-label-sm text-on-surface-variant">
                          {renalCue}
                        </p>
                      )}

                      {labOrders.length > 0 && (
                        <div className="flex flex-wrap items-center justify-end gap-sm">
                          <Button variant="secondary" loading={printingLabs} disabled={!booking} onClick={() => void runPrintLabOrders()}>
                            <Icon name="print" className="text-[16px]" />
                            Print Lab Orders
                          </Button>
                          <Button variant="secondary" loading={savingLabs} disabled={!booking} onClick={() => setLabsConfirmPrint(true)}>
                            Save & Print Lab Request
                          </Button>
                          <Button variant="secondary" loading={savingLabs} disabled={!booking} onClick={() => setLabsConfirmPrint(false)}>
                            Save without printing
                          </Button>
                        </div>
                      )}

                      {/* §16.8 Form 3 — the pre-printed panel as checkboxes */}
                      {!!patientDetail?.is_pregnant && labCatalog.length > 0 && (
                        <div className="space-y-sm">
                          <p className="text-label-sm text-on-surface-variant">ANC lab presets</p>
                          <div className="flex flex-wrap gap-sm">
                            {ANC_PRESETS.map((p) => (
                              <Button key={p.id} variant="secondary" type="button" onClick={() => applyAncPreset(p.id)}>
                                {p.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                      {labCatalog.length > 0 && (
                        <div>
                          <p className="mb-xs text-label-sm text-on-surface-variant">Standard panel</p>
                          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
                            {labCatalog.map((t) => {
                              const checked = labOrders.some((l) => l.labTestId === t.lab_test_id);
                              return (
                                <label
                                  key={t.lab_test_id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-sm rounded-lg border px-md py-sm text-label-md",
                                    checked ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
                                  )}
                                >
                                  <input type="checkbox" checked={checked} onChange={() => toggleCatalogTest(t)} className="h-4 w-4" />
                                  {t.name}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* handwritten additions */}
                      {labOrders.some((l) => l.labTestId === null) && (
                        <div className="space-y-sm">
                          <p className="text-label-sm text-on-surface-variant">Additional tests</p>
                          {labOrders.map((lab, idx) =>
                            lab.labTestId === null ? (
                              <div key={idx} className="flex items-center justify-between rounded-lg border border-outline-variant p-md">
                                <span className="text-body-md">
                                  {lab.testName}
                                  {lab.reason ? ` — ${lab.reason}` : ""}
                                  {lab.specimenType ? ` (${lab.specimenType})` : ""}
                                </span>
                                <button type="button" onClick={() => removeLabOrder(idx)} className="text-on-surface-variant">
                                  <Icon name="close" className="text-[18px]" />
                                </button>
                              </div>
                            ) : null,
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Add another test</span><input placeholder="Add another test" value={newLab.testName} onChange={(e) => setNewLab({ ...newLab, testName: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Reason / clinical indication</span><input placeholder="Reason / clinical indication" value={newLab.reason} onChange={(e) => setNewLab({ ...newLab, reason: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Specimen type</span><input placeholder="Specimen type" value={newLab.specimenType} onChange={(e) => setNewLab({ ...newLab, specimenType: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Notes</span><input placeholder="Notes" value={newLab.notes} onChange={(e) => setNewLab({ ...newLab, notes: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                      </div>
                      <Button variant="secondary" onClick={addLabOrder} disabled={!newLab.testName.trim()}>Add test</Button>

                      {labOrders.length === 0 && (
                        <p className="text-label-md text-on-surface-variant">No tests selected (optional). Saved with the consultation.</p>
                      )}
                    </div>
                  )}

                  {isOpen && i === 5 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader()}
                      {nipStatusRows.length > 0 && (
                        <div className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm">
                          <p className="mb-sm text-label-md font-medium text-on-surface">NIP / EPI schedule</p>
                          <ul className="space-y-sm">
                            {nipStatusRows.map((row) => {
                              const tone: PillTone =
                                row.status === "given"
                                  ? "success"
                                  : row.status === "due"
                                    ? "info"
                                    : row.status === "upcoming"
                                      ? "neutral"
                                      : "warning";
                              const canGive = row.status === "due" || row.status === "overdue" || row.status === "catch-up";
                              return (
                                <li key={`${row.key}-${row.label}`} className="flex flex-wrap items-center justify-between gap-sm">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-label-sm text-on-surface">{row.label}</span>
                                    <span className="ml-sm text-label-sm text-on-surface-variant">
                                      (due ~{row.ageMonthsDue} mo)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-sm">
                                    <StatusPill tone={tone} label={row.status} />
                                    {canGive && (
                                      <Button variant="secondary" type="button" onClick={() => giveNipVaccineToday(row.label)}>
                                        Give today
                                      </Button>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      {nipDueRows.length > 0 && nipStatusRows.length === 0 && (
                        <div className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm">
                          <p className="mb-sm text-label-md font-medium text-on-surface">NIP / EPI due by age (checklist)</p>
                          <ul className="space-y-xs text-label-sm text-on-surface-variant">
                            {nipDueRows.map((row) => (
                              <li key={row.ageLabel}>
                                <span className="font-medium text-on-surface">{row.ageLabel}:</span> {row.vaccines.join("; ")}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
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
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Vaccine Name</span><input placeholder="Vaccine Name" value={newVax.vaccineName} onChange={(e) => setNewVax({ ...newVax, vaccineName: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Dose #</span><input placeholder="Dose #" value={newVax.doseNumber} onChange={(e) => setNewVax({ ...newVax, doseNumber: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Route</span><input placeholder="Route" value={newVax.route} onChange={(e) => setNewVax({ ...newVax, route: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Site</span><input placeholder="Site" value={newVax.site} onChange={(e) => setNewVax({ ...newVax, site: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Lot #</span><input placeholder="Lot #" value={newVax.lotNumber} onChange={(e) => setNewVax({ ...newVax, lotNumber: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                        <DatePicker placeholder="Expiry" value={newVax.expiry} onChange={(expiry) => setNewVax({ ...newVax, expiry })} />
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Manufacturer</span><input placeholder="Manufacturer" value={newVax.manufacturer} onChange={(e) => setNewVax({ ...newVax, manufacturer: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" /></label>
                      </div>
                      <Button variant="secondary" onClick={addVaccination}>Stage Vaccination</Button>
                    </div>
                  )}

                  {isOpen && i === 6 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader()}
                      <div className="flex flex-col gap-sm sm:flex-row">
                        {(
                          [
                            ["dated", "Schedule date"],
                            ["prn", "PRN / return if needed"],
                            ["none", "No follow-up"],
                          ] as const
                        ).map(([value, label]) => (
                          <label
                            key={value}
                            className={cn(
                              "flex min-h-[44px] cursor-pointer items-center gap-sm rounded-lg border px-md py-sm text-label-md",
                              followUpMode === value ? "border-primary bg-primary/10 text-primary" : "border-outline-variant",
                            )}
                          >
                            <input
                              type="radio"
                              name="follow-up-mode"
                              checked={followUpMode === value}
                              onChange={() => applyFollowUpMode(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      {followUpMode === "dated" && (
                        <>
                          <DatePicker value={followUpDate} onChange={setFollowUpDate} />
                          <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Reason</span><input placeholder="Reason" value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" /></label>
                          <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Instructions</span><textarea placeholder="Instructions" value={followUpInstructions} onChange={(e) => setFollowUpInstructions(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} /></label>
                          <label className="flex items-center gap-sm text-body-md text-on-surface-variant">
                            <input type="checkbox" checked={followUpReminder} onChange={(e) => setFollowUpReminder(e.target.checked)} className="h-5 w-5" />
                            Send reminder
                          </label>
                        </>
                      )}
                      {followUpMode === "prn" && (
                        <>
                          <p className="text-label-md text-on-surface-variant">
                            Saves today&apos;s date with PRN instructions — patient may return if symptoms recur.
                          </p>
                          <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Instructions</span><textarea
                            placeholder="Instructions"
                            value={followUpInstructions}
                            onChange={(e) => setFollowUpInstructions(e.target.value)}
                            className="w-full rounded-lg border border-outline-variant p-md"
                            rows={2}
                          /></label>
                        </>
                      )}
                      {followUpMode === "none" && (
                        <label className="flex min-h-[44px] items-start gap-sm rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-body-md">
                          <input
                            type="checkbox"
                            className="mt-xs"
                            checked={noFollowUpConfirmed}
                            onChange={(e) => setNoFollowUpConfirmed(e.target.checked)}
                          />
                          <span>
                            <strong>No follow-up for this visit</strong>
                            <span className="block text-label-md text-on-surface-variant">
                              Required for Complete when you are not scheduling follow-up.
                            </span>
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                  {isOpen && i === 7 && (
                    <div className="mt-md space-y-md">
                      {certSavedAt && <Toast key={certSavedAt} variant="success" message={`Certificate saved at ${certSavedAt}.`} />}
                      <p className="text-label-md text-on-surface-variant">
                        §16.8 Form 2. Blank fields fall back to the SOAP Assessment / Plan and the
                        follow-up date. Issuing marks &ldquo;medical certificate&rdquo; on the fee (+₱{feeSchedule?.medCert ?? 50}).
                      </p>
                      {/*JJQR - AI (Nov 20, 2026) E1 — read-only patient / doctor lines; she does not retype these */}
                      {booking && (
                        <p className="text-body-md text-on-surface">
                          {booking.patientName}
                          {patientAgeYears != null ? `, ${patientAgeYears}y` : ""}
                          {booking.patientSex ? `, ${booking.patientSex}` : ""}
                        </p>
                      )}
                      <p className="text-label-md text-on-surface-variant">
                        {booking?.doctorName || doctorProfile?.staff_accounts?.full_name || "Doctor"}
                        {" · License No. "}
                        {doctorProfile?.license_number?.trim() || "—"}
                        {" · PTR No. "}
                        {doctorProfile?.ptr_number?.trim() || "—"}
                      </p>
                      {/*JJQR - END */}
                      <div className="flex flex-wrap items-center justify-end gap-md">
                        {mcTemplates.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              const t = mcTemplates.find((x) => x.id === e.target.value);
                              if (t) applyMcTemplate(t);
                            }}
                            aria-label="Use certificate template"
                            className="rounded-lg border border-outline-variant px-sm py-xs text-label-sm"
                          >
                            <option value="">Use Template…</option>
                            {mcTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                                {t.is_system_template ? " (system)" : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={() => setSaveMcTplOpen(true)}
                          disabled={!mcDiagnosis.trim() && !mcRecommendations.trim() && !mcPurposeException.trim()}
                          className="text-label-sm text-primary hover:underline disabled:text-on-surface-variant/50 disabled:no-underline"
                        >
                          Save as Template
                        </button>
                        {/*JJQR - AI (Nov 19, 2026) - Manage certificate templates in a new tab, deep link */}
                        <Link
                          href={manageTemplatesHref("certificates")}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Manage certificate templates (opens in a new tab)"
                          className="text-label-sm text-on-surface-variant hover:underline"
                        >
                          Manage
                        </Link>
                        {/*JJQR - END */}
                        <Button variant="secondary" loading={issuingCert} disabled={!clinicRow} onClick={() => setCertConfirmPrint(true)}>
                          {certExists ? "Update & Print Certificate" : "Issue & Print Certificate"}
                        </Button>
                        <Button variant="secondary" loading={issuingCert} disabled={!clinicRow} onClick={() => setCertConfirmPrint(false)}>
                          Save without printing
                        </Button>
                        {/*JJQR - AI (Nov 20, 2026) E4 */}
                        {medCertRequested && (
                          <Button variant="ghost" loading={issuingCert} onClick={() => void handleRemoveCertificate()}>
                            Remove certificate
                          </Button>
                        )}
                        {/*JJQR - END */}
                      </div>
                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                        {/*JJQR - AI (Nov 20, 2026) E3 */}
                        <label className="block min-w-0 flex-1 space-y-xs sm:col-span-2"><span className="text-label-md font-medium text-on-surface">Patient address</span><input
                          value={mcAddress}
                          onChange={(e) => setMcAddress(e.target.value)}
                          placeholder={mcAddress.trim() ? undefined : "No address on file"}
                          className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
                        /></label>
                        {/*JJQR - AI (Nov 20, 2026) E1 */}
                        <label className="block min-w-0 flex-1 space-y-xs sm:col-span-2"><span className="text-label-md font-medium text-on-surface">Examined at</span><input
                          value={mcExaminedAt}
                          onChange={(e) => setMcExaminedAt(e.target.value)}
                          className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
                        /></label>
                        {/*JJQR - END */}
                        <label className="text-label-sm text-on-surface-variant">
                          Examination from
                          <input type="date" value={mcExamFrom} onChange={(e) => setMcExamFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-md py-sm text-body-md" />
                        </label>
                        <label className="text-label-sm text-on-surface-variant">
                          Examination until
                          <input type="date" value={mcExamTo} onChange={(e) => setMcExamTo(e.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-md py-sm text-body-md" />
                        </label>
                      </div>
                      {/*JJQR - AI (Nov 20, 2026) E1 */}
                      <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Diagnosis / Impressions</span><textarea
                        value={mcDiagnosisField}
                        onChange={(e) => {
                          setMcDiagnosisDirty(true);
                          setMcDiagnosis(e.target.value);
                        }}
                        placeholder={assessment ? `Diagnosis / Impressions (default: “${assessment}”)` : "Diagnosis / Impressions"}
                        rows={2}
                        className="w-full rounded-lg border border-outline-variant p-md text-body-md"
                      /></label>
                      {/*JJQR - END */}
                      <textarea
                        value={mcRecommendations}
                        onChange={(e) => setMcRecommendations(e.target.value)}
                        placeholder={plan ? `Recommendations (default: “${plan}”)` : "Recommendations"}
                        rows={2}
                        className="w-full rounded-lg border border-outline-variant p-md text-body-md"
                      />
                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Purpose exception (the &ldquo;except ___&rdquo; blank)</span><input
                          value={mcPurposeException}
                          onChange={(e) => setMcPurposeException(e.target.value)}
                          placeholder="Purpose exception (the &ldquo;except ___&rdquo; blank)"
                          className="rounded-lg border border-outline-variant px-md py-sm text-body-md"
                        /></label>
                        <label className="text-label-sm text-on-surface-variant">
                          Please come back on
                          <input type="date" value={mcComeBackOn} onChange={(e) => setMcComeBackOn(e.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-md py-sm text-body-md" />
                        </label>
                      </div>
                    </div>
                  )}

                  {isOpen && i === 8 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader()}
                      {/* §16.6 — fee line the doctor selects; backend recomputes the booking total on save. */}
                      <div className="space-y-sm rounded-lg bg-surface-container-low p-md">
                        <div className="flex flex-wrap items-center gap-sm">
                          <span className="text-label-md text-on-surface-variant">Appointment type</span>
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
                        {/*JJQR - AI (Nov 20, 2026) E4 E5 — add-on is read-only; name the Medical Certificate section, no numbers */}
                        {medCertRequested ? (
                          <p className="text-body-md text-on-surface">
                            Medical certificate +₱{feeSchedule?.medCert ?? 50} — included because a certificate was issued
                          </p>
                        ) : (
                          <p className="text-body-md text-on-surface-variant">
                            Issue it in the{" "}
                            <button
                              type="button"
                              onClick={() => goToSection(7)}
                              className="text-primary underline"
                            >
                              Medical Certificate
                            </button>
                            {" "}section
                          </p>
                        )}
                        {/*JJQR - END */}
                        {/*JJQR - AI (Nov 20, 2026) F3 — one Total line from computeClinicFee */}
                        {feePreview && (
                          <p className="text-label-md text-on-surface">
                            {feePreview.summary}
                          </p>
                        )}
                        {/*JJQR - END */}
                      </div>
                      <div className="flex gap-sm border-b border-outline-variant">
                        <button
                          type="button"
                          onClick={() => {
                            setPfDecision("charge");
                            //JJQR - AI (Nov 20, 2026) F3 — prefill Amount with the clinic total when empty
                            if (!pfAmount.trim() && previewFee !== null) setPfAmount(String(previewFee));
                          }}
                          className={cn("border-b-2 px-xs py-sm text-label-md", pfDecision === "charge" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
                        >
                          {/*JJQR - AI (Nov 20, 2026) F2 — same labels as the completed-visit line */}
                          Charge
                        </button>
                        <button
                          type="button"
                          onClick={() => setPfDecision("waive")}
                          className={cn("border-b-2 px-xs py-sm text-label-md", pfDecision === "waive" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
                        >
                          Waive
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPfDecision(null);
                            setPfAmount("");
                            setPfWaiveReason("");
                          }}
                          className={cn("border-b-2 px-xs py-sm text-label-md", pfDecision === null ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
                        >
                          Decide at desk
                        </button>
                      </div>
                      {pfDecision === "charge" && (
                        <div className="space-y-md">
                          <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Amount</span><input placeholder="Amount*" value={pfAmountShown} onChange={(e) => setPfAmount(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" /></label>
                          <select className="w-full rounded-lg border border-outline-variant px-md py-sm">
                            <option>Pay at Clinic</option>
                            <option>Online</option>
                          </select>

                        </div>
                      )}
                      {pfDecision === "waive" && (
                        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Reason (minimum 5 characters)</span><textarea
                          placeholder="Reason (minimum 5 characters)*"
                          value={pfWaiveReason}
                          onChange={(e) => setPfWaiveReason(e.target.value)}
                          className="w-full rounded-lg border border-outline-variant p-md"
                          rows={3}
                        /></label>
                      )}
                      {pfDecision === null && <p className="text-label-md text-on-surface-variant">Optional — choose Charge or Waive if a decision has been made.</p>}
                    </div>
                  )}
                </Card>
              );
            })}

        </div>
        </div>
        {/* JJQR - END */}
      </div>

      {/*JJQR - AI (Nov 19, 2026) - Save as Template: reason shown, error kept in the modal, double-save guarded */}
      <Modal
        isOpen={saveTemplateOpen}
        onClose={() => { if (!savingTemplate) setSaveTemplateOpen(false); }}
        title="Save as Template"
        footer={
          <>
            <Button variant="secondary" disabled={savingTemplate} onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsTemplate} loading={savingTemplate} disabled={!newTemplateTitle.trim() || !hasSoapContent(currentSoap)}>
              Save
            </Button>
          </>
        }
      >
        <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Title (e.g. &quot;Annual Physical — Normal&quot;)</span><input
          value={newTemplateTitle}
          onChange={(e) => setNewTemplateTitle(e.target.value)}
          placeholder='Title (e.g. &quot;Annual Physical — Normal&quot;)'
          className="w-full rounded-lg border border-outline-variant px-md py-sm"
        /></label>
        {!hasSoapContent(currentSoap) && (
          <p role="status" className="mt-md text-label-md text-status-warning">All five SOAP fields are empty — there is nothing to save.</p>
        )}
        {saveTemplateError && <p role="alert" className="mt-md text-body-md text-status-danger">{saveTemplateError}</p>}
      </Modal>
      {/*JJQR - END */}

      <Modal
        isOpen={saveMcTplOpen}
        onClose={() => setSaveMcTplOpen(false)}
        title="Save Certificate Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveMcTplOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMcAsTemplate} loading={savingMcTemplate} disabled={!saveMcTplTitle.trim()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-sm">
          <label className="block min-w-0 flex-1 space-y-xs"><span className="text-label-md font-medium text-on-surface">Title (e.g. &quot;Fit to Work&quot;, &quot;Sick Leave 3 days&quot;)</span><input
            value={saveMcTplTitle}
            onChange={(e) => setSaveMcTplTitle(e.target.value)}
            placeholder='Title (e.g. &quot;Fit to Work&quot;, &quot;Sick Leave 3 days&quot;)'
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          /></label>
          <p className="text-label-sm text-on-surface-variant">
            Saves the Diagnosis/Impressions, Recommendations, and Purpose exception fields currently
            filled in — not the dates or the patient&apos;s address.
          </p>
        </div>
      </Modal>

      {/*JJQR - AI (Nov 19, 2026) - SOAP template apply: Replace / Append + 5-field preview. Blank template fields never wipe your text. */}
      <Modal
        isOpen={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        size="lg"
        title="Apply SOAP template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingTemplate(null)}>
              Cancel
            </Button>
            <Button
              variant={soapApplyMode === "replace" && hasSoapContent(currentSoap) ? "danger" : "primary"}
              disabled={!pendingTemplate || !hasSoapContent(pendingTemplate)}
              onClick={() => pendingTemplate && doApplyTemplate(pendingTemplate, soapApplyMode)}
            >
              Apply template
            </Button>
          </>
        }
      >
        {pendingTemplate && (() => {
          const { values, outcomes } = mergeSoapTemplate(currentSoap, pendingTemplate, soapApplyMode);
          const outcomeText: Record<SoapFieldOutcome, string> = {
            filled: "Will be filled",
            replaced: "Will be replaced",
            appended: "Will be added on a new line",
            "kept-template-blank": "Template is blank here — your text is kept",
            unchanged: "No change",
          };
          const notesFilled = hasSoapContent(currentSoap);
          return (
            <div className="space-y-md">
              <p className="text-body-md text-on-surface-variant">
                Template: <strong className="text-on-surface">&ldquo;{pendingTemplate.title}&rdquo;</strong>
                {pendingTemplate.isSystemTemplate ? " (system)" : ""}
              </p>
              {!hasSoapContent(pendingTemplate) && (
                <p role="status" className="text-label-md text-status-warning">This template has no text in any field, so there is nothing to apply.</p>
              )}
              <fieldset className="flex flex-wrap gap-md">
                <legend className="sr-only">How to apply the template</legend>
                {(["append", "replace"] as const).map((m) => (
                  <label key={m} className={cn("flex min-h-[44px] cursor-pointer items-center gap-sm rounded-lg border px-md py-sm text-body-md", soapApplyMode === m ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface")}>
                    <input type="radio" name="soap-apply-mode" value={m} checked={soapApplyMode === m} onChange={() => setSoapApplyMode(m)} />
                    {m === "append" ? "Append (keep my text)" : "Replace (use template text)"}
                  </label>
                ))}
              </fieldset>
              {!notesFilled && <p className="text-label-md text-on-surface-variant">Your notes are empty, so both options fill the fields the same way.</p>}
              <ul className="space-y-sm" aria-label="Preview of the five SOAP fields">
                {SOAP_KEYS.map((k) => (
                  <li key={k} className="rounded-lg border border-outline-variant p-sm">
                    <div className="flex flex-wrap items-center justify-between gap-sm">
                      <span className="text-label-md font-semibold text-on-surface">{SOAP_FIELD_LABELS[k]}</span>
                      <span className="text-label-sm text-on-surface-variant">{outcomeText[outcomes[k]]}</span>
                    </div>
                    {/*JJQR - AI (Nov 19, 2026) - text that will be ADDED is highlighted green; the doctor's existing text stays plain */}
                    {(() => {
                      const { kept, added } = splitAddedText(currentSoap[k] ?? "", values[k], outcomes[k]);
                      return (
                        <pre data-testid={`soap-preview-${k}`} className="mt-xs max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-sans text-body-sm text-on-surface">
                          {values[k].trim() === "" ? "—" : (
                            <>
                              {kept}
                              {added && <mark data-added="true" className="rounded-sm bg-status-success-surface px-[2px] text-status-success">{added}</mark>}
                            </>
                          )}
                        </pre>
                      );
                    })()}
                    {/*JJQR - END */}
                  </li>
                ))}
              </ul>
              <p className="text-label-sm text-on-surface-variant">You can undo right after applying.</p>
            </div>
          );
        })()}
      </Modal>
      {/*JJQR - END */}

      {/*JJQR - AI (Nov 19, 2026) - confirm before a certificate template replaces filled fields */}
      <Modal
        isOpen={pendingMcTemplate !== null}
        onClose={() => setPendingMcTemplate(null)}
        title="Replace certificate text?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingMcTemplate(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => pendingMcTemplate && doApplyMcTemplate(pendingMcTemplate)}>Replace</Button>
          </>
        }
      >
        {pendingMcTemplate && (
          <div className="space-y-sm">
            <p className="text-body-md text-on-surface-variant">
              &ldquo;{pendingMcTemplate.title}&rdquo; will replace what you already typed in:
            </p>
            <ul className="list-disc pl-lg text-body-md text-on-surface">
              {mcTemplateFieldPlan(pendingMcTemplate)
                .filter((r) => r.current.trim() !== "" && r.current.trim() !== r.next.trim())
                .map((r) => <li key={r.label}>{r.label}</li>)}
            </ul>
            <p className="text-label-sm text-on-surface-variant">Fields the template leaves blank keep your text.</p>
          </div>
        )}
      </Modal>
      {/*JJQR - END */}

      <Modal
        isOpen={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        title="Completion Checklist"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChecklistOpen(false)} disabled={completing}>
              Go Back
            </Button>
            <Button
              loading={completing}
              onClick={async () => {
                setCompleting(true);
                await handleComplete();
                setCompleting(false);
              }}
            >
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
        {!rxSatisfied && (
          <p className="mt-md rounded-lg bg-status-warning-surface px-md py-sm text-label-md text-status-warning">
            Add at least one medicine, or check “No medicines this visit”.
          </p>
        )}
        {!followUpSatisfied && (
          <p className="mt-md rounded-lg bg-status-warning-surface px-md py-sm text-label-md text-status-warning">
            Complete follow-up (schedule a date, choose PRN, or confirm no follow-up) before Complete — required for Grace clinic.
          </p>
        )}
        {saveError && (
          <p className="mt-md rounded-lg bg-error-container px-md py-sm text-label-md text-on-error-container">
            {saveError}
          </p>
        )}
      </Modal>

      <Modal
        isOpen={labsConfirmPrint !== null}
        onClose={() => setLabsConfirmPrint(null)}
        title="Confirm Lab Orders"
        footer={
          <>
            <Button variant="secondary" disabled={savingLabs} onClick={() => setLabsConfirmPrint(null)}>
              Go Back
            </Button>
            <Button
              loading={savingLabs}
              onClick={async () => {
                const printAfter = labsConfirmPrint === true;
                setLabsConfirmPrint(null);
                await handleSaveLabOrders(printAfter);
              }}
            >
              {labsConfirmPrint ? "Confirm & Print" : "Confirm & Save"}
            </Button>
          </>
        }
      >
        {labOrders.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No tests selected.</p>
        ) : (
          <ul className="space-y-xs text-body-md">
            {labOrders.map((l, i) => (
              <li key={i} className="text-on-surface">
                {l.testName}
                {l.reason ? <span className="text-on-surface-variant"> — {l.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        isOpen={certConfirmPrint !== null}
        onClose={() => setCertConfirmPrint(null)}
        title="Confirm Medical Certificate"
        footer={
          <>
            <Button variant="secondary" disabled={issuingCert} onClick={() => setCertConfirmPrint(null)}>
              Go Back
            </Button>
            <Button
              loading={issuingCert}
              onClick={async () => {
                const printAfter = certConfirmPrint === true;
                setCertConfirmPrint(null);
                await handleIssueMedCert(printAfter);
              }}
            >
              {certConfirmPrint ? "Confirm & Print" : "Confirm & Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-sm text-body-md">
          <p><strong>Diagnosis:</strong> {mcDiagnosisField || "—"}</p>
          <p><strong>Recommendations:</strong> {mcRecommendations || plan || "—"}</p>
          {mcComeBackOn && <p><strong>Come back on:</strong> {mcComeBackOn}</p>}
        </div>
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

      <PatientHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        patientId={booking.patientId}
        doctorId={booking.doctorId}
      />

      <Modal isOpen={lastVisitOpen} onClose={() => setLastVisitOpen(false)} title="Last Appointment SOAP" footer={<Button onClick={() => setLastVisitOpen(false)}>Close</Button>}>
        {lastVisitSoap && (
          <div className="space-y-sm text-body-md text-on-surface-variant">
            <p><strong>Date:</strong> {lastVisitSoap.appointmentDate}</p>
            <p><strong>Subjective:</strong> {lastVisitSoap.subjective}</p>
            <p><strong>Objective:</strong> {lastVisitSoap.objective}</p>
            <p><strong>Assessment:</strong> {lastVisitSoap.assessment}</p>
            <p><strong>Plan:</strong> {lastVisitSoap.plan}</p>
            {/* JJQR - AI (Oct 31, 2026) — F-021 prior vitals in last-visit modal */}
            {lastVisitVitalReadings.length > 0 && (
              <div className="rounded-lg bg-surface-container-low p-sm">
                <p className="text-label-md font-medium text-on-surface">Vitals</p>
                <p className="text-body-md">
                  {defaultVitalTemplates
                    .map((t) => `${t.description}: ${lastVisitVitalReadings.find((r) => r.templateId === t.id)?.value ?? "—"}${t.unit ? ` ${t.unit}` : ""}`)
                    .join(" · ")}
                </p>
              </div>
            )}
            {/* JJQR - END */}
          </div>
        )}
      </Modal>

      {/* Floating counterparts to the header's own buttons — this is a long,
          scrolling form; without these, checking history or finishing means
          scrolling all the way back up. Grouped bottom-right (not bottom-left,
          which collides with AppShell's fixed sidebar footer) so they never
          fight the sidebar for the same corner. */}

      {/* JJQR - AI (Oct 31, 2026) — sticky bottom action bar (mobile + desktop) */}
      <div
        role="region"
        aria-label="Consultation actions"
        className="consultation-workspace fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] lg:inset-x-0 lg:left-[var(--app-main-left,var(--spacing-sidebar))] lg:right-0"
      >
        <div className="mx-auto flex w-full max-w-content flex-col gap-sm px-md py-sm lg:flex-row lg:items-center lg:justify-between lg:gap-md">
          {/* JJQR - AI (Nov 20, 2026) - B-40: also in amend mode, where Save amendment / Review section are locked by the same rule */}
          {!canComplete && missingRequiredSections.length > 0 && (
            <div className="shrink-0">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-status-warning-border bg-status-warning-surface px-md py-xs text-label-md text-status-warning lg:w-auto"
                onClick={() => {
                  //JJQR - AI (Nov 19, 2026) - jump straight to the next missing required section (and start showing warnings)
                  setCompleteAttempted(true);
                  const next = nextMissingSection(missingRequiredSections, openSection, SECTION_ORDER);
                  if (next !== null) goToSection(next);
                }}
                aria-label={`${missingRequiredSections.length} required section${missingRequiredSections.length === 1 ? "" : "s"} left: ${missingSectionNames}. Go to the next one`}
              >
                <span className="font-medium">
                  {missingRequiredSections.length} required section{missingRequiredSections.length === 1 ? "" : "s"} left: {missingSectionNames}
                </span>
                <span className="ml-sm inline-flex items-center gap-xs text-label-sm underline">
                  Go to next <Icon name="arrow_forward" className="text-[16px]" aria-hidden />
                </span>
              </button>
            </div>
          )}
          {/* JJQR - END */}
          <div className="flex w-full flex-wrap items-center justify-between gap-md lg:w-auto lg:flex-1">
            <p role="status" aria-live="polite" aria-atomic="true" className="consultation-save-status text-label-md tabular-nums text-on-surface-variant">{savingDraft || savingChanges ? "Saving your changes…" : saveError ? "Not saved — your entries are still here." : mode === "amend" ? (amendSavedAt ? `Amendment saved ${amendSavedAt}` : "Amendment · manual save") : savedDraftSnapshot && currentFormSnapshot() !== savedDraftSnapshot ? "Unsaved changes · auto-save every 30 seconds" : draftSavedAt ? `Draft saved ${draftSavedAt}` : consultationId ? "Draft loaded · no new changes" : "Draft not saved · changes auto-save every 30 seconds"}</p>
            <div className="flex items-center gap-sm">
              {mode === "complete" && <Button variant={canComplete ? "primary" : "secondary"} disabled={!canComplete || savingDraft} onClick={() => setChecklistOpen(true)} aria-label="Complete Consultation">Review &amp; complete</Button>}
              <Button variant={mode === "complete" && canComplete ? "secondary" : "primary"} loading={mode === "complete" ? savingDraft : savingChanges} disabled={mode === "amend" && !canComplete} onClick={mode === "complete" ? handleSaveDraft : handleSaveChanges}>{mode === "complete" ? "Save draft" : "Save amendment"}</Button>
            </div>
          </div>
        </div>
      </div>
      {/* JJQR - END */}
    </AppShell>
  );
}

//JJQR - AI (Oct 31, 2026)
// Canonical doctor consultation page (/doctor/consultation/[bookingId] redirects here).
//JJQR - END
export default function Consultation2Page({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  return (
    <Suspense fallback={<div role="status" className="p-lg text-on-surface-variant">Loading consultation…</div>}>
      <ConsultationWorkflow bookingId={bookingId} />
    </Suspense>
  );
}
