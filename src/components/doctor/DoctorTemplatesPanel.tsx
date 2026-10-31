"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import { Icon } from "@/components/ui/Icon";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { queryMedicines } from "@/lib/data/lookups";
import {
  queryDiagnosisTemplates,
  createDiagnosisTemplate,
  updateDiagnosisTemplate,
  deleteDiagnosisTemplate,
  type DiagnosisTemplateRow,
  querySoapPhrases,
  createSoapPhrase,
  updateSoapPhrase,
  deleteSoapPhrase,
  type SoapPhraseRow,
  querySoapTemplates,
  createSoapTemplate,
  updateSoapTemplate,
  deleteSoapTemplate,
  type SoapTemplateRow,
  queryFavoriteMedicines,
  addFavoriteMedicine,
  updateFavoriteMedicine,
  deleteFavoriteMedicine,
  type FavoriteMedicineRow,
  queryRxTemplates,
  createRxTemplate,
  updateRxTemplate,
  deleteRxTemplate,
  type RxTemplateRow,
  type RxItem,
  queryMedicalCertificateTemplates,
  createMedicalCertificateTemplate,
  updateMedicalCertificateTemplate,
  deleteMedicalCertificateTemplate,
  type MedicalCertificateTemplateRow,
} from "@/lib/data/clinical";
import { queryDoctorById } from "@/lib/data/doctors";
import {
  defaultSpecialtyFromDoctor,
  matchesSpecialtyFilter,
  SPECIALTY_CHIP_LABELS,
  type Specialty,
} from "@/lib/clinical/template-specialty";

const NIL = "00000000-0000-0000-0000-000000000000";

const SOAP_FIELDS: { value: string; label: string }[] = [
  { value: "ChiefComplaint", label: "Chief Complaint" },
  { value: "Subjective", label: "Subjective (history)" },
  { value: "Objective", label: "Objective (exam findings)" },
  { value: "Assessment", label: "Assessment" },
  { value: "Plan", label: "Plan" },
];
const soapFieldLabel = (v: string) => SOAP_FIELDS.find((f) => f.value === v)?.label ?? v;

const inputCls =
  "w-full rounded-lg border border-outline-variant px-md py-sm text-body-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const labelCls = "mb-xs block text-label-md text-on-surface-variant";

type TabId = "soap" | "prescriptions" | "diagnoses" | "med-certs" | "phrases";
type SourceFilter = "all" | "mine" | "system";

const TAB_HAS_SYSTEM: Record<TabId, boolean> = {
  soap: true,
  prescriptions: true,
  diagnoses: false,
  "med-certs": true,
  phrases: false,
};

const NEW_LABEL: Record<TabId, string> = {
  soap: "SOAP note",
  prescriptions: "prescription set",
  diagnoses: "diagnosis",
  "med-certs": "certificate template",
  phrases: "phrase",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function truncatePreview(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-md py-xs text-label-md transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high",
      )}
    >
      {children}
    </button>
  );
}

// ── drafts ────────────────────────────────────────────────────────────────
interface DiagnosisDraft {
  label: string;
  body: string;
}
interface PhraseDraft {
  field: string;
  label: string;
  body: string;
}
interface NoteDraft {
  title: string;
  chief_complaint: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}
interface FavDraft {
  rxId: string;
  generic_name: string;
  dosage: string;
  quantity: string;
  instruction: string;
}
interface RxLine {
  rxId: string;
  genericName: string;
  dosage: string;
  quantity: string;
  instruction: string;
}
interface RxDraft {
  title: string;
  items: RxLine[];
}
interface McDraft {
  title: string;
  diagnosis_text: string;
  recommendations: string;
  purpose_exception: string;
}

type DrawerState =
  | { kind: "template"; mode: "create" | "edit"; tab: TabId; id?: string }
  | { kind: "favorite"; mode: "create" | "edit"; id?: string }
  | null;

//JJQR - AI (Oct 31, 2026)
export function DoctorTemplatesPanel() {
  const { session, loading: sessionLoading } = useSession();
  const doctorId = session?.staffId ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [slowLoad, setSlowLoad] = useState(false);
  const [medicines, setMedicines] = useState<{ id: string; generic_name: string }[]>([]);

  const [diagnoses, setDiagnoses] = useState<DiagnosisTemplateRow[]>([]);
  const [phrases, setPhrases] = useState<SoapPhraseRow[]>([]);
  const [notes, setNotes] = useState<SoapTemplateRow[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMedicineRow[]>([]);
  const [rxSets, setRxSets] = useState<RxTemplateRow[]>([]);
  const [mcTemplates, setMcTemplates] = useState<MedicalCertificateTemplateRow[]>([]);

  const [activeTab, setActiveTab] = useState<TabId>("soap");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<Specialty | "All">("All");
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; variant: ToastVariant; message: string } | null>(null);

  function showToast(variant: ToastVariant, message: string) {
    setToast({ key: Date.now(), variant, message });
  }

  const [diagnosisDraft, setDiagnosisDraft] = useState<DiagnosisDraft>({ label: "", body: "" });
  const [phraseDraft, setPhraseDraft] = useState<PhraseDraft>({ field: "ChiefComplaint", label: "", body: "" });
  const [noteDraft, setNoteDraft] = useState<NoteDraft>({
    title: "",
    chief_complaint: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });
  const [favDraft, setFavDraft] = useState<FavDraft>({
    rxId: "",
    generic_name: "",
    dosage: "",
    quantity: "",
    instruction: "",
  });
  const [rxDraft, setRxDraft] = useState<RxDraft>({
    title: "",
    items: [{ rxId: "", genericName: "", dosage: "", quantity: "", instruction: "" }],
  });
  const [mcDraft, setMcDraft] = useState<McDraft>({
    title: "",
    diagnosis_text: "",
    recommendations: "",
    purpose_exception: "",
  });

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlowLoad(true), 6000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (sessionLoading) return;
    (async () => {
      if (!doctorId) {
        setLoadError("Could not identify your doctor account.");
        setLoading(false);
        return;
      }
      try {
        const [dx, ph, nt, fav, rx, meds, mc, doc] = await Promise.all([
          queryDiagnosisTemplates(),
          querySoapPhrases(null as never, doctorId),
          querySoapTemplates(null as never, doctorId),
          queryFavoriteMedicines(null as never, doctorId),
          queryRxTemplates(null as never, doctorId),
          queryMedicines(null as never),
          queryMedicalCertificateTemplates(null as never, doctorId),
          queryDoctorById(null as never, doctorId).catch(() => null),
        ]);
        if (doc?.specialization) {
          setSpecialtyFilter(defaultSpecialtyFromDoctor(doc.specialization));
        }
        setDiagnoses(dx);
        setPhrases(ph);
        setNotes(nt);
        setFavorites(fav);
        setRxSets(rx);
        setMedicines(meds.map((m) => ({ id: m.medicine_id, generic_name: m.generic_name })));
        setMcTemplates(mc);
      } catch {
        setLoadError("Could not load your templates. Refresh to try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [doctorId, sessionLoading]);

  const bySortedTitle = <T extends { label?: string; title?: string }>(a: T, b: T) =>
    (a.label ?? a.title ?? "").localeCompare(b.label ?? b.title ?? "");

  const rxItemsFromLines = (items: RxLine[]): Omit<RxItem, "id">[] =>
    items
      .filter((i) => i.genericName.trim())
      .map((i) => ({
        medicine_id: i.rxId || NIL,
        generic_name: i.genericName.trim(),
        dosage: i.dosage.trim(),
        quantity: i.quantity.trim(),
        instruction: i.instruction.trim() || null,
        is_controlled_substance: false,
      }));

  const tabCounts = useMemo(
    () => ({
      soap: notes.length,
      prescriptions: rxSets.length,
      diagnoses: diagnoses.length,
      "med-certs": mcTemplates.length,
      phrases: phrases.length,
    }),
    [notes.length, rxSets.length, diagnoses.length, mcTemplates.length, phrases.length],
  );

  const tabs = useMemo(
    () =>
      (
        [
          ["soap", "SOAP"],
          ["prescriptions", "Prescriptions"],
          ["diagnoses", "Diagnoses"],
          ["med-certs", "Med Certs"],
          ["phrases", "Phrases"],
        ] as const
      ).map(([id, label]) => ({
        id,
        label: `${label} (${tabCounts[id]})`,
      })),
    [tabCounts],
  );

  const showSourceChips = TAB_HAS_SYSTEM[activeTab];

  const searchLower = search.trim().toLowerCase();

  const filteredNotes = useMemo(() => {
    return [...notes]
      .filter((t) => {
        if (showSourceChips && sourceFilter === "system") return t.is_system_template;
        if (showSourceChips && sourceFilter === "mine") return !t.is_system_template;
        return true;
      })
      .filter((t) => matchesSpecialtyFilter("soap", t.title, specialtyFilter))
      .filter((t) => {
        const preview = [t.title, t.chief_complaint, t.assessment].filter(Boolean).join(" ");
        return !searchLower || preview.toLowerCase().includes(searchLower);
      })
      .sort(bySortedTitle);
  }, [notes, sourceFilter, searchLower, showSourceChips, specialtyFilter]);

  const filteredRx = useMemo(() => {
    return [...rxSets]
      .filter((t) => {
        if (showSourceChips && sourceFilter === "system") return t.is_system_template;
        if (showSourceChips && sourceFilter === "mine") return !t.is_system_template;
        return true;
      })
      .filter((t) => matchesSpecialtyFilter("rx", t.title, specialtyFilter))
      .filter((t) => {
        const items = (t.prescription_template_items ?? []).map((i) => i.generic_name).join(" ");
        const hay = `${t.title} ${items}`;
        return !searchLower || hay.toLowerCase().includes(searchLower);
      })
      .sort(bySortedTitle);
  }, [rxSets, sourceFilter, searchLower, showSourceChips, specialtyFilter]);

  const filteredMc = useMemo(() => {
    return [...mcTemplates]
      .filter((t) => {
        if (showSourceChips && sourceFilter === "system") return t.is_system_template;
        if (showSourceChips && sourceFilter === "mine") return !t.is_system_template;
        return true;
      })
      .filter((t) => matchesSpecialtyFilter("mc", t.title, specialtyFilter))
      .filter((t) => {
        const hay = `${t.title} ${t.diagnosis_text ?? ""}`;
        return !searchLower || hay.toLowerCase().includes(searchLower);
      })
      .sort(bySortedTitle);
  }, [mcTemplates, sourceFilter, searchLower, showSourceChips, specialtyFilter]);

  const filteredDiagnoses = useMemo(() => {
    return [...diagnoses]
      .filter((t) => matchesSpecialtyFilter("diagnosis", t.label, specialtyFilter))
      .filter((t) => {
        const hay = `${t.label} ${t.body}`;
        return !searchLower || hay.toLowerCase().includes(searchLower);
      })
      .sort(bySortedTitle);
  }, [diagnoses, searchLower, specialtyFilter]);

  const filteredPhrases = useMemo(() => {
    return [...phrases]
      .filter((p) => matchesSpecialtyFilter("phrase", p.label, specialtyFilter))
      .filter((p) => {
        const hay = `${p.label} ${soapFieldLabel(p.field)} ${p.body}`;
        return !searchLower || hay.toLowerCase().includes(searchLower);
      })
      .sort(bySortedTitle);
  }, [phrases, searchLower, specialtyFilter]);

  const mineSoapTitles = useMemo(
    () => notes.filter((n) => !n.is_system_template).map((n) => n.title),
    [notes],
  );
  const mineRxTitles = useMemo(
    () => rxSets.filter((r) => !r.is_system_template).map((r) => r.title),
    [rxSets],
  );
  const mineMcTitles = useMemo(
    () => mcTemplates.filter((m) => !m.is_system_template).map((m) => m.title),
    [mcTemplates],
  );

  const hasMineTitle = (title: string, mineTitles: string[]) =>
    mineTitles.some((t) => t.toLowerCase() === title.toLowerCase());

  function nextCopyTitle(title: string, mineTitles: string[]): string {
    let n = 2;
    while (mineTitles.some((t) => t.toLowerCase() === `${title} (${n})`.toLowerCase())) n += 1;
    return `${title} (${n})`;
  }

  function findMineSoap(title: string) {
    return notes.find((n) => !n.is_system_template && n.title.toLowerCase() === title.toLowerCase());
  }
  function findMineRx(title: string) {
    return rxSets.find((r) => !r.is_system_template && r.title.toLowerCase() === title.toLowerCase());
  }
  function findMineMc(title: string) {
    return mcTemplates.find((m) => !m.is_system_template && m.title.toLowerCase() === title.toLowerCase());
  }

  function openCreate(tab: TabId) {
    setDrawerError("");
    setDeleteConfirmId(null);
    if (tab === "diagnoses") setDiagnosisDraft({ label: "", body: "" });
    if (tab === "phrases") setPhraseDraft({ field: "ChiefComplaint", label: "", body: "" });
    if (tab === "soap") {
      setNoteDraft({ title: "", chief_complaint: "", subjective: "", objective: "", assessment: "", plan: "" });
    }
    if (tab === "prescriptions") {
      setRxDraft({ title: "", items: [{ rxId: "", genericName: "", dosage: "", quantity: "", instruction: "" }] });
    }
    if (tab === "med-certs") {
      setMcDraft({ title: "", diagnosis_text: "", recommendations: "", purpose_exception: "" });
    }
    setDrawer({ kind: "template", mode: "create", tab });
  }

  function openEditSoap(t: SoapTemplateRow) {
    setDrawerError("");
    setNoteDraft({
      title: t.title,
      chief_complaint: t.chief_complaint ?? "",
      subjective: t.subjective ?? "",
      objective: t.objective ?? "",
      assessment: t.assessment ?? "",
      plan: t.plan ?? "",
    });
    setDrawer({ kind: "template", mode: "edit", tab: "soap", id: t.id });
  }

  function openEditRx(t: RxTemplateRow) {
    setDrawerError("");
    setRxDraft({
      title: t.title,
      items: (t.prescription_template_items ?? []).map((i) => ({
        rxId: i.medicine_id && i.medicine_id !== NIL ? i.medicine_id : "",
        genericName: i.generic_name,
        dosage: i.dosage,
        quantity: i.quantity,
        instruction: i.instruction ?? "",
      })),
    });
    setDrawer({ kind: "template", mode: "edit", tab: "prescriptions", id: t.template_id });
  }

  function openEditMc(t: MedicalCertificateTemplateRow) {
    setDrawerError("");
    setMcDraft({
      title: t.title,
      diagnosis_text: t.diagnosis_text ?? "",
      recommendations: t.recommendations ?? "",
      purpose_exception: t.purpose_exception ?? "",
    });
    setDrawer({ kind: "template", mode: "edit", tab: "med-certs", id: t.id });
  }

  function openEditDiagnosis(t: DiagnosisTemplateRow) {
    setDrawerError("");
    setDiagnosisDraft({ label: t.label, body: t.body });
    setDrawer({ kind: "template", mode: "edit", tab: "diagnoses", id: t.id });
  }

  function openEditPhrase(p: SoapPhraseRow) {
    setDrawerError("");
    setPhraseDraft({ field: p.field, label: p.label, body: p.body });
    setDrawer({ kind: "template", mode: "edit", tab: "phrases", id: p.id });
  }

  function openCreateFavorite() {
    setDrawerError("");
    setFavDraft({ rxId: "", generic_name: "", dosage: "", quantity: "", instruction: "" });
    setDrawer({ kind: "favorite", mode: "create" });
  }

  function openEditFavorite(f: FavoriteMedicineRow) {
    setDrawerError("");
    setFavDraft({
      rxId: f.medicine_id && f.medicine_id !== NIL ? f.medicine_id : "",
      generic_name: f.generic_name,
      dosage: f.dosage,
      quantity: f.quantity,
      instruction: f.instruction ?? "",
    });
    setDrawer({ kind: "favorite", mode: "edit", id: f.id });
  }

  function closeDrawer() {
    if (drawerSaving) return;
    setDrawer(null);
    setDrawerError("");
    setDeleteConfirmId(null);
  }

  const drawerTitle = (() => {
    if (!drawer) return "";
    if (drawer.kind === "favorite") {
      return drawer.mode === "create" ? "New favourite medicine" : "Edit favourite medicine";
    }
    const noun = NEW_LABEL[drawer.tab];
    return drawer.mode === "create" ? `New ${noun}` : `Edit ${noun}`;
  })();

  function isDraftValid(): boolean {
    if (!drawer) return false;
    if (drawer.kind === "favorite") {
      return !!favDraft.generic_name.trim() && !!favDraft.dosage.trim() && !!favDraft.quantity.trim();
    }
    switch (drawer.tab) {
      case "diagnoses":
        return !!diagnosisDraft.label.trim() && !!diagnosisDraft.body.trim();
      case "phrases":
        return !!phraseDraft.field && !!phraseDraft.label.trim() && !!phraseDraft.body.trim();
      case "soap":
        return !!noteDraft.title.trim();
      case "prescriptions":
        return !!rxDraft.title.trim() && rxDraft.items.some((i) => i.genericName.trim());
      case "med-certs":
        return !!mcDraft.title.trim();
      default:
        return false;
    }
  }

  async function handleDrawerSave() {
    if (!drawer || !isDraftValid()) return;
    setDrawerSaving(true);
    setDrawerError("");
    try {
      if (drawer.kind === "favorite") {
        if (drawer.mode === "create") {
          const c = await addFavoriteMedicine(null as never, doctorId, {
            medicine_id: favDraft.rxId || NIL,
            generic_name: favDraft.generic_name.trim(),
            dosage: favDraft.dosage.trim(),
            quantity: favDraft.quantity.trim(),
            instruction: favDraft.instruction.trim() || null,
          });
          setFavorites((p) => [...p, c]);
        } else if (drawer.id) {
          const u = await updateFavoriteMedicine(null as never, drawer.id, {
            medicine_id: favDraft.rxId || NIL,
            generic_name: favDraft.generic_name.trim(),
            dosage: favDraft.dosage.trim(),
            quantity: favDraft.quantity.trim(),
            instruction: favDraft.instruction.trim() || null,
          });
          setFavorites((p) => p.map((x) => (x.id === drawer.id ? u : x)));
        }
        closeDrawer();
        return;
      }

      if (drawer.mode === "create") {
        if (drawer.tab === "diagnoses") {
          const c = await createDiagnosisTemplate(null as never, {
            label: diagnosisDraft.label.trim(),
            body: diagnosisDraft.body.trim(),
          });
          setDiagnoses((p) => [...p, c]);
        } else if (drawer.tab === "phrases") {
          const c = await createSoapPhrase(null as never, doctorId, {
            field: phraseDraft.field,
            label: phraseDraft.label.trim(),
            body: phraseDraft.body.trim(),
          });
          setPhrases((p) => [...p, c]);
        } else if (drawer.tab === "soap") {
          const c = await createSoapTemplate(null as never, doctorId, {
            title: noteDraft.title.trim(),
            is_system_template: false,
            chief_complaint: noteDraft.chief_complaint.trim() || null,
            subjective: noteDraft.subjective.trim() || null,
            objective: noteDraft.objective.trim() || null,
            assessment: noteDraft.assessment.trim() || null,
            plan: noteDraft.plan.trim() || null,
          });
          setNotes((p) => [...p, c]);
        } else if (drawer.tab === "prescriptions") {
          const c = await createRxTemplate(null as never, doctorId, {
            title: rxDraft.title.trim(),
            is_system_template: false,
            items: rxItemsFromLines(rxDraft.items),
          });
          setRxSets((p) => [...p, c]);
        } else if (drawer.tab === "med-certs") {
          const c = await createMedicalCertificateTemplate(null as never, doctorId, {
            title: mcDraft.title.trim(),
            is_system_template: false,
            diagnosis_text: mcDraft.diagnosis_text.trim() || null,
            recommendations: mcDraft.recommendations.trim() || null,
            purpose_exception: mcDraft.purpose_exception.trim() || null,
          });
          setMcTemplates((p) => [...p, c]);
        }
      } else if (drawer.id) {
        if (drawer.tab === "diagnoses") {
          const u = await updateDiagnosisTemplate(null as never, drawer.id, {
            label: diagnosisDraft.label.trim(),
            body: diagnosisDraft.body.trim(),
          });
          setDiagnoses((p) => p.map((x) => (x.id === drawer.id ? u : x)));
        } else if (drawer.tab === "phrases") {
          const u = await updateSoapPhrase(null as never, drawer.id, {
            field: phraseDraft.field,
            label: phraseDraft.label.trim(),
            body: phraseDraft.body.trim(),
          });
          setPhrases((p) => p.map((x) => (x.id === drawer.id ? u : x)));
        } else if (drawer.tab === "soap") {
          const u = await updateSoapTemplate(null as never, drawer.id, {
            title: noteDraft.title.trim(),
            is_system_template: false,
            chief_complaint: noteDraft.chief_complaint.trim() || null,
            subjective: noteDraft.subjective.trim() || null,
            objective: noteDraft.objective.trim() || null,
            assessment: noteDraft.assessment.trim() || null,
            plan: noteDraft.plan.trim() || null,
          });
          setNotes((p) => p.map((x) => (x.id === drawer.id ? u : x)));
        } else if (drawer.tab === "prescriptions") {
          const u = await updateRxTemplate(null as never, drawer.id, doctorId, {
            title: rxDraft.title.trim(),
            is_system_template: false,
            items: rxItemsFromLines(rxDraft.items),
          });
          setRxSets((p) => p.map((x) => (x.template_id === drawer.id ? u : x)));
        } else if (drawer.tab === "med-certs") {
          const u = await updateMedicalCertificateTemplate(null as never, drawer.id, {
            title: mcDraft.title.trim(),
            is_system_template: false,
            diagnosis_text: mcDraft.diagnosis_text.trim() || null,
            recommendations: mcDraft.recommendations.trim() || null,
            purpose_exception: mcDraft.purpose_exception.trim() || null,
          });
          setMcTemplates((p) => p.map((x) => (x.id === drawer.id ? u : x)));
        }
      }
      closeDrawer();
    } catch {
      setDrawerError("Could not save. Try again.");
    } finally {
      setDrawerSaving(false);
    }
  }

  async function handleDelete(tab: TabId, id: string) {
    try {
      if (tab === "soap") {
        await deleteSoapTemplate(null as never, id);
        setNotes((p) => p.filter((x) => x.id !== id));
      } else if (tab === "prescriptions") {
        await deleteRxTemplate(null as never, id);
        setRxSets((p) => p.filter((x) => x.template_id !== id));
      } else if (tab === "med-certs") {
        await deleteMedicalCertificateTemplate(null as never, id);
        setMcTemplates((p) => p.filter((x) => x.id !== id));
      } else if (tab === "diagnoses") {
        await deleteDiagnosisTemplate(null as never, id);
        setDiagnoses((p) => p.filter((x) => x.id !== id));
      } else if (tab === "phrases") {
        await deleteSoapPhrase(null as never, id);
        setPhrases((p) => p.filter((x) => x.id !== id));
      }
      setDeleteConfirmId(null);
    } catch {
      setDrawerError("Could not delete. Try again.");
    }
  }

  //JJQR - AI (Oct 31, 2026)
  async function handleDuplicateSoap(t: SoapTemplateRow, copyTitle?: string) {
    const title = copyTitle ?? t.title;
    setDuplicatingId(t.id);
    try {
      const c = await createSoapTemplate(null as never, doctorId, {
        title,
        is_system_template: false,
        chief_complaint: t.chief_complaint,
        subjective: t.subjective,
        objective: t.objective,
        assessment: t.assessment,
        plan: t.plan,
      });
      setNotes((p) => [...p, c]);
      showToast("success", `Copied as ${title}.`);
      openEditSoap(c);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleDuplicateRx(t: RxTemplateRow, copyTitle?: string) {
    const title = copyTitle ?? t.title;
    setDuplicatingId(t.template_id);
    try {
      const items = (t.prescription_template_items ?? []).map((i) => ({
        medicine_id: i.medicine_id,
        generic_name: i.generic_name,
        dosage: i.dosage,
        quantity: i.quantity,
        instruction: i.instruction,
        is_controlled_substance: i.is_controlled_substance ?? false,
      }));
      const c = await createRxTemplate(null as never, doctorId, {
        title,
        is_system_template: false,
        items,
      });
      setRxSets((p) => [...p, c]);
      showToast("success", `Copied as ${title}.`);
      openEditRx(c);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleDuplicateMc(t: MedicalCertificateTemplateRow, copyTitle?: string) {
    const title = copyTitle ?? t.title;
    setDuplicatingId(t.id);
    try {
      const c = await createMedicalCertificateTemplate(null as never, doctorId, {
        title,
        is_system_template: false,
        diagnosis_text: t.diagnosis_text,
        recommendations: t.recommendations,
        purpose_exception: t.purpose_exception,
      });
      setMcTemplates((p) => [...p, c]);
      showToast("success", `Copied as ${title}.`);
      openEditMc(c);
    } finally {
      setDuplicatingId(null);
    }
  }
  //JJQR - END

  async function handleDeleteFavorite(id: string) {
    try {
      await deleteFavoriteMedicine(null as never, id);
      setFavorites((p) => p.filter((x) => x.id !== id));
      setDeleteConfirmId(null);
    } catch {
      setDrawerError("Could not delete favourite.");
    }
  }

  const listEmpty =
    (activeTab === "soap" && filteredNotes.length === 0) ||
    (activeTab === "prescriptions" && filteredRx.length === 0) ||
    (activeTab === "diagnoses" && filteredDiagnoses.length === 0) ||
    (activeTab === "med-certs" && filteredMc.length === 0) ||
    (activeTab === "phrases" && filteredPhrases.length === 0);

  function renderTemplateCard(
    key: string,
    title: string,
    preview: string,
    isSystem: boolean,
    tab: TabId,
    id: string,
    onDuplicate?: (copyTitle?: string) => void,
    mineTitleExists?: boolean,
    onEditMine?: () => void,
    onEdit?: () => void,
    suffixedCopyTitle?: string,
  ) {
    const confirming = deleteConfirmId === id;
    return (
      <Card key={key} className="flex h-full flex-col gap-sm">
        <div className="flex items-start justify-between gap-sm">
          <h3 className="text-title-md text-on-surface">{title}</h3>
          {isSystem ? (
            <StatusPill tone="info" label="System" className="shrink-0 normal-case" />
          ) : (
            <StatusPill tone="neutral" label="Mine" className="shrink-0 normal-case" />
          )}
        </div>
        {preview ? (
          <p className="line-clamp-2 flex-1 text-body-md text-on-surface-variant">{preview}</p>
        ) : (
          <p className="flex-1 text-body-md italic text-on-surface-variant/70">No preview text</p>
        )}
        {confirming ? (
          <div className="mt-sm rounded-lg border border-outline-variant bg-surface-container-low px-sm py-sm">
            <p className="text-label-md text-on-surface">Delete this template?</p>
            <div className="mt-sm flex flex-wrap gap-sm">
              <Button variant="danger" className="text-label-md" onClick={() => handleDelete(tab, id)}>
                Delete
              </Button>
              <Button variant="ghost" className="text-label-md" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-sm flex flex-wrap gap-sm">
            {isSystem ? (
              mineTitleExists ? (
                <>
                  <Button variant="secondary" className="text-label-md" onClick={onEditMine}>
                    Edit my copy
                  </Button>
                  <Button
                    variant="secondary"
                    className="text-label-md"
                    disabled={duplicatingId === id}
                    loading={duplicatingId === id}
                    onClick={() => onDuplicate?.(suffixedCopyTitle)}
                  >
                    Copy as &apos;{suffixedCopyTitle ?? `${title} (2)`}&apos;
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  className="text-label-md"
                  disabled={duplicatingId === id}
                  loading={duplicatingId === id}
                  onClick={() => onDuplicate?.()}
                >
                  Copy &amp; edit
                </Button>
              )
            ) : (
              <>
                <Button variant="secondary" className="text-label-md" onClick={onEdit}>
                  Edit
                </Button>
                <Button variant="ghost" className="text-label-md text-error" onClick={() => setDeleteConfirmId(id)}>
                  Delete
                </Button>
              </>
            )}
          </div>
        )}
      </Card>
    );
  }

  function renderDrawerForm() {
    if (!drawer) return null;
    if (drawer.kind === "favorite") {
      return (
        <div className="space-y-md">
          <Field label="Medicine name">
            <input
              className={inputCls}
              list="settings-medicines"
              value={favDraft.generic_name}
              onChange={(e) => {
                const name = e.target.value;
                const match = medicines.find((m) => m.generic_name.toLowerCase() === name.toLowerCase());
                setFavDraft({ ...favDraft, generic_name: name, rxId: match?.id ?? "" });
              }}
              placeholder="Start typing…"
            />
          </Field>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <Field label="Dose (e.g. 500 mg)">
              <input
                className={inputCls}
                value={favDraft.dosage}
                onChange={(e) => setFavDraft({ ...favDraft, dosage: e.target.value })}
              />
            </Field>
            <Field label="How many (e.g. 20 tablets)">
              <input
                className={inputCls}
                value={favDraft.quantity}
                onChange={(e) => setFavDraft({ ...favDraft, quantity: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Directions (e.g. 1 tablet 3× a day after meals)">
            <input
              className={inputCls}
              value={favDraft.instruction}
              onChange={(e) => setFavDraft({ ...favDraft, instruction: e.target.value })}
            />
          </Field>
        </div>
      );
    }

    switch (drawer.tab) {
      case "diagnoses":
        return (
          <div className="space-y-md">
            <Field label="Short label (what you see in the list)">
              <input
                className={inputCls}
                value={diagnosisDraft.label}
                onChange={(e) => setDiagnosisDraft({ ...diagnosisDraft, label: e.target.value })}
                placeholder="e.g. URTI"
              />
            </Field>
            <Field label="Diagnosis text (goes onto the record)">
              <textarea
                className={inputCls}
                rows={2}
                value={diagnosisDraft.body}
                onChange={(e) => setDiagnosisDraft({ ...diagnosisDraft, body: e.target.value })}
              />
            </Field>
          </div>
        );
      case "phrases":
        return (
          <div className="space-y-md">
            <Field label="Which note box is this for?">
              <select
                className={inputCls}
                value={phraseDraft.field}
                onChange={(e) => setPhraseDraft({ ...phraseDraft, field: e.target.value })}
              >
                {SOAP_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Short label (what you see in the list)">
              <input
                className={inputCls}
                value={phraseDraft.label}
                onChange={(e) => setPhraseDraft({ ...phraseDraft, label: e.target.value })}
                placeholder='e.g. "Normal chest exam"'
              />
            </Field>
            <Field label="The text to insert">
              <textarea
                className={inputCls}
                rows={2}
                value={phraseDraft.body}
                onChange={(e) => setPhraseDraft({ ...phraseDraft, body: e.target.value })}
              />
            </Field>
          </div>
        );
      case "soap":
        return (
          <div className="space-y-md">
            <Field label="Template name">
              <input
                className={inputCls}
                value={noteDraft.title}
                onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })}
                placeholder='e.g. "Adult check-up — normal"'
              />
            </Field>
            <Field label="Chief Complaint">
              <textarea
                className={inputCls}
                rows={2}
                value={noteDraft.chief_complaint}
                onChange={(e) => setNoteDraft({ ...noteDraft, chief_complaint: e.target.value })}
              />
            </Field>
            <Field label="Subjective (history)">
              <textarea
                className={inputCls}
                rows={2}
                value={noteDraft.subjective}
                onChange={(e) => setNoteDraft({ ...noteDraft, subjective: e.target.value })}
              />
            </Field>
            <Field label="Objective (exam findings)">
              <textarea
                className={inputCls}
                rows={2}
                value={noteDraft.objective}
                onChange={(e) => setNoteDraft({ ...noteDraft, objective: e.target.value })}
              />
            </Field>
            <Field label="Assessment">
              <textarea
                className={inputCls}
                rows={2}
                value={noteDraft.assessment}
                onChange={(e) => setNoteDraft({ ...noteDraft, assessment: e.target.value })}
              />
            </Field>
            <Field label="Plan">
              <textarea
                className={inputCls}
                rows={2}
                value={noteDraft.plan}
                onChange={(e) => setNoteDraft({ ...noteDraft, plan: e.target.value })}
              />
            </Field>
          </div>
        );
      case "prescriptions":
        return (
          <div className="space-y-md">
            <Field label="Set name">
              <input
                className={inputCls}
                value={rxDraft.title}
                onChange={(e) => setRxDraft({ ...rxDraft, title: e.target.value })}
                placeholder='e.g. "Cough & cold — adult"'
              />
            </Field>
            <div className="space-y-md">
              {rxDraft.items.map((line, idx) => (
                <div key={idx} className="space-y-sm rounded-lg border border-outline-variant p-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-label-md text-on-surface-variant">Medicine {idx + 1}</span>
                    {rxDraft.items.length > 1 && (
                      <button
                        type="button"
                        className="text-label-md text-primary hover:underline"
                        onClick={() => setRxDraft({ ...rxDraft, items: rxDraft.items.filter((_, i) => i !== idx) })}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    className={inputCls}
                    list="settings-medicines"
                    placeholder="Medicine name"
                    value={line.genericName}
                    onChange={(e) => {
                      const name = e.target.value;
                      const match = medicines.find((m) => m.generic_name.toLowerCase() === name.toLowerCase());
                      const items = rxDraft.items.slice();
                      items[idx] = { ...line, genericName: name, rxId: match?.id ?? "" };
                      setRxDraft({ ...rxDraft, items });
                    }}
                  />
                  <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
                    <input
                      className={inputCls}
                      placeholder="Dose (e.g. 500 mg)"
                      value={line.dosage}
                      onChange={(e) => {
                        const items = rxDraft.items.slice();
                        items[idx] = { ...line, dosage: e.target.value };
                        setRxDraft({ ...rxDraft, items });
                      }}
                    />
                    <input
                      className={inputCls}
                      placeholder="How many (e.g. 20 tablets)"
                      value={line.quantity}
                      onChange={(e) => {
                        const items = rxDraft.items.slice();
                        items[idx] = { ...line, quantity: e.target.value };
                        setRxDraft({ ...rxDraft, items });
                      }}
                    />
                  </div>
                  <input
                    className={inputCls}
                    placeholder="Directions"
                    value={line.instruction}
                    onChange={(e) => {
                      const items = rxDraft.items.slice();
                      items[idx] = { ...line, instruction: e.target.value };
                      setRxDraft({ ...rxDraft, items });
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-label-md text-primary hover:underline"
                onClick={() =>
                  setRxDraft({
                    ...rxDraft,
                    items: [...rxDraft.items, { rxId: "", genericName: "", dosage: "", quantity: "", instruction: "" }],
                  })
                }
              >
                + Add another medicine
              </button>
            </div>
          </div>
        );
      case "med-certs":
        return (
          <div className="space-y-md">
            <Field label="Template name">
              <input
                className={inputCls}
                value={mcDraft.title}
                onChange={(e) => setMcDraft({ ...mcDraft, title: e.target.value })}
                placeholder='e.g. "Fit to Work"'
              />
            </Field>
            <Field label="Diagnosis / Impressions">
              <textarea
                className={inputCls}
                rows={2}
                value={mcDraft.diagnosis_text}
                onChange={(e) => setMcDraft({ ...mcDraft, diagnosis_text: e.target.value })}
              />
            </Field>
            <Field label="Recommendations">
              <textarea
                className={inputCls}
                rows={2}
                value={mcDraft.recommendations}
                onChange={(e) => setMcDraft({ ...mcDraft, recommendations: e.target.value })}
              />
            </Field>
            <Field label="Purpose exception (the “except ___” blank)">
              <input
                className={inputCls}
                value={mcDraft.purpose_exception}
                onChange={(e) => setMcDraft({ ...mcDraft, purpose_exception: e.target.value })}
              />
            </Field>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-lg">
      {toast && <Toast key={toast.key} variant={toast.variant} message={toast.message} />}
      {/* JJQR - AI (Oct 31, 2026) */}
      {loadError && (
        <p className="rounded-lg bg-error-container px-md py-sm text-body-md text-on-error-container">{loadError}</p>
      )}

      {loading ? (
        <div className="space-y-lg">
          {slowLoad && (
            <p className="rounded-lg bg-surface-container-low px-md py-sm text-label-md text-on-surface-variant">
              Still loading — this is taking longer than usual.
            </p>
          )}
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : (
        <>
          <Tabs
            tabs={tabs}
            activeId={activeTab}
            onChange={(id) => {
              const tab = id as TabId;
              setActiveTab(tab);
              if (!TAB_HAS_SYSTEM[tab] && sourceFilter !== "all") setSourceFilter("all");
            }}
          />

          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-sm sm:flex-row sm:items-center">
                <label className="block min-w-0 flex-1">
                  <span className="sr-only">Search templates</span>
                  <div className="relative">
                    <Icon
                      name="search"
                      className="pointer-events-none absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search this tab…"
                      className={cn(inputCls, "pl-[2.75rem]")}
                    />
                  </div>
                </label>
                {showSourceChips && (
                  <div className="flex gap-xs overflow-x-auto pb-xs">
                    <FilterChip active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>
                      All
                    </FilterChip>
                    <FilterChip active={sourceFilter === "mine"} onClick={() => setSourceFilter("mine")}>
                      Mine
                    </FilterChip>
                    <FilterChip active={sourceFilter === "system"} onClick={() => setSourceFilter("system")}>
                      System
                    </FilterChip>
                  </div>
                )}
                <div className="flex gap-xs overflow-x-auto pb-xs">
                  {SPECIALTY_CHIP_LABELS.map(({ id, label }) => (
                    <FilterChip key={id} active={specialtyFilter === id} onClick={() => setSpecialtyFilter(id)}>
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <Button className="shrink-0" onClick={() => openCreate(activeTab)}>
                <Icon name="add" className="mr-xs text-[18px]" />
                New
              </Button>
            </div>

            {listEmpty ? (
              <EmptyState
                icon="clinical_notes"
                message={
                  search || sourceFilter !== "all"
                    ? "No templates match your search or filters."
                    : `No ${NEW_LABEL[activeTab]}s yet.`
                }
                action={
                  search || sourceFilter !== "all" ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch("");
                        setSourceFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button onClick={() => openCreate(activeTab)}>Create one</Button>
                  )
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                {activeTab === "soap" &&
                  filteredNotes.map((t) =>
                    renderTemplateCard(
                      t.id,
                      t.title,
                      truncatePreview([t.chief_complaint, t.assessment].filter(Boolean).join(" · ")),
                      t.is_system_template,
                      "soap",
                      t.id,
                      (copyTitle) => void handleDuplicateSoap(t, copyTitle),
                      t.is_system_template && hasMineTitle(t.title, mineSoapTitles),
                      () => {
                        const mine = findMineSoap(t.title);
                        if (mine) openEditSoap(mine);
                      },
                      () => openEditSoap(t),
                      nextCopyTitle(t.title, mineSoapTitles),
                    ),
                  )}
                {activeTab === "prescriptions" &&
                  filteredRx.map((t) =>
                    renderTemplateCard(
                      t.template_id,
                      t.title,
                      truncatePreview((t.prescription_template_items ?? []).map((i) => i.generic_name).join(", ")),
                      t.is_system_template,
                      "prescriptions",
                      t.template_id,
                      (copyTitle) => void handleDuplicateRx(t, copyTitle),
                      t.is_system_template && hasMineTitle(t.title, mineRxTitles),
                      () => {
                        const mine = findMineRx(t.title);
                        if (mine) openEditRx(mine);
                      },
                      () => openEditRx(t),
                      nextCopyTitle(t.title, mineRxTitles),
                    ),
                  )}
                {activeTab === "diagnoses" &&
                  filteredDiagnoses.map((t) =>
                    renderTemplateCard(
                      t.id,
                      t.label,
                      truncatePreview(t.body),
                      false,
                      "diagnoses",
                      t.id,
                      undefined,
                      undefined,
                      undefined,
                      () => openEditDiagnosis(t),
                    ),
                  )}
                {activeTab === "med-certs" &&
                  filteredMc.map((t) =>
                    renderTemplateCard(
                      t.id,
                      t.title,
                      truncatePreview(t.diagnosis_text ?? ""),
                      t.is_system_template,
                      "med-certs",
                      t.id,
                      (copyTitle) => void handleDuplicateMc(t, copyTitle),
                      t.is_system_template && hasMineTitle(t.title, mineMcTitles),
                      () => {
                        const mine = findMineMc(t.title);
                        if (mine) openEditMc(mine);
                      },
                      () => openEditMc(t),
                      nextCopyTitle(t.title, mineMcTitles),
                    ),
                  )}
                {activeTab === "phrases" &&
                  filteredPhrases.map((p) =>
                    renderTemplateCard(
                      p.id,
                      p.label,
                      truncatePreview(`[${soapFieldLabel(p.field)}] ${p.body}`),
                      false,
                      "phrases",
                      p.id,
                      undefined,
                      undefined,
                      undefined,
                      () => openEditPhrase(p),
                    ),
                  )}
              </div>
            )}

            {activeTab === "prescriptions" && (
              <div className="rounded-xl border border-outline-variant bg-surface-container-low">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-lg py-md text-left"
                  onClick={() => setFavoritesOpen((o) => !o)}
                  aria-expanded={favoritesOpen}
                >
                  <span className="text-title-md text-on-surface">
                    Favourite medicines ({favorites.length})
                  </span>
                  <Icon name={favoritesOpen ? "expand_less" : "expand_more"} className="text-on-surface-variant" />
                </button>
                {favoritesOpen && (
                  <div className="space-y-md border-t border-outline-variant px-lg pb-lg pt-md">
                    <p className="text-body-md text-on-surface-variant">
                      One-tap medicines for the Prescription step during consultations.
                    </p>
                    <Button variant="secondary" onClick={openCreateFavorite}>
                      <Icon name="add" className="mr-xs text-[18px]" />
                      Add favourite
                    </Button>
                    {favorites.length === 0 ? (
                      <p className="text-body-md text-on-surface-variant">No favourites yet.</p>
                    ) : (
                      <ul className="space-y-sm">
                        {[...favorites]
                          .sort((a, b) => a.generic_name.localeCompare(b.generic_name))
                          .map((f) => (
                            <li
                              key={f.id}
                              className="flex flex-col gap-sm rounded-lg border border-outline-variant bg-surface-container-lowest px-md py-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="text-body-md text-on-surface">
                                <strong>{f.generic_name}</strong> {f.dosage} · {f.quantity}
                                {f.instruction ? ` · ${f.instruction}` : ""}
                              </span>
                              {deleteConfirmId === f.id ? (
                                <div className="flex flex-wrap gap-sm">
                                  <Button variant="danger" className="text-label-md" onClick={() => handleDeleteFavorite(f.id)}>
                                    Delete
                                  </Button>
                                  <Button variant="ghost" className="text-label-md" onClick={() => setDeleteConfirmId(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-sm">
                                  <Button variant="ghost" className="text-label-md" onClick={() => openEditFavorite(f)}>
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="text-label-md text-error"
                                    onClick={() => setDeleteConfirmId(f.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <datalist id="settings-medicines">
        {medicines.map((m) => (
          <option key={m.id} value={m.generic_name} />
        ))}
      </datalist>

      <Drawer isOpen={drawer !== null} onClose={closeDrawer} title={drawerTitle}>
        <div className="flex min-h-full flex-col gap-lg">
          {drawerError && (
            <p className="rounded-lg bg-error-container px-md py-sm text-body-md text-on-error-container">{drawerError}</p>
          )}
          {renderDrawerForm()}
          <div className="mt-auto flex flex-wrap gap-sm border-t border-outline-variant pt-lg">
            <Button loading={drawerSaving} disabled={!isDraftValid()} onClick={handleDrawerSave}>
              Save
            </Button>
            <Button variant="secondary" disabled={drawerSaving} onClick={closeDrawer}>
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
      {/* JJQR - END */}
    </div>
  );
}
//JJQR - END
