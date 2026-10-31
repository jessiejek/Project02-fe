"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import { todayManila } from "@/lib/clock";
import Link from "next/link";
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
//JJQR - AI (Oct 31, 2026)
import {
  ConsultPatientBanner,
  allergiesNeedPrescriptionReview,
} from "@/components/doctor/ConsultPatientBanner";
import { ConsultMobileSectionStepper } from "@/components/doctor/ConsultMobileSectionStepper";
import { Icd10DiagnosisField } from "@/components/doctor/Icd10DiagnosisField";
import { GrowthChart } from "@/components/doctor/GrowthChart";
import {
  queryPatientAllergies,
  replacePatientAllergies,
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
  querySoapTemplates,
  createSoapTemplate,
  queryDiagnosisTemplates,
  createDiagnosisTemplate,
  type DiagnosisTemplateRow,
  upsertConsultationByBooking,
  replaceDiagnoses,
  upsertFollowUpByConsultation,
  deleteFollowUpByConsultation,
  upsertMedicalCertificateByConsultation,
  queryMedicalCertificateByConsultation,
  queryRxGroups,
  queryVitalReadings,
  type RxGroupRow,
  queryMedicalCertificateTemplates,
  createMedicalCertificateTemplate,
  type MedicalCertificateTemplateRow,
} from "@/lib/data/clinical";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryBookingById } from "@/lib/data/bookings";
import { queryPatientById } from "@/lib/data/patients";
import { printMedicalCertificate } from "@/lib/print-forms";
import {
  printLabOrdersForBooking,
  printPrescriptionForBooking,
} from "@/lib/consult-print";
import { formatConsultationDiagnosisLabel } from "@/lib/data/clinical";
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
  "SOAP & Chief Complaint",
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

type SectionStatus = "complete" | "warning" | "partial" | "empty";

const STATUS_ICON: Record<SectionStatus, { icon: string; cls: string }> = {
  complete: { icon: "check_circle", cls: "text-green-600" },
  warning: { icon: "warning", cls: "text-amber-500" },
  partial: { icon: "incomplete_circle", cls: "text-blue-500" },
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
  { keys: "Ctrl+S", description: "Save Draft (or Save Changes in amend mode)" },
  { keys: "Ctrl+Enter", description: "Complete Consultation (when required fields are valid)" },
  { keys: "?", description: "Show this help" },
];

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
  const [patientLabValues, setPatientLabValues] = useState<PatientLabValueRow[]>([]);
  const [patientVaxHistory, setPatientVaxHistory] = useState<VaccinationRow[]>([]);
  const [soapSpecialtyFilter, setSoapSpecialtyFilter] = useState<Specialty | "All">("All");
  //JJQR - END
  const [vitalTemplates, setVitalTemplates] = useState<VitalFieldTemplate[]>([]);
  const [vitalReadings, setVitalReadings] = useState<{ templateId: string; value: string }[]>([]);

  const [mode, setMode] = useState(initialMode);
  const [checklistOpen, setChecklistOpen] = useState(false);
  //JJQR - AI (Oct 31, 2026)
  const [needHintExpanded, setNeedHintExpanded] = useState(false);
  //JJQR - END
  const [historyOpen, setHistoryOpen] = useState(false);
  const [amendHistoryOpen, setAmendHistoryOpen] = useState(false);
  const [lastVisitOpen, setLastVisitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  // Which section's Save opened the review modal — the modal only shows
  // that section's own fields (Doctor asked: SOAP's Save should review just
  // SOAP, Diagnosis's Save should review just Diagnosis), even though the
  // write underneath always persists the whole consultation record.
  const [reviewSection, setReviewSection] = useState<number | null>(null);
  const [labsConfirmPrint, setLabsConfirmPrint] = useState<boolean | null>(null);
  const [certConfirmPrint, setCertConfirmPrint] = useState<boolean | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [savingPostCompletePf, setSavingPostCompletePf] = useState(false);
  const [openSection, setOpenSection] = useState(0);
  //JJQR - AI (Oct 31, 2026)
  const [allergyReviewed, setAllergyReviewed] = useState(false);
  //JJQR - END
  //JJQR - AI (Oct 31, 2026) — complete mode shows all sections; no occasional toggle
  /** Consult2: occasional sections hidden until the doctor asks for them (not in complete mode). */
  const [showOccasional, setShowOccasional] = useState(false);
  const revealOccasionalSections = mode === "complete" || showOccasional;
  const visibleSectionOrder = SECTION_ORDER.filter(
    (i) => revealOccasionalSections || !OCCASIONAL_SECTIONS.includes(i as (typeof OCCASIONAL_SECTIONS)[number]),
  );
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
  const [progressOpen, setProgressOpen] = useState(false);

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

  function applyMcTemplate(template: MedicalCertificateTemplateRow) {
    setMcDiagnosis(template.diagnosis_text ?? "");
    setMcRecommendations(template.recommendations ?? "");
    setMcPurposeException(template.purpose_exception ?? "");
  }

  async function saveMcAsTemplate() {
    if (!saveMcTplTitle.trim() || !booking) return;
    const supabase = null as never;
    const data = await createMedicalCertificateTemplate(supabase, booking.doctorId, {
      title: saveMcTplTitle.trim(),
      is_system_template: false,
      diagnosis_text: mcDiagnosis || null,
      recommendations: mcRecommendations || null,
      purpose_exception: mcPurposeException || null,
    });
    setMcTemplates((prev) => [...prev, data].sort((a, b) => a.title.localeCompare(b.title)));
    setSaveMcTplTitle("");
    setSaveMcTplOpen(false);
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
    const supabase = null as never;
    const data = await queryVitalReadings(supabase, { bookingId });
    setVitalReadings(data.map((r) => ({ templateId: r.template_id, value: r.value })));
  }

  // Section 3: Diagnosis
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [newDiagnosisText, setNewDiagnosisText] = useState("");
  //JJQR - AI (Oct 31, 2026)
  const [newDiagnosisIcd, setNewDiagnosisIcd] = useState<string | null>(null);
  //JJQR - END
  // Doctor's reusable diagnoses (managed in Settings).
  const [diagnosisTemplates, setDiagnosisTemplates] = useState<DiagnosisTemplateRow[]>([]);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [saveTplLabel, setSaveTplLabel] = useState("");

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
  function addDiagnosis() {
    if (!newDiagnosisText.trim()) return;
    addDiagnosisLine(newDiagnosisText, newDiagnosisIcd);
    setNewDiagnosisText("");
    setNewDiagnosisIcd(null);
  }

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

  async function saveDiagnosisTemplate() {
    const label = saveTplLabel.trim();
    const body = newDiagnosisText.trim();
    if (!label || !body) return;
    const created = await createDiagnosisTemplate(null as never, { label, body });
    setDiagnosisTemplates((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
    setSaveTplOpen(false);
    setSaveTplLabel("");
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
      const consultId = consultationId ?? (await persistConsultation("Draft"));
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
      if (printAfter) await runPrintLabOrders();
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
  const [pfDecision, setPfDecision] = useState<"charge" | "waive" | null>(null);
  const [pfAmount, setPfAmount] = useState("");
  const [pfWaiveReason, setPfWaiveReason] = useState("");
  // §16.6 — doctor picks the fee line; the backend recomputes the booking total
  // on consultation save. Seeded from the booking row in the load effect.
  const [visitType, setVisitType] = useState<"New" | "FollowUp">("New");
  // What staff tagged it as at check-in, kept separately so the doctor can
  // see (and reverse) their own override without losing that context.
  const [staffVisitType, setStaffVisitType] = useState<"New" | "FollowUp" | null>(null);
  const [discountCategory, setDiscountCategory] = useState<"Senior" | "PWD" | "">("");
  const [medCertRequested, setMedCertRequested] = useState(false);
  const [feeSchedule, setFeeSchedule] = useState<{
    consultation: number;
    followUp: number;
    seniorPwd: number;
    medCert: number;
  } | null>(null);
  // §16.8 Form 2 — medical certificate (its own section, index 7).
  const [clinicRow, setClinicRow] = useState<ClinicSettingsRow | null>(null);
  const [mcAddress, setMcAddress] = useState("");
  const [mcExaminedAt, setMcExaminedAt] = useState("");
  // Default "has been examined in ___" to the doctor's own clinic (a solo
  // practice — the printed cert reads more naturally naming the doctor than
  // a generic clinic_name), while staying an editable field either way.
  const doctorClinicLabel = booking ? `${booking.doctorName.replace(/^Dr\.?\s+/i, "").trim()}, MD Clinic` : "";

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
  const [mcExamFrom, setMcExamFrom] = useState("");
  const [mcExamTo, setMcExamTo] = useState("");
  const [mcDiagnosis, setMcDiagnosis] = useState("");
  const [mcRecommendations, setMcRecommendations] = useState("");
  const [mcPurposeException, setMcPurposeException] = useState("");
  const [mcComeBackOn, setMcComeBackOn] = useState("");
  const [certExists, setCertExists] = useState(false);
  const [issuingCert, setIssuingCert] = useState(false);
  const [certSavedAt, setCertSavedAt] = useState<string | null>(null);
  // Doctor's reusable "reason for the cert" text (managed in Settings).
  const [mcTemplates, setMcTemplates] = useState<MedicalCertificateTemplateRow[]>([]);
  const [saveMcTplOpen, setSaveMcTplOpen] = useState(false);
  const [saveMcTplTitle, setSaveMcTplTitle] = useState("");

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
        paymentStatus: bookingRow.payments?.status ?? "Unpaid",
        visitType: bookingRow.visit_type ?? "New",
        discountCategory: bookingRow.discount_category ?? "",
        medCertRequested: bookingRow.med_cert_requested ?? false,
      };

      const [consultRes, templates, vitalsRes, soapTemplatesRes, patientConsultsRes, rxRes, dxTemplates, mcTemplatesRes] = await Promise.all([
        queryConsultationByBooking(supabase, bookingId).then((data) => ({ data })),
        queryVitalFieldTemplates(supabase),
        queryVitalReadings(supabase, { bookingId }).then((data) => ({ data })),
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
        queryRxGroups(supabase, { bookingId }).then((rows) => ({ data: rows[0] ?? null })),
        queryDiagnosisTemplates().catch(() => [] as DiagnosisTemplateRow[]),
        queryMedicalCertificateTemplates(supabase, realBooking.doctorId).catch(() => [] as MedicalCertificateTemplateRow[]),
      ]);
      if (cancelled) return;

      setDiagnosisTemplates(dxTemplates);
      setMcTemplates(mcTemplatesRes);

      if (rxRes.data) {
        setPrescriptionGroup(mapRxGroup(rxRes.data));
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
            ? { type: "Charge" as const, amount: consultRes.data.pf_amount ?? 0 }
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
      setPfAmount(String(realBooking.totalFee || ""));
      setVisitType(realBooking.visitType);
      setStaffVisitType(realBooking.visitType);
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
        followUpExisted.current = Boolean(loadedConsultation.followUpDate);
        if ((loadedConsultation.followUpReason ?? "").includes("PRN")) {
          setFollowUpMode("prn");
        } else if (!loadedConsultation.followUpDate && !loadedConsultation.followUpReason) {
          setFollowUpMode("dated");
        } else {
          setFollowUpMode("dated");
        }
        setVaccinations(toVaxDraft(loadedConsultation.vaccinationsAdministered));
        const fd = loadedConsultation.feeDecision;
        setPfDecision(fd ? (fd.type === "Charge" ? "charge" : "waive") : null);
        if (fd?.type === "Charge") setPfAmount(String(fd.amount ?? ""));
        if (fd?.type === "Waive") setPfWaiveReason(fd.waiveReason ?? "");
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

  function renderMissingRequiredHint(className?: string) {
    if (canComplete || missingRequiredSections.length === 0) return null;
    return (
      <p className={cn("max-w-[20rem] text-right text-label-sm text-amber-900", className)}>
        Need:{" "}
        {missingRequiredSections.map((secIdx, idx) => (
          <span key={secIdx}>
            {idx > 0 ? ", " : ""}
            <button
              type="button"
              className="font-medium text-primary underline"
              onClick={() => setOpenSection(secIdx)}
            >
              {SECTIONS[secIdx]}
            </button>
          </span>
        ))}
      </p>
    );
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
    pfDecision !== null && (pfDecision === "charge" ? pfAmount.trim() !== "" : pfWaiveReason.trim().length >= 5),
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
  const doneRequired = REQUIRED_SECTIONS.filter((i) => isRequiredSectionDone(i)).length;
  const missingRequiredSections = REQUIRED_SECTIONS.filter((i) => !isRequiredSectionDone(i));
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
    if (satisfied) return "complete";
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
        const required = REQUIRED_SECTIONS.includes(i);
        return <Icon name={required ? "warning" : "radio_button_unchecked"} className={cn(className, required ? "text-amber-500" : "text-on-surface-variant")} />;
      }
      if (filled === fields.length) {
        return <Icon name="check_circle" className={cn(className, "text-green-600")} />;
      }
      return (
        <span
          title={`${filled} of ${fields.length} fields filled in this section`}
          aria-label={`${filled} of ${fields.length} fields filled`}
          className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-blue-100 px-xs font-bold text-blue-700", className)}
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
  function renderSectionSaveHeader(sectionIndex: number) {
    return (
      <div className="space-y-sm">
        {draftSavedAt && mode === "complete" && (
          <Toast key={draftSavedAt} variant="success" message={`Saved at ${draftSavedAt}.`} />
        )}
        <div className="flex items-center justify-end gap-sm">
          <Button
            disabled={mode === "amend" && !canComplete}
            loading={mode === "complete" ? savingDraft : savingChanges}
            onClick={() => setReviewSection(sectionIndex)}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

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
        med_cert_requested: medCertRequested,
        discount_category: discountCategory || null,
        // §16.6 — the doctor's PF call travels on the consultation row.
        pf_decision: pfDecision === "charge" ? "Charge" : pfDecision === "waive" ? "Waive" : null,
        pf_amount: pfDecision === "charge" ? Number(pfAmount) || null : null,
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

  async function handleSaveDraft() {
    setSaveError("");
    setSavingDraft(true);
    try {
      const savedId = await persistConsultation("Draft");
      if (!savedId) throw new Error("Could not save the draft. Check your connection and try again.");
      setDraftSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the draft. Try again.");
    } finally {
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

  async function handleSavePostCompletePf() {
    setSavingPostCompletePf(true);
    try {
      await persistConsultation("Completed");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save fee decision.");
    } finally {
      setSavingPostCompletePf(false);
    }
  }

  // §16.8 Form 2 — save the certificate row (upsert on consultation) then print
  // it on the shared clinic letterhead. Requires a saved consultation.
  async function handleIssueMedCert(printAfter: boolean) {
    if (!booking || !clinicRow) return;
    setIssuingCert(true);
    const supabase = null as never;
    try {
      const consultId = consultationId ?? (await persistConsultation("Draft"));
      if (!consultId) return;
      const today = todayManila();
      const cert = {
        patient_id: booking.patientId,
        doctor_id: booking.doctorId,
        issue_date: today,
        patient_address_snapshot: mcAddress || null,
        examined_at: mcExaminedAt || doctorClinicLabel || clinicRow.clinic_name,
        examination_date_from: mcExamFrom || today,
        examination_date_to: mcExamTo || mcExamFrom || today,
        diagnosis_text: mcDiagnosis || assessment || null,
        recommendations: mcRecommendations || plan || null,
        purpose_exception: mcPurposeException || null,
        come_back_on: mcComeBackOn || followUpDate || null,
      };
      await upsertMedicalCertificateByConsultation(supabase, consultId, cert);
      setCertExists(true);
      setMedCertRequested(true);
      setCertSavedAt(new Date().toLocaleTimeString());
      if (!printAfter) return;
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
    setSaveError("");
    setSavingChanges(true);
    try {
      const savedId = await persistConsultation("Amended");
      if (!savedId) throw new Error("Could not save your changes. Check your connection and try again.");
      // The server writes the audit_logs row itself (with a real diff of what
      // changed) as part of the PUT above — this just reflects that locally so
      // the history list updates without waiting on a refetch.
      setSavedConsultation(buildConsultationRecord());
      setAmendmentHistory((prev) => [
        { timestamp: new Date().toLocaleString(), author: booking.doctorName, section: "Consultation amended" },
        ...prev,
      ]);
      setAmendSnapshot(null);
      setMode("view");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save your changes. Try again.");
    } finally {
      setSavingChanges(false);
    }
  }

  // Per-section "Save" button (Diagnosis, Vaccinations, Follow-up, PF Decision,
  // SOAP & Chief Complaint) — every section's data already travels together in
  // one persistConsultation() write (it's not split per-section server-side),
  // so "save this section" really means "save current progress" the same way
  // Ctrl+S already does: Draft in complete mode, Amended in amend mode. This
  // just gives that same action a visible home inside each section, matching
  // the Vitals/Prescription/Lab Orders/Medical Certificate sections, which
  // already have their own local Save.
  function saveCurrentProgress() {
    if (mode === "complete") handleSaveDraft();
    else handleSaveChanges();
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

  //JJQR - AI (Oct 31, 2026) — F-010 beforeunload, F-022 autosave
  useEffect(() => {
    if (loaded && mode === "complete" && completeBaselineRef.current === null) {
      completeBaselineRef.current = currentFormSnapshot();
    }
  }, [loaded, mode]);

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
      void handleSaveDraft();
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
          <div className="flex flex-col gap-sm rounded-lg bg-green-50 px-md py-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-sm text-label-md">
              <Icon name="check_circle" />
              Consultation saved
            </span>
            <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
              {consultPrintButtons("flex flex-col gap-sm sm:flex-row")}
              <Link href="/doctor/dashboard">
                <Button variant="secondary" className="min-h-[44px] w-full sm:w-auto">Back to Queue</Button>
              </Link>
              <Link href="/doctor/dashboard">
                <Button className="min-h-[44px] w-full sm:w-auto">Next Patient →</Button>
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
          <Card className="space-y-md">
            <h4 className="text-headline-sm text-on-surface">Professional fee</h4>
            <div className="flex flex-wrap gap-sm border-b border-outline-variant">
              <button
                type="button"
                onClick={() => setPfDecision("charge")}
                className={cn("min-h-[44px] border-b-2 px-xs py-sm text-label-md", pfDecision === "charge" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
              >
                Charge
              </button>
              <button
                type="button"
                onClick={() => setPfDecision("waive")}
                className={cn("min-h-[44px] border-b-2 px-xs py-sm text-label-md", pfDecision === "waive" ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
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
                className={cn("min-h-[44px] border-b-2 px-xs py-sm text-label-md", pfDecision === null ? "border-primary text-primary" : "border-transparent text-on-surface-variant")}
              >
                Decide at desk
              </button>
            </div>
            {pfDecision === "charge" && (
              <input
                placeholder="Amount*"
                value={pfAmount}
                onChange={(e) => setPfAmount(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm"
              />
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
            {pfDecision === null && (
              <p className="text-label-md text-on-surface-variant">Front desk can collect or waive later.</p>
            )}
            <Button
              className="min-h-[44px]"
              loading={savingPostCompletePf}
              disabled={pfDecision === "charge" ? !pfAmount.trim() : pfDecision === "waive" ? pfWaiveReason.trim().length < 5 : false}
              onClick={() => void handleSavePostCompletePf()}
            >
              Save fee decision
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (mode === "view") {
    const sc = savedConsultation;
    return (
      <AppShell role="doctor">
        {/* JJQR - AI (Oct 31, 2026) — allergies editable on completed view */}
        <ConsultPatientBanner
          patientName={booking.patientName}
          patientCode={booking.patientCode}
          patientSex={booking.patientSex}
          patientDob={booking.patientDob}
          paymentStatus={booking.paymentStatus}
          allergies={patientAllergies}
          nkda={nkda}
          mode="view"
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
        <div className="mx-auto max-w-[40rem] space-y-lg">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <div>
              <div className="flex flex-wrap items-center gap-sm">
                <h1 className="text-headline-sm text-on-surface">{booking.patientName || "Patient"}</h1>
                <StatusPill status={booking.paymentStatus} />
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
              <Card className="space-y-sm text-body-md text-on-surface-variant">
                <p><strong>Chief Complaint:</strong> {sc.chiefComplaint || "Not recorded."}</p>
                <p><strong>Subjective:</strong> {sc.subjective || "Not recorded."}</p>
                <p><strong>Objective:</strong> {sc.objective || "Not recorded."}</p>
                <p><strong>Assessment:</strong> {sc.assessment || "Not recorded."}</p>
                <p><strong>Plan:</strong> {sc.plan || "Not recorded."}</p>
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
                  {sc.diagnoses.length > 0 ? sc.diagnoses.map((d) => `${d.description} (${d.type})`).join(", ") : "No diagnoses recorded."}
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
                  <p className="text-body-md text-on-surface-variant">No prescriptions recorded.</p>
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
                  <p className="text-body-md text-on-surface-variant">No lab orders recorded.</p>
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
                  <p className="text-body-md text-on-surface-variant">No vaccinations recorded.</p>
                )}
              </Card>
              <Card>
                <h4 className="mb-sm text-headline-sm text-on-surface">Follow-up</h4>
                <p className="text-body-md text-on-surface-variant">
                  {sc.followUpDate ? `${sc.followUpDate} — ${sc.followUpReason ?? ""}${sc.followUpInstructions ? ` (${sc.followUpInstructions})` : ""}${sc.followUpReminder ? " · reminder on" : ""}` : "No follow-up recorded."}
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
      {/* JJQR - AI (Oct 31, 2026) — F-002 sticky patient banner */}
      <ConsultPatientBanner
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
      <div className="min-w-0 space-y-lg overflow-x-clip">
        {mode === "amend" && (
          <Toast variant="info" message="Manual save only — autosave is off in amend mode." dismissible={false} />
        )}
        {saveError && <Toast key={saveError} variant="error" message={saveError} />}
        {draftSavedAt && mode === "complete" && (
          <Toast key={draftSavedAt} variant="success" message={`Draft saved at ${draftSavedAt}.`} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-md">
          <div>
            {/* JJQR - AI (Oct 31, 2026) — patient identity moved to ConsultPatientBanner */}
            <div className="flex flex-wrap items-center gap-sm">
              <h1 className="text-headline-md text-on-surface">Consultation</h1>
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
                    "min-h-[44px] rounded-full border px-md py-xs text-label-md font-medium",
                    visitType === vt
                      ? vt === "New"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-tertiary bg-tertiary/10 text-tertiary"
                      : "border-outline-variant text-on-surface-variant",
                  )}
                >
                  {vt === "New" ? "New Appointment" : "Follow-up Appointment"}
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
            <div className="relative">
              <Button
                variant="secondary"
                onClick={() => setProgressOpen((v) => !v)}
                aria-expanded={progressOpen}
                aria-haspopup="true"
                title={`${doneRequired} of ${REQUIRED_SECTIONS.length} required sections complete`}
                aria-label={`Progress: ${doneRequired} of ${REQUIRED_SECTIONS.length} required sections complete`}
              >
                <Icon name="monitoring" className="text-[18px]" />
                {doneRequired}/{REQUIRED_SECTIONS.length}
                <Icon name={progressOpen ? "expand_less" : "expand_more"} className="text-[16px]" />
              </Button>
              {progressOpen && (
                <>
                  {/* Click-outside catcher — a plain overlay, not a scrim (this is a menu, not a modal). */}
                  <button
                    type="button"
                    aria-label="Close progress menu"
                    tabIndex={-1}
                    onClick={() => setProgressOpen(false)}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <Card className="absolute right-0 z-50 mt-xs w-[17rem] shadow-lg">
                    <p className="mb-sm text-label-md font-bold text-on-surface-variant">Progress</p>
                    <ul className="space-y-sm text-label-md text-on-surface-variant">
                      {SECTIONS.map((s, i) => (
                        <li key={s}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenSection(i);
                              setProgressOpen(false);
                            }}
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
                  </Card>
                </>
              )}
            </div>
            <Button variant="secondary" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts help">
              <Icon name="help" className="text-[18px]" />
            </Button>
            <Button variant="secondary" onClick={() => setHistoryOpen(true)}>
              View Patient History
            </Button>
            {consultPrintButtons()}
            {mode === "complete" ? (
              <>
                <Button variant="secondary" loading={savingDraft} className="min-h-[44px]" onClick={handleSaveDraft}>
                  Save Draft
                </Button>
                {renderMissingRequiredHint("hidden lg:block max-w-none text-left")}
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={requestCancelAmend}>
                  Cancel
                </Button>
                <Button disabled={!canComplete} loading={savingChanges} onClick={handleSaveChanges}>Save Changes</Button>
              </>
            )}
          </div>
        </div>

        {/* JJQR - AI (Oct 31, 2026) — in-flow sections rail (no viewport-fixed overlap with AppShell sidebar) */}
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-lg">
          <nav
            aria-label="Consultation sections"
            className="sticky top-[7.375rem] z-10 hidden max-h-[70vh] flex-col gap-xs self-start overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-sm shadow-lg lg:flex"
          >
            <p className="px-xs pb-xs text-label-sm text-on-surface-variant">Sections</p>
            {visibleSectionOrder.map((i, displayIdx) => (
              <button
                key={SECTIONS[i]}
                type="button"
                onClick={() => setOpenSection(i)}
                className={cn(
                  "flex items-start gap-sm rounded-lg px-sm py-sm text-left text-label-md transition-colors",
                  openSection === i ? "bg-primary/10 text-on-surface" : "text-on-surface-variant hover:bg-surface-container-low",
                )}
              >
                {renderSectionIndicator(i, "mt-0.5 shrink-0 text-[16px]")}
                <span className="min-w-0 flex-1 whitespace-normal leading-snug">
                  {displayIdx + 1}. {SECTIONS[i]}
                </span>
              </button>
            ))}
          </nav>

        <div className="min-w-0 space-y-md pb-[max(14rem,env(safe-area-inset-bottom))] lg:pb-28 lg:pb-[max(7rem,env(safe-area-inset-bottom))]">
            {/* JJQR - AI (Oct 31, 2026) — F-026 */}
            {mode !== "complete" && (
            <p className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
              Optional sections — vaccinations and professional fee — appear when you choose
              &ldquo;Show occasional sections&rdquo;. Labs and medical certificate stay in the main flow.
            </p>
            )}
            {/* JJQR - END */}
            {/* JJQR - AI (Oct 31, 2026) — F-011 mobile section progress */}
            <ConsultMobileSectionStepper
              sections={SECTIONS}
              sectionOrder={visibleSectionOrder}
              sectionStatus={visibleSectionOrder.map((i) => sectionStatus(i))}
              openSection={openSection}
              onSelect={setOpenSection}
              renderIndicator={(i, cls) => renderSectionIndicator(i, cls)}
            />
            {/* JJQR - END */}
            {visibleSectionOrder.map((i, displayIdx) => {
              const section = SECTIONS[i];
              const isOpen = openSection === i;
              return (
                <Card key={section}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(isOpen ? -1 : i)}
                    className="-m-lg flex min-h-[44px] w-[calc(100%+2*var(--spacing-lg))] cursor-pointer items-center justify-between rounded-xl p-lg text-left transition-colors hover:bg-surface-container-low"
                  >
                    <h3 className="flex items-center gap-sm text-headline-sm text-on-surface">
                      {renderSectionIndicator(i, "text-[18px]")}
                      {displayIdx + 1}. {section}
                      {REQUIRED_SECTIONS.includes(i) && (
                        <span className="rounded-full bg-primary/10 px-sm py-xs text-label-sm text-primary">Required</span>
                      )}
                    </h3>
                    <Icon name={isOpen ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
                  </button>

                  {isOpen && i === 0 && (
                    <div className="mt-md space-y-md">
                      {draftSavedAt && mode === "complete" && (
                        <Toast key={draftSavedAt} variant="success" message={`Saved at ${draftSavedAt}.`} />
                      )}
                      <div className="flex w-full flex-col gap-md">
                        {lastVisitSoap && (
                          <button
                            type="button"
                            onClick={() => setLastVisitOpen(true)}
                            className="text-left text-label-md text-primary hover:underline"
                          >
                            View Last Appointment SOAP
                          </button>
                        )}
                        {/* JJQR - AI (Oct 31, 2026) — SOAP toolbar stacks on phone */}
                        <div className="flex w-full flex-col gap-sm lg:ml-auto lg:max-w-none lg:items-end">
                          <div className="flex w-full gap-xs overflow-x-auto pb-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-end">
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
                          <select
                            value=""
                            onChange={(e) => {
                              const t = filteredSoapTemplates.find((x) => x.id === e.target.value);
                              if (t) applyTemplate(t);
                            }}
                            aria-label="Use SOAP template"
                            className="min-h-[44px] w-full rounded-lg border border-outline-variant px-sm py-xs text-label-sm lg:w-auto"
                          >
                            <option value="">Use Template…</option>
                            {filteredSoapTemplates.length === 0 && soapTemplates.length > 0 && (
                              <option value="__empty" disabled>
                                No templates for this specialty
                              </option>
                            )}
                            {soapTemplates.length === 0 && (
                              <option value="__empty" disabled>
                                No templates yet
                              </option>
                            )}
                            {filteredSoapTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                                {t.isSystemTemplate ? " (system)" : ""}
                              </option>
                            ))}
                          </select>
                          {soapTemplates.length === 0 && (
                            <Link
                              href="/doctor/templates"
                              className="text-label-sm text-on-surface-variant hover:underline"
                            >
                              Manage templates
                            </Link>
                          )}
                          <div className="flex w-full flex-wrap items-center gap-sm sm:justify-end">
                            <button
                              type="button"
                              onClick={() => setSaveTemplateOpen(true)}
                              className="min-h-[44px] text-label-sm text-primary hover:underline"
                            >
                              Save as Template
                            </button>
                            <Button
                              className="min-h-[44px] flex-1 sm:flex-none"
                              disabled={mode === "amend" && !canComplete}
                              loading={mode === "complete" ? savingDraft : savingChanges}
                              onClick={() => setReviewSection(0)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                        {/* JJQR - END */}
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
                      <VitalsEditor bookingId={bookingId} patientId={booking.patientId} onSaved={reloadVitalReadings} />
                    </div>
                  )}

                  {isOpen && i === 2 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader(2)}
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

                      {diagnosisTemplates.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const t = diagnosisTemplates.find((x) => x.id === e.target.value);
                            if (t) addDiagnosisLine(t.body);
                          }}
                          aria-label="Insert a saved diagnosis"
                          className="w-full rounded-lg border border-outline-variant bg-transparent px-md py-sm text-body-md text-on-surface-variant"
                        >
                          <option value="">+ Insert saved diagnosis…</option>
                          {diagnosisTemplates.map((t) => (
                            <option key={t.id} value={t.id}>{t.label} — {t.body}</option>
                          ))}
                        </select>
                      )}

                      <div className="flex flex-col gap-sm sm:flex-row sm:items-end">
                        <Icd10DiagnosisField
                          className="flex-1"
                          description={newDiagnosisText}
                          icd10Code={newDiagnosisIcd}
                          onChange={({ description, icd10Code }) => {
                            setNewDiagnosisText(description);
                            setNewDiagnosisIcd(icd10Code);
                          }}
                          onEnterSubmit={addDiagnosis}
                        />
                        <Button variant="secondary" className="min-h-[44px]" onClick={addDiagnosis}>Add</Button>
                      </div>
                      {/* JJQR - END — replaced free-text-only diagnosis input (F-007) */}
                      <div className="flex items-center justify-between text-label-sm">
                        <button
                          type="button"
                          onClick={() => { setSaveTplLabel(""); setSaveTplOpen(true); }}
                          disabled={!newDiagnosisText.trim()}
                          className="text-primary hover:underline disabled:text-on-surface-variant/50 disabled:no-underline"
                        >
                          Save typed text as a template
                        </button>
                        <Link href="/doctor/templates" className="text-on-surface-variant hover:underline">Manage templates</Link>
                      </div>
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
                        <div className="flex flex-col gap-sm rounded-lg border border-amber-400 bg-amber-50 px-md py-sm sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-label-md text-amber-900">
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
                        onNeedAllergyAck={() => {}}
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
                          <Button loading={savingLabs} disabled={!booking} onClick={() => setLabsConfirmPrint(true)}>
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
                        <input placeholder="Add another test" value={newLab.testName} onChange={(e) => setNewLab({ ...newLab, testName: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Reason / clinical indication" value={newLab.reason} onChange={(e) => setNewLab({ ...newLab, reason: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Specimen type" value={newLab.specimenType} onChange={(e) => setNewLab({ ...newLab, specimenType: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Notes" value={newLab.notes} onChange={(e) => setNewLab({ ...newLab, notes: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                      </div>
                      <Button variant="secondary" onClick={addLabOrder} disabled={!newLab.testName.trim()}>Add test</Button>

                      {labOrders.length === 0 && (
                        <p className="text-label-md text-on-surface-variant">No tests selected (optional). Saved with the consultation.</p>
                      )}
                    </div>
                  )}

                  {isOpen && i === 5 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader(5)}
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
                        <input placeholder="Vaccine Name" value={newVax.vaccineName} onChange={(e) => setNewVax({ ...newVax, vaccineName: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Dose #" value={newVax.doseNumber} onChange={(e) => setNewVax({ ...newVax, doseNumber: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Route" value={newVax.route} onChange={(e) => setNewVax({ ...newVax, route: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Site" value={newVax.site} onChange={(e) => setNewVax({ ...newVax, site: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <input placeholder="Lot #" value={newVax.lotNumber} onChange={(e) => setNewVax({ ...newVax, lotNumber: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                        <DatePicker placeholder="Expiry" value={newVax.expiry} onChange={(expiry) => setNewVax({ ...newVax, expiry })} />
                        <input placeholder="Manufacturer" value={newVax.manufacturer} onChange={(e) => setNewVax({ ...newVax, manufacturer: e.target.value })} className="rounded-lg border border-outline-variant px-md py-sm" />
                      </div>
                      <Button variant="secondary" onClick={addVaccination}>Stage Vaccination</Button>
                    </div>
                  )}

                  {isOpen && i === 6 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader(6)}
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
                          <input placeholder="Reason" value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)} className="w-full rounded-lg border border-outline-variant px-md py-sm" />
                          <textarea placeholder="Instructions" value={followUpInstructions} onChange={(e) => setFollowUpInstructions(e.target.value)} className="w-full rounded-lg border border-outline-variant p-md" rows={2} />
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
                          <textarea
                            placeholder="Instructions"
                            value={followUpInstructions}
                            onChange={(e) => setFollowUpInstructions(e.target.value)}
                            className="w-full rounded-lg border border-outline-variant p-md"
                            rows={2}
                          />
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
                        <Link href="/doctor/templates" className="text-label-sm text-on-surface-variant hover:underline">
                          Manage templates
                        </Link>
                        <Button loading={issuingCert} disabled={!clinicRow} onClick={() => setCertConfirmPrint(true)}>
                          {certExists ? "Update & Print Certificate" : "Issue & Print Certificate"}
                        </Button>
                        <Button variant="secondary" loading={issuingCert} disabled={!clinicRow} onClick={() => setCertConfirmPrint(false)}>
                          Save without printing
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                        <input
                          value={mcAddress}
                          onChange={(e) => setMcAddress(e.target.value)}
                          placeholder="Patient address (&ldquo;residing at …&rdquo;)"
                          className="rounded-lg border border-outline-variant px-md py-sm text-body-md sm:col-span-2"
                        />
                        <input
                          value={mcExaminedAt}
                          onChange={(e) => setMcExaminedAt(e.target.value)}
                          placeholder={`Examined in… (default: ${doctorClinicLabel || clinicRow?.clinic_name || "clinic"})`}
                          className="rounded-lg border border-outline-variant px-md py-sm text-body-md sm:col-span-2"
                        />
                        <label className="text-label-sm text-on-surface-variant">
                          Examination from
                          <input type="date" value={mcExamFrom} onChange={(e) => setMcExamFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-md py-sm text-body-md" />
                        </label>
                        <label className="text-label-sm text-on-surface-variant">
                          Examination until
                          <input type="date" value={mcExamTo} onChange={(e) => setMcExamTo(e.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-md py-sm text-body-md" />
                        </label>
                      </div>
                      <textarea
                        value={mcDiagnosis}
                        onChange={(e) => setMcDiagnosis(e.target.value)}
                        placeholder={assessment ? `Diagnosis / Impressions (default: “${assessment}”)` : "Diagnosis / Impressions"}
                        rows={2}
                        className="w-full rounded-lg border border-outline-variant p-md text-body-md"
                      />
                      <textarea
                        value={mcRecommendations}
                        onChange={(e) => setMcRecommendations(e.target.value)}
                        placeholder={plan ? `Recommendations (default: “${plan}”)` : "Recommendations"}
                        rows={2}
                        className="w-full rounded-lg border border-outline-variant p-md text-body-md"
                      />
                      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                        <input
                          value={mcPurposeException}
                          onChange={(e) => setMcPurposeException(e.target.value)}
                          placeholder="Purpose exception (the &ldquo;except ___&rdquo; blank)"
                          className="rounded-lg border border-outline-variant px-md py-sm text-body-md"
                        />
                        <label className="text-label-sm text-on-surface-variant">
                          Please come back on
                          <input type="date" value={mcComeBackOn} onChange={(e) => setMcComeBackOn(e.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-md py-sm text-body-md" />
                        </label>
                      </div>
                    </div>
                  )}

                  {isOpen && i === 8 && (
                    <div className="mt-md space-y-md">
                      {renderSectionSaveHeader(8)}
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
                        <label className="flex items-center gap-sm text-body-md text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={medCertRequested}
                            onChange={(e) => setMedCertRequested(e.target.checked)}
                            className="h-5 w-5"
                          />
                          Medical certificate (+₱{feeSchedule?.medCert ?? 50}) — issue it in section 8
                        </label>
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

            {mode !== "complete" && !showOccasional && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setShowOccasional(true)}
              >
                Show occasional sections (Vaccinations · Fee)
              </Button>
            )}
            {mode !== "complete" && showOccasional && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowOccasional(false)}
              >
                Hide occasional sections
              </Button>
            )}

        </div>
        </div>
        {/* JJQR - END */}
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
        isOpen={saveMcTplOpen}
        onClose={() => setSaveMcTplOpen(false)}
        title="Save Certificate Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveMcTplOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMcAsTemplate} disabled={!saveMcTplTitle.trim()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-sm">
          <input
            value={saveMcTplTitle}
            onChange={(e) => setSaveMcTplTitle(e.target.value)}
            placeholder='Title (e.g. "Fit to Work", "Sick Leave 3 days")'
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <p className="text-label-sm text-on-surface-variant">
            Saves the Diagnosis/Impressions, Recommendations, and Purpose exception fields currently
            filled in — not the dates or the patient&apos;s address.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={saveTplOpen}
        onClose={() => setSaveTplOpen(false)}
        title="Save Diagnosis Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveTplOpen(false)}>Cancel</Button>
            <Button onClick={saveDiagnosisTemplate} disabled={!saveTplLabel.trim() || !newDiagnosisText.trim()}>Save</Button>
          </>
        }
      >
        <div className="space-y-sm">
          <p className="text-body-sm text-on-surface-variant">
            Diagnosis text: <span className="text-on-surface">{newDiagnosisText.trim() || "—"}</span>
          </p>
          <input
            value={saveTplLabel}
            onChange={(e) => setSaveTplLabel(e.target.value)}
            placeholder="Short label (e.g. URTI)"
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
        </div>
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
          <p className="mt-md rounded-lg bg-amber-50 px-md py-sm text-label-md text-amber-700">
            Add at least one medicine, or check “No medicines this visit”.
          </p>
        )}
        {!followUpSatisfied && (
          <p className="mt-md rounded-lg bg-amber-50 px-md py-sm text-label-md text-amber-700">
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
        isOpen={reviewSection !== null}
        onClose={() => setReviewSection(null)}
        title={reviewSection !== null ? SECTIONS[reviewSection] : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewSection(null)}>
              Go Back
            </Button>
            <Button
              loading={mode === "complete" ? savingDraft : savingChanges}
              onClick={() => {
                setReviewSection(null);
                saveCurrentProgress();
              }}
            >
              Confirm &amp; Save
            </Button>
          </>
        }
      >
        {(() => {
          const entry = buildConsultationRecord();
          return (
            <div className="space-y-md text-body-md">
              {reviewSection === 0 && (
                <>
                  <div>
                    <p className="text-label-sm text-on-surface-variant">Chief Complaint</p>
                    <p className="text-on-surface">{entry.chiefComplaint || "—"}</p>
                  </div>
                  {(entry.subjective || entry.objective || entry.assessment || entry.plan) && (
                    <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                      {([
                        ["Subjective", entry.subjective],
                        ["Objective", entry.objective],
                        ["Assessment", entry.assessment],
                        ["Plan", entry.plan],
                      ] as const).map(([label, value]) => (
                        <div key={label}>
                          <p className="text-label-sm text-on-surface-variant">{label}</p>
                          <p className="text-on-surface">{value || "—"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {reviewSection === 2 &&
                (entry.diagnoses.length === 0 ? (
                  <p className="text-on-surface-variant">No diagnoses entered.</p>
                ) : (
                  <ul className="space-y-xs">
                    {entry.diagnoses.map((d, i) => (
                      <li key={i} className="text-on-surface">
                        {d.description} <span className="text-label-sm text-on-surface-variant">({d.type})</span>
                      </li>
                    ))}
                  </ul>
                ))}
              {reviewSection === 5 &&
                (!entry.vaccinationsAdministered?.length ? (
                  <p className="text-on-surface-variant">No vaccinations staged.</p>
                ) : (
                  <ul className="space-y-xs">
                    {entry.vaccinationsAdministered.map((v, i) => (
                      <li key={i} className="text-on-surface">{v.vaccineName}</li>
                    ))}
                  </ul>
                ))}
              {reviewSection === 6 && (
                <div>
                  <p className="text-label-sm text-on-surface-variant">Follow-up</p>
                  <p className="text-on-surface">
                    {entry.followUpDate ? `${entry.followUpDate}${entry.followUpReason ? ` — ${entry.followUpReason}` : ""}` : "None set"}
                  </p>
                  {entry.followUpInstructions && (
                    <p className="mt-xs text-on-surface-variant">{entry.followUpInstructions}</p>
                  )}
                </div>
              )}
              {reviewSection === 8 &&
                (entry.feeDecision ? (
                  <p className="text-on-surface">
                    {entry.feeDecision.type === "Charge"
                      ? `Charge — ₱${entry.feeDecision.amount ?? 0}`
                      : `Waived — ${entry.feeDecision.waiveReason || "no reason given"}`}
                  </p>
                ) : (
                  <p className="text-on-surface-variant">No decision made yet.</p>
                ))}
              {saveError && (
                <p className="rounded-lg bg-error-container px-md py-sm text-label-md text-on-error-container">{saveError}</p>
              )}
            </div>
          );
        })()}
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
          <p><strong>Diagnosis:</strong> {mcDiagnosis || assessment || "—"}</p>
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-lowest shadow-[0_-4px_16px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] lg:inset-x-0 lg:left-[var(--app-main-left,var(--spacing-sidebar))] lg:right-0"
      >
        <div className="mx-auto flex w-full max-w-content flex-col gap-sm px-md py-sm lg:flex-row lg:items-center lg:justify-between lg:gap-md">
          {mode === "complete" && !canComplete && missingRequiredSections.length > 0 && (
            <div className="w-full">
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-md py-xs text-label-md text-amber-950 lg:w-auto"
                aria-expanded={needHintExpanded}
                onClick={() => setNeedHintExpanded((v) => !v)}
              >
                <span className="font-medium">
                  Need {missingRequiredSections.length}
                </span>
                <Icon name={needHintExpanded ? "expand_less" : "expand_more"} className="text-[20px]" aria-hidden />
              </button>
              {needHintExpanded && (
                <ul className="mt-xs space-y-xs rounded-lg border border-amber-200 bg-amber-50/80 px-md py-sm text-label-sm text-amber-950">
                  {missingRequiredSections.map((secIdx) => (
                    <li key={secIdx}>
                      <button
                        type="button"
                        className="min-h-[44px] w-full text-left font-medium text-primary underline"
                        onClick={() => {
                          setOpenSection(secIdx);
                          setNeedHintExpanded(false);
                        }}
                      >
                        {SECTIONS[secIdx]}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex items-center justify-end gap-xs sm:gap-sm">
            <Button
              variant="secondary"
              onClick={() => setHistoryOpen(true)}
              aria-label="Show History"
              className="min-h-[44px] flex-1 whitespace-nowrap px-sm sm:flex-none sm:px-lg"
            >
              <Icon name="history" className="text-[18px]" />
              <span className="hidden sm:inline">Show History</span>
              <span className="sm:hidden">History</span>
            </Button>
            {mode === "complete" && (
              <Button
                disabled={!canComplete}
                onClick={() => setChecklistOpen(true)}
                aria-label="Complete Consultation"
                className="min-h-[44px] flex-[1.2] whitespace-nowrap px-sm sm:flex-none sm:px-lg"
              >
                <span className="rounded-full bg-on-primary/20 px-xs text-label-sm">
                  {doneRequired}/{REQUIRED_SECTIONS.length}
                </span>
                <span className="sm:hidden">Complete</span>
                <span className="hidden sm:inline">Complete Consultation</span>
              </Button>
            )}
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
    <Suspense>
      <ConsultationWorkflow bookingId={bookingId} />
    </Suspense>
  );
}
