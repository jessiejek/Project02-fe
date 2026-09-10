"use client";

import { useEffect, useState } from "react";
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

// One tile per vital template (clinic-vitals-fe.md's `VitalDetailFieldCard`) —
// default templates are always shown; "Others" templates get a red trash icon
// since they were added on-demand and can be removed again.
function VitalInputCard({ template, value, onChange, onRemove }: VitalInputCardProps) {
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
          className="w-full rounded-lg border border-outline-variant px-md py-sm"
        />
        {template.unit && <span className="shrink-0 text-label-sm text-on-surface-variant">{template.unit}</span>}
      </div>
    </Card>
  );
}

export interface VitalsEditorProps {
  bookingId: string;
  patientId: string;
  /** Called after a successful save — e.g. to close the drawer/modal it's embedded in. */
  onSaved?: () => void;
}

// The actual vitals-entry UI (grid of cards + "Others" + Save), extracted so
// it can render both as its own page (patient-chart history use case) and
// inline in a Drawer from the consultation page — navigating away to a whole
// new route just to log vitals mid-consultation was the UX problem this fixes.
export function VitalsEditor({ bookingId, patientId, onSaved }: VitalsEditorProps) {
  // vital_field_templates rarely changes — fetch once per mount rather than
  // re-querying on every keystroke (Implementation-Phases/03-reference-clinic-data.md
  // §3d).
  const [templates, setTemplates] = useState<VitalFieldTemplate[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibleOtherIds, setVisibleOtherIds] = useState<string[]>([]);
  useEffect(() => {
    async function load() {
      const supabase = null as never;
      const [templates, readings] = await Promise.all([
        queryVitalFieldTemplates(supabase),
        queryVitalReadings(supabase, { bookingId }),
      ]);
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
      setValues(Object.fromEntries(existingReadings.map((r) => [r.templateId, r.value])));
      setVisibleOtherIds(existingReadings.filter((r) => otherTemplateIds.has(r.templateId)).map((r) => r.templateId));
    }
    load();
  }, [bookingId]);
  const defaultTemplates = templates.filter((t) => t.isDefault);
  const otherTemplates = templates.filter((t) => !t.isDefault);

  const [othersModalOpen, setOthersModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

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

  async function confirmSave() {
    setConfirmOpen(false);
    // One row per template with a non-empty value; blank fields delete the
    // row (Implementation-Phases/07-consultations-vitals.md §7c).
    const supabase = null as never;
    const relevantTemplateIds = [...defaultTemplates.map((t) => t.id), ...visibleOtherIds];
    await upsertVitalsByBooking(
      supabase,
      bookingId,
      patientId,
      relevantTemplateIds.map((templateId) => ({ template_id: templateId, value: (values[templateId] ?? "").trim() })),
    );
    setSavedAt(new Date().toLocaleTimeString());
    onSaved?.();
  }

  const addableOthers = otherTemplates.filter((t) => !visibleOtherIds.includes(t.id));

  return (
    <div className="space-y-lg">
      {savedAt && <Toast key={savedAt} variant="success" message={`Vitals saved at ${savedAt}.`} />}

      <div className="flex justify-end gap-sm">
        <Button variant="secondary" onClick={() => setOthersModalOpen(true)}>
          <Icon name="add_circle" className="text-[16px]" />
          Others
        </Button>
        <Button onClick={() => setConfirmOpen(true)}>Save</Button>
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
        title="Save Changes?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSave}>Confirm</Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">Save these vital sign readings for this visit?</p>
      </Modal>
    </div>
  );
}
