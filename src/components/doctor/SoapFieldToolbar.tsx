"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { querySoapPhrases } from "@/lib/data/clinical";
import type { SoapField, SoapPhrase } from "@/data/types";
import type { Database } from "@/data/supabase-types";

// SoapField ("chiefComplaint") -> soap_field enum ("ChiefComplaint") — every
// value differs only by a capitalized first letter, so no lookup table needed.
function toDbField(field: SoapField): Database["public"]["Enums"]["soap_field"] {
  return (field.charAt(0).toUpperCase() + field.slice(1)) as Database["public"]["Enums"]["soap_field"];
}

export interface SoapFieldToolbarProps {
  doctorId: string;
  field: SoapField;
  fieldLabel: string;
  value: string;
  onInsert: (text: string) => void;
}

// Per-field quick-insert + save-as-phrase — the SOAP counterpart to
// Prescriptions' Favorites, applied to exam-finding text instead of
// medicines. Added after a UX review flagged retyping "normal" findings by
// hand on every visit as the single biggest source of documentation
// friction. Inserting appends to whatever's already typed (a doctor adding
// a canned finding to their own notes), never silently replaces it.
export function SoapFieldToolbar({ doctorId, field, fieldLabel, value, onInsert }: SoapFieldToolbarProps) {
  const [phrases, setPhrases] = useState<SoapPhrase[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const all = await querySoapPhrases(supabase, doctorId);
      const dbField = toDbField(field);
      setPhrases(
        all
          .filter((p) => p.field === dbField)
          .map((p) => ({ id: p.id, doctorId: p.doctor_id, field, label: p.label, text: p.body })),
      );
    }
    load();
  }, [doctorId, field]);

  function insertPhrase(id: string) {
    const phrase = phrases.find((p) => p.id === id);
    if (!phrase) return;
    onInsert(value.trim() ? `${value.trim()} ${phrase.text}` : phrase.text);
  }

  async function savePhrase() {
    if (!label.trim() || !value.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("soap_phrases")
      .insert({ doctor_id: doctorId, field: toDbField(field), label: label.trim(), body: value.trim() })
      .select("id, doctor_id, field, label, body")
      .single();
    if (data) {
      setPhrases((prev) => [...prev, { id: data.id, doctorId: data.doctor_id, field, label: data.label, text: data.body }]);
    }
    setLabel("");
    setSaveOpen(false);
  }

  return (
    <div className="flex items-center gap-sm">
      {phrases.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) insertPhrase(e.target.value);
          }}
          aria-label={`Insert saved ${fieldLabel} phrase`}
          className="rounded-md border border-outline-variant bg-transparent px-xs py-[1px] text-label-sm text-on-surface-variant"
        >
          <option value="">+ Insert phrase…</option>
          {phrases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => setSaveOpen(true)}
        disabled={!value.trim()}
        aria-label={`Save current ${fieldLabel} text as a reusable phrase`}
        title="Save as phrase"
        className="text-on-surface-variant transition-colors hover:text-primary disabled:opacity-30"
      >
        <Icon name="star" className="text-[13px]" />
      </button>

      <Modal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={`Save ${fieldLabel} as Phrase`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePhrase} disabled={!label.trim()}>
              Save
            </Button>
          </>
        }
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='Label (e.g. "Normal Cardiac Exam")'
          className="w-full rounded-lg border border-outline-variant px-md py-sm"
        />
      </Modal>
    </div>
  );
}
