"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { querySoapPhrases, createSoapPhrase } from "@/lib/data/clinical";
import type { SoapField, SoapPhrase } from "@/data/types";
import type { Database } from "@/data/supabase-types";
function toDbField(field: SoapField): Database["public"]["Enums"]["soap_field"] {
  return (field.charAt(0).toUpperCase() + field.slice(1)) as Database["public"]["Enums"]["soap_field"];
}
export interface SoapFieldToolbarProps {
  doctorId: string; field: SoapField; fieldLabel: string; value: string; onInsert: (text: string) => void;
}
/** Quick phrases append to clinical text; they never replace a doctor's existing notes. */
export function SoapFieldToolbar({ doctorId, field, fieldLabel, value, onInsert }: SoapFieldToolbarProps) {
  const [phrases, setPhrases] = useState<SoapPhrase[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const all = await querySoapPhrases(null, doctorId);
        if (!cancelled) setPhrases(all.filter(p => p.field === toDbField(field)).map(p => ({ id: p.id, doctorId: p.doctor_id, field, label: p.label, text: p.body })));
      } catch { if (!cancelled) setLoadError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();return () => { cancelled = true; };
  }, [doctorId, field]);
  function insertPhrase(id: string) {
    const phrase = phrases.find(p => p.id === id);
    if (phrase) onInsert(value.trim() ? `${value.trim()} ${phrase.text}` : phrase.text);
  }
  async function savePhrase() {
    if (saving || !label.trim() || !value.trim()) return;
    setSaving(true);setSaveError("");
    try {
      const data = await createSoapPhrase(null, doctorId, { field: toDbField(field), label: label.trim(), body: value.trim() });
      setPhrases(prev => [...prev, { id: data.id, doctorId: data.doctor_id, field, label: data.label, text: data.body }]);
      setLabel("");setSaveOpen(false);
    } catch { setSaveError("The phrase was not saved. Your clinical note is unchanged; try again."); }
    finally { setSaving(false); }
  }
  return <div className="flex min-w-0 flex-wrap items-center gap-sm">
    {loading && <span role="status" className="text-label-sm text-on-surface-variant">Loading phrases…</span>}
    {loadError && <span role="status" className="text-label-sm text-on-surface-variant">Quick phrases unavailable</span>}
    {phrases.length > 0 && <select value="" onChange={e => insertPhrase(e.target.value)} aria-label={`Insert saved ${fieldLabel} phrase`} className="min-h-11 max-w-full rounded-nav border border-outline-variant bg-surface-container-lowest px-sm text-label-md text-on-surface">
      <option value="">Insert phrase…</option>{phrases.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>}
    {value.trim() && <button type="button" onClick={() => { setSaveError(""); setSaveOpen(true); }} aria-label={`Save current ${fieldLabel} text as a reusable phrase`} title="Save as phrase" className="flex h-11 w-11 items-center justify-center rounded-nav text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary motion-reduce:transition-none"><Icon name="star" className="h-4 w-4" /></button>}
    <Modal isOpen={saveOpen} onClose={() => { if (!saving) setSaveOpen(false); }} title={`Save ${fieldLabel} as phrase`} footer={<><Button variant="secondary" disabled={saving} onClick={() => setSaveOpen(false)}>Cancel</Button><Button loading={saving} onClick={savePhrase} disabled={!label.trim()}>Save phrase</Button></>}>
      <label className="block space-y-sm"><span className="text-label-md font-medium text-on-surface">Phrase name</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder="For example, Normal cardiac exam" className="w-full rounded-nav border border-outline-variant px-md py-sm text-on-surface" /></label>
      {saveError && <p role="alert" className="mt-md text-body-md text-status-danger">{saveError}</p>}
    </Modal>
  </div>;
}
