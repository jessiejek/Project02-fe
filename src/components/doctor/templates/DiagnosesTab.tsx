"use client";
//JJQR - AI (Nov 19, 2026) - new file: saved diagnoses tab - edit the text and attach / change / clear an ICD-10 code
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { Icd10DiagnosisField } from "@/components/doctor/Icd10DiagnosisField";
import { createDiagnosisTemplate, updateDiagnosisTemplate, deleteDiagnosisTemplate, type DiagnosisTemplateRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { validateDiagnosis } from "@/lib/templates/validation";
import type { TabCtx } from "./types";
import { EmptyHint, Field, ItemCard, LoadGate, Pill, TextAction, inputCls, truncate, useConfirmDelete } from "./shared";

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

export function DiagnosesTab({ ctx }: { ctx: TabCtx }) {
  const { data, panelId } = ctx;
  const rows = data.diagnoses.items;
  const visible = rows.filter((d) => !ctx.isHidden(d.id)).filter((d) => matchesQuery(ctx.query, d.label, d.body, d.icd10_code));
  const confirm = useConfirmDelete((id, label) =>
    ctx.deleteWithUndo({
      id,
      label,
      commit: () => deleteDiagnosisTemplate(null, id),
      afterCommit: () => data.diagnoses.setItems((prev) => prev.filter((d) => d.id !== id)),
    }),
  );
  const editing = panelId && panelId !== "new" ? rows.find((d) => d.id === panelId) ?? null : null;

  return (
    <div className="space-y-md">
      <div className="flex justify-end"><Button onClick={() => ctx.openPanel("new")}>New diagnosis</Button></div>
      <LoadGate status={data.diagnoses.status} reload={data.diagnoses.reload} empty={false} label="saved diagnoses">
        {visible.length === 0 ? (
          <EmptyHint>{rows.length === 0 ? "No saved diagnoses yet." : "No diagnoses match your search."}</EmptyHint>
        ) : (
          <ul className="grid grid-cols-1 gap-sm xl:grid-cols-2">
            {visible.map((d) => (
              <ItemCard
                key={d.id}
                title={d.label}
                highlight={panelId === d.id}
                onOpen={() => ctx.openPanel(d.id)}
                pills={d.icd10_code ? <Pill>ICD-10 {d.icd10_code}</Pill> : undefined}
                preview={truncate(d.body)}
                actions={<><TextAction onClick={() => ctx.openPanel(d.id)}>Edit</TextAction><TextAction tone="danger" onClick={() => confirm.ask(d.id, d.label)}>Delete</TextAction></>}
              />
            ))}
          </ul>
        )}
      </LoadGate>
      {panelId && (panelId === "new" || editing) && <DiagnosisEditor key={panelId} ctx={ctx} row={editing} />}
      {confirm.modal}
    </div>
  );
}

function DiagnosisEditor({ ctx, row }: { ctx: TabCtx; row: DiagnosisTemplateRow | null }) {
  const initial = { label: row?.label ?? "", body: row?.body ?? "", icd: row?.icd10_code ?? null };
  const [label, setLabel] = useState(initial.label);
  const [body, setBody] = useState(initial.body);
  const [icd, setIcd] = useState<string | null>(initial.icd);
  const [saving, setSaving] = useState(false);
  const dirty = label !== initial.label || body !== initial.body || icd !== initial.icd;
  const reason = validateDiagnosis({ label, body });

  async function save() {
    if (reason || saving) return;
    setSaving(true);
    try {
      const input = { label: label.trim(), body: body.trim(), icd10_code: icd };
      const saved = row ? await updateDiagnosisTemplate(null, row.id, input) : await createDiagnosisTemplate(null, input);
      ctx.data.diagnoses.setItems((prev) => (row ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved]).sort(byLabel));
      ctx.toast.push("success", `Diagnosis “${input.label}” saved.`);
      ctx.closePanel();
    } catch {
      ctx.toast.push("error", "Diagnosis was not saved. Your edits are still here — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel isOpen title={row ? `Edit “${row.label}”` : "New diagnosis"} dirty={dirty} saving={saving} onClose={ctx.closePanel} onSave={save} saveBlockedReason={reason}>
      <div className="space-y-md">
        <Field label="Short label" hint="Shown in the “Insert saved diagnosis…” list, e.g. URTI.">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
        </Field>
        <div>
          <span className="mb-xs block text-label-md font-medium text-on-surface">Diagnosis text &amp; ICD-10</span>
          <Icd10DiagnosisField description={body} icd10Code={icd} onChange={({ description, icd10Code }) => { setBody(description); setIcd(icd10Code); }} />
          <p className="mt-xs text-label-sm text-on-surface-variant">Type to search ICD-10 and pick a code, or leave it as free text.</p>
          {icd && (
            <button type="button" onClick={() => setIcd(null)} className="mt-xs min-h-11 text-label-md text-primary hover:underline">Remove ICD-10 code ({icd})</button>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
//JJQR - END
