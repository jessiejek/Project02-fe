"use client";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

import { memo, useEffect, useRef, useState } from "react";
//JJQR - AI (Nov 20, 2026)
import { shouldFlush } from "@/lib/amend-flush";
//JJQR - END
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { queryVitalFieldTemplates } from "@/lib/data/lookups";
import { queryVitalReadings, upsertVitalsByBooking } from "@/lib/data/clinical";
import type { VitalFieldTemplate } from "@/data/types";

interface VitalInputCardProps {
  template: VitalFieldTemplate;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
}

//JJQR - AI (Oct 31, 2026) — F-015 adult default ranges by formKey
type NumericRange = { min: number; max: number };

const SINGLE_VITAL_RANGES: Record<string, NumericRange> = {
  pulse_rate: { min: 60, max: 100 },
  temperature: { min: 36.1, max: 37.2 },
  respiratory_rate: { min: 12, max: 20 },
  o2_saturation: { min: 95, max: 100 },
  oxygen_saturation: { min: 95, max: 100 },
  spo2: { min: 95, max: 100 },
  weight: { min: 35, max: 200 },
  blood_pressure_systolic: { min: 90, max: 140 },
  blood_pressure_diastolic: { min: 60, max: 90 },
};

const BP_SYSTOLIC: NumericRange = { min: 90, max: 140 };
const BP_DIASTOLIC: NumericRange = { min: 60, max: 90 };

function parseVitalNumber(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function withinRange(n: number, range: NumericRange): boolean {
  return n >= range.min && n <= range.max;
}

//JJQR - AI (Nov 20, 2026) - exported so the read-only completed-visit card can show the same "Out of range" cue as the edit form
export function vitalOutOfRange(formKey: string, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const key = formKey.toLowerCase();
  if (key === "blood_pressure") {
    const slash = trimmed.split("/").map((p) => p.trim());
    if (slash.length >= 2) {
      const sys = parseVitalNumber(slash[0] ?? "");
      const dia = parseVitalNumber(slash[1] ?? "");
      if (sys != null && !withinRange(sys, BP_SYSTOLIC)) return true;
      if (dia != null && !withinRange(dia, BP_DIASTOLIC)) return true;
      return false;
    }
    const lone = parseVitalNumber(trimmed);
    return lone != null && !withinRange(lone, BP_SYSTOLIC);
  }

  const range = SINGLE_VITAL_RANGES[key];
  if (!range) return false;
  const n = parseVitalNumber(trimmed);
  return n != null && !withinRange(n, range);
}
//JJQR - END
//JJQR - END

function VitalInputCard({ template, value, onChange, onRemove }: VitalInputCardProps) {
  //JJQR - AI (Oct 31, 2026)
  const showOutOfRange = vitalOutOfRange(template.formKey, value);
  //JJQR - END
  return (
    <Card className="space-y-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-sm text-label-md text-on-surface-variant">
          <Icon name={template.icon} className="text-[18px] text-primary" />
          {template.description}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${template.description}`} className="text-error">
            <Icon name="delete" className="text-[16px]" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-sm">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={template.unit ? `Enter ${(template.description ?? "").toLowerCase()}` : "Enter value"}
          className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm"
        />
        {template.unit && <span className="shrink-0 text-label-sm text-on-surface-variant">{template.unit}</span>}
      </div>
      {/* JJQR - AI (Oct 31, 2026) */}
      {showOutOfRange && (
        <p className="flex items-center gap-xs text-label-sm text-status-warning" role="status">
          <Icon name="warning" className="text-[16px]" aria-hidden />
          Out of range
        </p>
      )}
      {/* JJQR - END */}
    </Card>
  );
}

export interface VitalsEditorProps {
  bookingId: string;
  patientId: string;
  /** Called after a successful save — e.g. to close the drawer/modal it's embedded in. */
  onSaved?: () => void;
  embedded?: boolean;
  //JJQR - AI (Nov 20, 2026) - silent flush for Save amendment / Ctrl+S (no confirm dialog)
  registerFlush?: (fn: (() => Promise<boolean>) | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onFlushed?: () => void | Promise<void>;
  //JJQR - END
}

// The actual vitals-entry UI (grid of cards + "Others" + Save), extracted so
// it can render both as its own page (patient-chart history use case) and
// inline in a Drawer from the consultation page — navigating away to a whole
// new route just to log vitals mid-consultation was the UX problem this fixes.
function VitalsEditor({ bookingId, patientId, onSaved, embedded = false, registerFlush, onDirtyChange, onFlushed }: VitalsEditorProps) {
  // vital_field_templates rarely changes — fetch once per mount rather than
  // re-querying on every keystroke (Implementation-Phases/03-reference-clinic-data.md
  // §3d).
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<VitalFieldTemplate[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibleOtherIds, setVisibleOtherIds] = useState<string[]>([]);
  //JJQR - AI (Nov 20, 2026) - flush sees latest values; baseline is last loaded/saved set
  const valuesRef = useRef(values);
  const visibleOtherIdsRef = useRef(visibleOtherIds);
  const templatesRef = useRef(templates);
  const baselineRef = useRef({ values, visibleOtherIds });
  const flushImplRef = useRef<() => Promise<boolean>>(async () => true);
  //JJQR - END
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
      const supabase = null as never;
      const [templates, readings] = await Promise.all([
        queryVitalFieldTemplates(supabase),
        queryVitalReadings(supabase, { bookingId }),
      ]);
      if (cancelled) return;
      const fetchedTemplates = templates.map((t) => ({
        id: t.template_id,
        description: t.description,
        formKey: t.form_key,
        unit: t.unit,
        icon: t.icon,
        isDefault: t.is_default,
      }));
      setTemplates(fetchedTemplates);
      const existingReadings = readings.map((r) => ({ templateId: r.template_id, value: r.value }));
      const otherTemplateIds = new Set(fetchedTemplates.filter((t) => !t.isDefault).map((t) => t.id));
      const nextValues = Object.fromEntries(existingReadings.map((r) => [r.templateId, r.value]));
      const nextVisibleOtherIds = existingReadings.filter((r) => otherTemplateIds.has(r.templateId)).map((r) => r.templateId);
      setValues(nextValues);
      setVisibleOtherIds(nextVisibleOtherIds);
      //JJQR - AI (Nov 20, 2026)
      baselineRef.current = { values: nextValues, visibleOtherIds: nextVisibleOtherIds };
      onDirtyChange?.(false);
      //JJQR - END
      } catch { if (!cancelled) setLoadError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onDirtyChange is setState (stable)
  }, [bookingId, loadAttempt]);
  const defaultTemplates = templates.filter((t) => t.isDefault);
  const otherTemplates = templates.filter((t) => !t.isDefault);

  const [othersModalOpen, setOthersModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setValue(templateId: string, value: string) {
    setValues((prev) => ({ ...prev, [templateId]: value }));
  }

  function addOther(templateId: string) {
    setVisibleOtherIds((prev) => [...prev, templateId]);
    setOthersModalOpen(false);
  }

  function removeOther(templateId: string) {
    setVisibleOtherIds((prev) => prev.filter((id) => id !== templateId));
    setValues((prev) => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  }

  //JJQR - AI (Nov 20, 2026) - shared write for confirm-save and silent flush
  function vitalsSnapshot(nextValues = values, nextVisible = visibleOtherIds) {
    return { values: nextValues, visibleOtherIds: nextVisible };
  }

  async function persistCurrentVitals(nextValues: Record<string, string>, nextVisible: string[], nextTemplates: VitalFieldTemplate[]) {
    const defaultIds = nextTemplates.filter((t) => t.isDefault).map((t) => t.id);
    const relevantTemplateIds = [...defaultIds, ...nextVisible];
    const supabase = null as never;
    await upsertVitalsByBooking(
      supabase,
      bookingId,
      patientId,
      relevantTemplateIds.map((templateId) => ({ template_id: templateId, value: (nextValues[templateId] ?? "").trim() })),
    );
  }

  function markVitalsSaved(nextValues: Record<string, string>, nextVisible: string[]) {
    baselineRef.current = vitalsSnapshot(nextValues, nextVisible);
    onDirtyChange?.(false);
  }
  //JJQR - END

  async function confirmSave() {
    setSaving(true);
    setSaveError(null);
    try {
      // One row per template with a non-empty value; blank fields delete the
      // row (Implementation-Phases/07-consultations-vitals.md §7c).
      await persistCurrentVitals(values, visibleOtherIds, templates);
      //JJQR - AI (Nov 20, 2026)
      markVitalsSaved(values, visibleOtherIds);
      //JJQR - END
      setSavedAt(new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }) + " PHT");
      onSaved?.();
      setConfirmOpen(false);
    } catch {
      setSaveError("The readings were not saved. Your entries are still here; please try again.");
    } finally {
      setSaving(false);
    }
  }

  //JJQR - AI (Nov 20, 2026) - silent flush: same write as Save vital signs, no dialog
  useEffect(() => {
    valuesRef.current = values;
    visibleOtherIdsRef.current = visibleOtherIds;
    templatesRef.current = templates;
    flushImplRef.current = async () => {
      const currentValues = valuesRef.current;
      const currentVisible = visibleOtherIdsRef.current;
      const currentTemplates = templatesRef.current;
      if (!shouldFlush(vitalsSnapshot(currentValues, currentVisible), baselineRef.current)) return true;
      try {
        await persistCurrentVitals(currentValues, currentVisible, currentTemplates);
        setSaveError(null);
        markVitalsSaved(currentValues, currentVisible);
        await onFlushed?.();
        return true;
      } catch {
        setSaveError("The readings were not saved. Your entries are still here; please try again.");
        return false;
      }
    };
  });

  useEffect(() => {
    onDirtyChange?.(shouldFlush({ values, visibleOtherIds }, baselineRef.current));
  }, [values, visibleOtherIds, onDirtyChange]);

  useEffect(() => {
    if (!registerFlush) return;
    registerFlush(() => flushImplRef.current());
    return () => {
      registerFlush(null);
      onDirtyChange?.(false);
    };
  }, [registerFlush, onDirtyChange]);
  //JJQR - END

  const addableOthers = otherTemplates.filter((t) => !visibleOtherIds.includes(t.id));
  if (loading) return <div role="status" aria-label="Loading vital signs"><SkeletonCard lines={4} /><SkeletonCard lines={4} /></div>;
  if (loadError) return <ErrorState title="Vital signs unavailable" message="We could not load the current readings. Try again before entering or saving measurements." onRetry={() => { setLoading(true); setLoadError(false); setLoadAttempt(n => n + 1); }} />;

  return (
    <div className="space-y-lg">
      {savedAt && <Toast key={savedAt} variant="success" message={`Vitals saved at ${savedAt}.`} />}
      {/*JJQR - AI (Nov 20, 2026) - flush errors must be visible without the confirm dialog*/}
      {saveError && !confirmOpen && <Toast key={saveError} variant="error" message={saveError} />}
      {/*JJQR - END*/}

      {/* Top-right, same slot as every other section's Save (SOAP's
          "Use Template…"/"Save as Template" row, etc.) — visible only while
          this section is open, since it's the first thing it renders. */}
      <div className="flex justify-end gap-sm">
        <Button variant="secondary" onClick={() => setOthersModalOpen(true)}>
          <Icon name="add_circle" className="text-[16px]" />
          Add measurement
        </Button>
        <Button variant={embedded ? "secondary" : "primary"} loading={saving} onClick={() => { setSaveError(null); setConfirmOpen(true); }}>Save vital signs</Button>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        {defaultTemplates.map((t) => (
          <VitalInputCard key={t.id} template={t} value={values[t.id] ?? ""} onChange={(v) => setValue(t.id, v)} />
        ))}
        {visibleOtherIds.map((id) => {
          const t = otherTemplates.find((x) => x.id === id);
          if (!t) return null;
          return (
            <VitalInputCard
              key={t.id}
              template={t}
              value={values[t.id] ?? ""}
              onChange={(v) => setValue(t.id, v)}
              onRemove={() => removeOther(t.id)}
            />
          );
        })}
      </div>

      <Modal isOpen={othersModalOpen} onClose={() => setOthersModalOpen(false)} title="Add Other Vital">
        {addableOthers.length === 0 ? (
          <EmptyState icon="check_circle" message="No more vitals to add." />
        ) : (
          <div className="space-y-sm">
            {addableOthers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => addOther(t.id)}
                className="flex w-full items-center gap-sm rounded-lg border border-outline-variant p-md text-left text-body-md transition-colors hover:bg-surface-container-low"
              >
                <Icon name={t.icon} className="text-[18px] text-primary" />
                {t.description}
              </button>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Save vital signs?"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={confirmSave}>Save vital signs</Button>
          </>
        }
      >
        {saveError && <p role="alert" className="mb-md text-status-danger">{saveError}</p>}
        <p className="text-body-md text-on-surface-variant">Save these vital sign readings for this appointment?</p>
      </Modal>
    </div>
  );
}

//JJQR - AI (Nov 20, 2026) - skip re-render when parent ticks a checkbox; callbacks are ignored (stable setters / bookingId)
function areVitalsEditorPropsEqual(prev: VitalsEditorProps, next: VitalsEditorProps): boolean {
  const keys = new Set<keyof VitalsEditorProps>([
    ...(Object.keys(prev) as (keyof VitalsEditorProps)[]),
    ...(Object.keys(next) as (keyof VitalsEditorProps)[]),
  ]);
  for (const key of keys) {
    const a = prev[key];
    const b = next[key];
    if (typeof a === "function" || typeof b === "function") continue;
    if (!Object.is(a, b)) return false;
  }
  return true;
}

const MemoizedVitalsEditor = memo(VitalsEditor, areVitalsEditorPropsEqual);
export { MemoizedVitalsEditor as VitalsEditor };
//JJQR - END
