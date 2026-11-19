"use client";
//JJQR - AI (Nov 19, 2026) - new file: SOAP templates tab (list / search / specialty / create / edit / duplicate / delete / preview). System templates are read-only but duplicable.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { createSoapTemplate, updateSoapTemplate, deleteSoapTemplate, type SoapTemplateRow } from "@/lib/data/clinical";
import { matchesSpecialtyFilter, SPECIALTY_CHIP_LABELS } from "@/lib/clinical/template-specialty";
import { matchesQuery } from "@/lib/templates/search";
import { validateSoapTemplate } from "@/lib/templates/validation";
import { SOAP_FIELD_LABELS, SOAP_KEYS, type SoapKey } from "@/lib/clinical/soap-merge";
import { cn } from "@/lib/cn";
import type { TabCtx } from "./types";
import { EmptyHint, Field, FilterChip, ItemCard, LoadGate, Pill, TextAction, inputCls, truncate, useConfirmDelete } from "./shared";

const COLUMN: Record<SoapKey, keyof SoapTemplateRow> = {
  chiefComplaint: "chief_complaint",
  subjective: "subjective",
  objective: "objective",
  assessment: "assessment",
  plan: "plan",
};
const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

type Source = "all" | "mine" | "system";

export function SoapTab({ ctx }: { ctx: TabCtx }) {
  const { data, toast, panelId } = ctx;
  const [source, setSource] = useState<Source>("all");
  const rows = data.soap.items;

  const visible = useMemo(
    () =>
      rows
        .filter((t) => !ctx.isHidden(t.id))
        .filter((t) => source === "all" || (source === "system") === t.is_system_template)
        .filter((t) => matchesSpecialtyFilter("soap", t.title, ctx.specialty))
        .filter((t) => matchesQuery(ctx.query, t.title, t.chief_complaint, t.subjective, t.objective, t.assessment, t.plan)),
    [rows, source, ctx],
  );

  async function duplicate(row: SoapTemplateRow) {
    try {
      const created = await createSoapTemplate(null, ctx.doctorId, {
        title: `${row.title} (copy)`,
        is_system_template: false,
        chief_complaint: row.chief_complaint,
        subjective: row.subjective,
        objective: row.objective,
        assessment: row.assessment,
        plan: row.plan,
      });
      data.soap.setItems((prev) => [...prev, created].sort(byTitle));
      toast.push("success", `Duplicated to “${created.title}”.`);
      ctx.openPanel(created.id);
    } catch {
      toast.push("error", "Couldn’t duplicate the template. Please try again.");
    }
  }

  const confirm = useConfirmDelete((id, label) =>
    ctx.deleteWithUndo({
      id,
      label,
      commit: () => deleteSoapTemplate(null, id),
      afterCommit: () => data.soap.setItems((prev) => prev.filter((t) => t.id !== id)),
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
        <span className="hidden h-6 w-px bg-outline-variant sm:block" aria-hidden />
        <div className="flex gap-xs overflow-x-auto" role="group" aria-label="Specialty">
          {SPECIALTY_CHIP_LABELS.map(({ id, label }) => (
            <FilterChip key={id} active={ctx.specialty === id} onClick={() => ctx.setSpecialty(id)}>{label}</FilterChip>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => ctx.openPanel("new")}>New SOAP template</Button>
      </div>

      <LoadGate status={data.soap.status} reload={data.soap.reload} empty={false} label="SOAP templates">
        {visible.length === 0 ? (
          <EmptyHint>{rows.length === 0 ? "No SOAP templates yet. Create one, or save one from a consultation." : "No SOAP templates match these filters."}</EmptyHint>
        ) : (
          <ul className="grid grid-cols-1 gap-sm xl:grid-cols-2">
            {visible.map((t) => (
              <ItemCard
                key={t.id}
                title={t.title}
                highlight={panelId === t.id}
                onOpen={() => ctx.openPanel(t.id)}
                pills={<Pill tone={t.is_system_template ? "system" : "mine"}>{t.is_system_template ? "System" : "Mine"}</Pill>}
                preview={truncate([t.chief_complaint, t.subjective, t.assessment, t.plan, t.objective].find((x) => x && x.trim()) ?? "")}
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

      {panelId && (panelId === "new" || editing) && (
        <SoapEditor key={panelId} ctx={ctx} row={editing} onDuplicate={duplicate} />
      )}
      {confirm.modal}
    </div>
  );
}

function SoapEditor({ ctx, row, onDuplicate }: { ctx: TabCtx; row: SoapTemplateRow | null; onDuplicate: (r: SoapTemplateRow) => Promise<void> }) {
  const readOnly = !!row?.is_system_template;
  const initial = useMemo(() => ({
    title: row?.title ?? "",
    fields: Object.fromEntries(SOAP_KEYS.map((k) => [k, (row?.[COLUMN[k]] as string | null) ?? ""])) as Record<SoapKey, string>,
  }), [row]);
  const [title, setTitle] = useState(initial.title);
  const [fields, setFields] = useState(initial.fields);
  const [mode, setMode] = useState<"edit" | "preview">(readOnly ? "preview" : "edit");
  const [saving, setSaving] = useState(false);

  const dirty = title !== initial.title || SOAP_KEYS.some((k) => fields[k] !== initial.fields[k]);
  const reason = validateSoapTemplate({ title, fields: SOAP_KEYS.map((k) => fields[k]) });

  async function save() {
    if (reason || saving) return;
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        is_system_template: false,
        chief_complaint: fields.chiefComplaint.trim() || null,
        subjective: fields.subjective.trim() || null,
        objective: fields.objective.trim() || null,
        assessment: fields.assessment.trim() || null,
        plan: fields.plan.trim() || null,
      };
      if (row) {
        const saved = await updateSoapTemplate(null, row.id, body);
        ctx.data.soap.setItems((prev) => prev.map((t) => (t.id === saved.id ? saved : t)).sort(byTitle));
      } else {
        const saved = await createSoapTemplate(null, ctx.doctorId, body);
        ctx.data.soap.setItems((prev) => [...prev, saved].sort(byTitle));
      }
      ctx.toast.push("success", `SOAP template “${body.title}” saved.`);
      ctx.closePanel();
    } catch {
      ctx.toast.push("error", "SOAP template was not saved. Your edits are still here — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel
      isOpen
      title={row ? (readOnly ? row.title : `Edit “${row.title}”`) : "New SOAP template"}
      subtitle={readOnly ? "System template — read only. Duplicate it to make your own copy." : undefined}
      dirty={dirty}
      saving={saving}
      readOnly={readOnly}
      onClose={ctx.closePanel}
      onSave={save}
      saveBlockedReason={reason}
      footer={readOnly && row ? <Button variant="primary" onClick={() => void onDuplicate(row)}>Duplicate to mine</Button> : undefined}
    >
      <div className="space-y-md">
        {!readOnly && (
          <div role="tablist" aria-label="Editor view" className="inline-flex rounded-lg border border-outline-variant p-[2px]">
            {(["edit", "preview"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("min-h-11 rounded-md px-md text-label-md", mode === m ? "bg-primary/10 text-primary" : "text-on-surface-variant")}>
                {m === "edit" ? "Edit" : "Preview"}
              </button>
            ))}
          </div>
        )}
        {mode === "edit" && !readOnly ? (
          <>
            <Field label="Template name">
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. "Annual Physical — Normal"' autoFocus />
            </Field>
            {SOAP_KEYS.map((k) => (
              <Field key={k} label={SOAP_FIELD_LABELS[k]}>
                <textarea className={cn(inputCls, "min-h-24")} rows={3} value={fields[k]} onChange={(e) => setFields((f) => ({ ...f, [k]: e.target.value }))} />
              </Field>
            ))}
          </>
        ) : (
          <div className="space-y-sm" aria-label="Template preview">
            <p className="text-body-md font-semibold text-on-surface">{title || "Untitled template"}</p>
            {SOAP_KEYS.map((k) => (
              <div key={k} className="rounded-lg border border-outline-variant p-sm">
                <p className="text-label-md font-semibold text-on-surface">{SOAP_FIELD_LABELS[k]}</p>
                <pre className="mt-xs whitespace-pre-wrap break-words font-sans text-body-sm text-on-surface">{fields[k].trim() || "—"}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  );
}
//JJQR - END
