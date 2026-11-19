"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createSoapPhrase } from "@/lib/data/clinical";
//JJQR - AI (Nov 19, 2026) - shared phrase loader (1 request for 5 fields), insert-at-caret, Manage deep link
import { useSoapPhrases } from "@/lib/clinical/useTemplateLibrary";
import { insertAtCaret } from "@/lib/clinical/insert-text";
//JJQR - END
import type { SoapField, SoapPhrase } from "@/data/types";
import type { Database } from "@/data/supabase-types";
function toDbField(field: SoapField): Database["public"]["Enums"]["soap_field"] {
  return (field.charAt(0).toUpperCase() + field.slice(1)) as Database["public"]["Enums"]["soap_field"];
}
//JJQR - AI (Nov 19, 2026)
const SAVE_OPTION = "__save_phrase";
//JJQR - END
export interface SoapFieldToolbarProps {
  doctorId: string; field: SoapField; fieldLabel: string; value: string; onInsert: (text: string) => void;
  //JJQR - AI (Nov 19, 2026) - id of the field's textarea (defaults to note-<field>) so phrases can go in at the caret
  textareaId?: string;
  //JJQR - END
}
/** Quick phrases insert at the caret on a new line; they never replace a doctor's existing notes. */
export function SoapFieldToolbar({ doctorId, field, fieldLabel, value, onInsert, textareaId }: SoapFieldToolbarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  //JJQR - AI (Nov 19, 2026) - phrases come from the shared loader (one request for all 5 toolbars)
  const { phrases: phraseRows, status: phraseStatus, add: addPhraseRow, reload: reloadPhrases } = useSoapPhrases(doctorId, toDbField(field));
  const phrases: SoapPhrase[] = phraseRows.map(p => ({ id: p.id, doctorId: p.doctor_id, field, label: p.label, text: p.body }));
  const loading = phraseStatus === "loading";
  const loadError = phraseStatus === "error";
  const taId = textareaId ?? `note-${field}`;
  // Last known caret: a <select> steals focus (iPad Safari resets it), so remember it while the textarea is used.
  const caretRef = useRef<{ start: number; end: number } | null>(null);
  useEffect(() => {
    const ta = document.getElementById(taId) as HTMLTextAreaElement | null;
    if (!ta) return;
    const remember = () => { caretRef.current = { start: ta.selectionStart, end: ta.selectionEnd }; };
    const events = ["blur", "select", "keyup", "mouseup", "touchend", "input"] as const;
    events.forEach(ev => ta.addEventListener(ev, remember));
    return () => { events.forEach(ev => ta.removeEventListener(ev, remember)); };
  }, [taId]);
  //JJQR - END
  function insertPhrase(id: string) {
    const phrase = phrases.find(p => p.id === id);
    if (!phrase) return;
    //JJQR - AI (Nov 19, 2026) - insert at the remembered caret on a new line (fallback: end of the note)
    const caret = caretRef.current;
    const result = insertAtCaret(value, phrase.text, caret?.start, caret?.end);
    onInsert(result.value);
    caretRef.current = { start: result.caret, end: result.caret };
    const ta = document.getElementById(taId) as HTMLTextAreaElement | null;
    if (ta) setTimeout(() => { try { ta.setSelectionRange(result.caret, result.caret); } catch { /* ignore */ } }, 0);
    //JJQR - END
  }
  async function savePhrase() {
    if (saving || !label.trim() || !value.trim()) return;
    setSaving(true);setSaveError("");
    try {
      const data = await createSoapPhrase(null, doctorId, { field: toDbField(field), label: label.trim(), body: value.trim() });
      addPhraseRow(data);
      setLabel("");setSaveOpen(false);
    } catch { setSaveError("The phrase was not saved. Your clinical note is unchanged; try again."); }
    finally { setSaving(false); }
  }
  return <div className="flex min-w-0 flex-wrap items-center gap-sm">
    {loading && <span role="status" className="text-label-sm text-on-surface-variant">Loading phrases…</span>}
    {loadError && <span role="status" className="text-label-sm text-on-surface-variant">Quick phrases unavailable <button type="button" onClick={reloadPhrases} className="font-medium text-primary hover:underline">Retry</button></span>}
    {/*JJQR - AI (Nov 19, 2026) - one "Insert phrase…" dropdown per box; "Save current text as phrase…" lives inside it (no star button, no per-box Manage link) */}
    {(phrases.length > 0 || value.trim()) && <select value="" onChange={e => { if (e.target.value === SAVE_OPTION) { setSaveError(""); setSaveOpen(true); } else insertPhrase(e.target.value); }} aria-label={`Insert saved ${fieldLabel} phrase`} className="min-h-11 max-w-full rounded-nav border border-outline-variant bg-surface-container-lowest px-sm text-label-md text-on-surface">
      <option value="">Insert phrase…</option>{phrases.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      {value.trim() && <option value={SAVE_OPTION}>＋ Save current text as phrase…</option>}
    </select>}
    {/*JJQR - END */}
    <Modal isOpen={saveOpen} onClose={() => { if (!saving) setSaveOpen(false); }} title={`Save ${fieldLabel} as phrase`} footer={<><Button variant="secondary" disabled={saving} onClick={() => setSaveOpen(false)}>Cancel</Button><Button loading={saving} onClick={savePhrase} disabled={!label.trim()}>Save phrase</Button></>}>
      <label className="block space-y-sm"><span className="text-label-md font-medium text-on-surface">Phrase name</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder="For example, Normal cardiac exam" className="w-full rounded-nav border border-outline-variant px-md py-sm text-on-surface" /></label>
      {saveError && <p role="alert" className="mt-md text-body-md text-status-danger">{saveError}</p>}
    </Modal>
  </div>;
}
