"use client";
//JJQR - AI (Nov 19, 2026) - new file: SOAP templates tab (list / search / create / edit / duplicate / delete / preview).
//JJQR - AI (Nov 20, 2026) A1 — one list only: every row is the doctor's own (Edit / Duplicate / Delete).
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { createSoapTemplate, updateSoapTemplate, deleteSoapTemplate, type SoapTemplateRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { validateSoapTemplate } from "@/lib/templates/validation";
import { SOAP_FIELD_LABELS, SOAP_KEYS, type SoapKey } from "@/lib/clinical/soap-merge";
import { cn } from "@/lib/cn";
import { copyTitle, isCopyTitle } from "@/lib/templates/format";
import type { TabCtx } from "./types";
import { EmptyHint, Field, ItemCard, ItemList, LoadGate, Pill, RestoreBuiltIns, TextAction, inputCls, truncate, useConfirmDelete } from "./shared";

const COLUMN: Record<SoapKey, keyof SoapTemplateRow> = {
  chiefComplaint: "chief_complaint",
  subjective: "subjective",
  objective: "objective",
  assessment: "assessment",
  plan: "plan",
};
const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

export function SoapTab({ ctx }: { ctx: TabCtx }) {
  const { data, toast, panelId } = ctx;
  const rows = data.soap.items;

  const visible = useMemo(
    () =>
      rows
        .slice()
        .sort(byTitle)
        .filter((t) => !ctx.isHidden(t.id))
        .filter((t) => matchesQuery(ctx.query, t.title, t.chief_complaint, t.subjective, t.objective, t.assessment, t.plan)),
    [rows, ctx],
  );

  async function duplicate(row: SoapTemplateRow) {
    try {
      const created = await createSoapTemplate(null, ctx.doctorId, {
        title: copyTitle(row.title, rows.map((r) => r.title)),
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
        {/*JJQR - AI (Nov 20, 2026) A3 — Specialty chips removed from this page. */}
        <Button className="ml-auto" onClick={() => ctx.openPanel("new")}>New SOAP template</Button>
      </div>

      <LoadGate status={data.soap.status} reload={data.soap.reload} empty={false} label="SOAP templates">
        {visible.length === 0 ? (
          <EmptyHint>{rows.length === 0 ? "No SOAP templates yet. Create one, or save one from a consultation." : "No SOAP templates match these filters."}</EmptyHint>
        ) : (
          <ItemList>
            {visible.map((t) => (
              <ItemCard
                key={t.id}
                title={t.title}
                highlight={panelId === t.id}
                onOpen={() => ctx.openPanel(t.id)}
                pills={isCopyTitle(t.title) ? <Pill>Copy</Pill> : undefined}
                preview={truncate([t.chief_complaint, t.subjective, t.assessment, t.plan, t.objective].find((x) => x && x.trim()) ?? "")}
                actions={
                  <>
                    <TextAction onClick={() => ctx.openPanel(t.id)}>Edit</TextAction>
                    <TextAction onClick={() => void duplicate(t)}>Duplicate</TextAction>
                    <TextAction tone="danger" onClick={() => confirm.ask(t.id, t.title)}>Delete</TextAction>
                  </>
                }
              />
            ))}
          </ItemList>
        )}
      </LoadGate>

      {panelId && (panelId === "new" || editing) && (
        <SoapEditor key={panelId} ctx={ctx} row={editing} />
      )}
      {/*JJQR - AI (Nov 20, 2026) A4 */}
      <RestoreBuiltIns doctorId={ctx.doctorId} kind="soap" onRestored={data.soap.reload} toast={toast} />
      {confirm.modal}
    </div>
  );
}

function SoapEditor({ ctx, row }: { ctx: TabCtx; row: SoapTemplateRow | null }) {
  const initial = useMemo(() => ({
    title: row?.title ?? "",
    fields: Object.fromEntries(SOAP_KEYS.map((k) => [k, (row?.[COLUMN[k]] as string | null) ?? ""])) as Record<SoapKey, string>,
  }), [row]);
  const [title, setTitle] = useState(initial.title);
  const [fields, setFields] = useState(initial.fields);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
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
      title={row ? `Edit “${row.title}”` : "New SOAP template"}
      dirty={dirty}
      saving={saving}
      onClose={ctx.closePanel}
      onSave={save}
      saveBlockedReason={reason}
    >
      <div className="space-y-md">
        <div role="tablist" aria-label="Editor view" className="inline-flex rounded-lg border border-outline-variant p-[2px]">
          {(["edit", "preview"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("min-h-11 rounded-md px-md text-label-md", mode === m ? "bg-primary/10 text-primary" : "text-on-surface-variant")}>
              {m === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
        </div>
        {mode === "edit" ? (
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
