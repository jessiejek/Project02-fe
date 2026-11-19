"use client";
//JJQR - AI (Nov 19, 2026) - new file: medical certificate templates tab - create / edit / duplicate / delete / live certificate preview. System templates are read-only but duplicable.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { createMedicalCertificateTemplate, updateMedicalCertificateTemplate, deleteMedicalCertificateTemplate, type MedicalCertificateTemplateRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { validateCertTemplate } from "@/lib/templates/validation";
import { cn } from "@/lib/cn";
import type { TabCtx } from "./types";
import { EmptyHint, Field, FilterChip, ItemCard, LoadGate, Pill, TextAction, inputCls, truncate, useConfirmDelete } from "./shared";

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
type Source = "all" | "mine" | "system";

export function CertsTab({ ctx }: { ctx: TabCtx }) {
  const { data, toast, panelId } = ctx;
  const [source, setSource] = useState<Source>("all");
  const rows = data.certs.items;
  const visible = rows
    .filter((t) => !ctx.isHidden(t.id))
    .filter((t) => source === "all" || (source === "system") === t.is_system_template)
    .filter((t) => matchesQuery(ctx.query, t.title, t.diagnosis_text, t.recommendations, t.purpose_exception));

  async function duplicate(row: MedicalCertificateTemplateRow) {
    try {
      const created = await createMedicalCertificateTemplate(null, ctx.doctorId, {
        title: `${row.title} (copy)`,
        is_system_template: false,
        diagnosis_text: row.diagnosis_text,
        recommendations: row.recommendations,
        purpose_exception: row.purpose_exception,
      });
      data.certs.setItems((prev) => [...prev, created].sort(byTitle));
      toast.push("success", `Duplicated to “${created.title}”.`);
      ctx.openPanel(created.id);
    } catch {
      toast.push("error", "Couldn’t duplicate the certificate template. Please try again.");
    }
  }

  const confirm = useConfirmDelete((id, label) =>
    ctx.deleteWithUndo({
      id,
      label,
      commit: () => deleteMedicalCertificateTemplate(null, id),
      afterCommit: () => data.certs.setItems((prev) => prev.filter((t) => t.id !== id)),
    }),
  );
  const editing = panelId && panelId !== "new" ? rows.find((t) => t.id === panelId) ?? null : null;

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-center gap-sm">
        <div className="flex gap-xs overflow-x-auto" role="group" aria-label="Source">
          {(["all", "mine", "system"] as const).map((s) => (
            <FilterChip key={s} active={source === s} onClick={() => setSource(s)}>{s === "all" ? "All" : s === "mine" ? "Mine" : "System"}</FilterChip>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => ctx.openPanel("new")}>New certificate template</Button>
      </div>
      <LoadGate status={data.certs.status} reload={data.certs.reload} empty={false} label="certificate templates">
        {visible.length === 0 ? (
          <EmptyHint>{rows.length === 0 ? "No certificate templates yet." : "No certificate templates match these filters."}</EmptyHint>
        ) : (
          <ul className="grid grid-cols-1 gap-sm xl:grid-cols-2">
            {visible.map((t) => (
              <ItemCard
                key={t.id}
                title={t.title}
                highlight={panelId === t.id}
                onOpen={() => ctx.openPanel(t.id)}
                pills={<Pill tone={t.is_system_template ? "system" : "mine"}>{t.is_system_template ? "System" : "Mine"}</Pill>}
                preview={truncate(t.diagnosis_text || t.recommendations || t.purpose_exception)}
                actions={
                  <>
                    <TextAction onClick={() => ctx.openPanel(t.id)}>{t.is_system_template ? "View" : "Edit"}</TextAction>
                    <TextAction onClick={() => void duplicate(t)}>Duplicate</TextAction>
                    {!t.is_system_template && <TextAction tone="danger" onClick={() => confirm.ask(t.id, t.title)}>Delete</TextAction>}
                  </>
                }
              />
            ))}
          </ul>
        )}
      </LoadGate>
      {panelId && (panelId === "new" || editing) && <CertEditor key={panelId} ctx={ctx} row={editing} onDuplicate={duplicate} />}
      {confirm.modal}
    </div>
  );
}

function CertPreview({ diagnosis, recommendations, purpose }: { diagnosis: string; recommendations: string; purpose: string }) {
  const line = (label: string, v: string) => (
    <p className="text-body-md text-on-surface"><span className="font-semibold">{label}: </span>{v.trim() || <span className="text-on-surface-variant">— (falls back to the visit’s own text)</span>}</p>
  );
  return (
    <div aria-label="Certificate preview" className="space-y-sm rounded-xl border border-outline-variant bg-surface p-md">
      <p className="text-center text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">Medical certificate — preview</p>
      <p className="text-body-md text-on-surface">This is to certify that the patient was examined and found to have:</p>
      {line("Diagnosis / Impressions", diagnosis)}
      {line("Recommendations", recommendations)}
      {line("Purpose exception", purpose)}
    </div>
  );
}

function CertEditor({ ctx, row, onDuplicate }: { ctx: TabCtx; row: MedicalCertificateTemplateRow | null; onDuplicate: (r: MedicalCertificateTemplateRow) => Promise<void> }) {
  const readOnly = !!row?.is_system_template;
  const initial = useMemo(() => ({ title: row?.title ?? "", dx: row?.diagnosis_text ?? "", rec: row?.recommendations ?? "", pur: row?.purpose_exception ?? "" }), [row]);
  const [title, setTitle] = useState(initial.title);
  const [dx, setDx] = useState(initial.dx);
  const [rec, setRec] = useState(initial.rec);
  const [pur, setPur] = useState(initial.pur);
  const [saving, setSaving] = useState(false);
  const dirty = title !== initial.title || dx !== initial.dx || rec !== initial.rec || pur !== initial.pur;
  const reason = validateCertTemplate({ title, fields: [dx, rec, pur] });

  async function save() {
    if (reason || saving) return;
    setSaving(true);
    try {
      const input = { title: title.trim(), is_system_template: false, diagnosis_text: dx.trim() || null, recommendations: rec.trim() || null, purpose_exception: pur.trim() || null };
      const saved = row ? await updateMedicalCertificateTemplate(null, row.id, input) : await createMedicalCertificateTemplate(null, ctx.doctorId, input);
      ctx.data.certs.setItems((prev) => (row ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved]).sort(byTitle));
      ctx.toast.push("success", `Certificate template “${input.title}” saved.`);
      ctx.closePanel();
    } catch {
      ctx.toast.push("error", "Certificate template was not saved. Your edits are still here — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      isOpen
      title={row ? (readOnly ? row.title : `Edit “${row.title}”`) : "New certificate template"}
      subtitle={readOnly ? "System template — read only. Duplicate it to make your own copy." : undefined}
      dirty={dirty}
      saving={saving}
      readOnly={readOnly}
      onClose={ctx.closePanel}
      onSave={save}
      saveBlockedReason={reason}
      footer={readOnly && row ? <Button onClick={() => void onDuplicate(row)}>Duplicate to mine</Button> : undefined}
    >
      <div className="space-y-md">
        {!readOnly && (
          <>
            <Field label="Template name"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. "Fit to work"' autoFocus /></Field>
            <Field label="Diagnosis / Impressions"><textarea className={cn(inputCls, "min-h-20")} rows={3} value={dx} onChange={(e) => setDx(e.target.value)} /></Field>
            <Field label="Recommendations"><textarea className={cn(inputCls, "min-h-20")} rows={3} value={rec} onChange={(e) => setRec(e.target.value)} /></Field>
            <Field label="Purpose exception"><textarea className={cn(inputCls, "min-h-20")} rows={2} value={pur} onChange={(e) => setPur(e.target.value)} /></Field>
          </>
        )}
        <CertPreview diagnosis={dx} recommendations={rec} purpose={pur} />
      </div>
    </SidePanel>
  );
}
//JJQR - END
