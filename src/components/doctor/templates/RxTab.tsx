"use client";
//JJQR - AI (Nov 19, 2026) - new file: prescription set tab - full editor incl. route, meals, timing, duration, indication and the controlled-substance flag (preserved on edit)
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { createRxTemplate, updateRxTemplate, deleteRxTemplate, type RxItem, type RxTemplateRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { validateRxTemplate } from "@/lib/templates/validation";
import { moveId } from "@/lib/templates/reorder";
import { cn } from "@/lib/cn";
import type { TabCtx } from "./types";
import { EmptyHint, Field, FilterChip, IconButton, ItemCard, LoadGate, NIL_GUID, Pill, TextAction, inputCls, truncate, useConfirmDelete } from "./shared";

export const TIMING_SLOTS = ["Breakfast", "Lunch", "Dinner", "Bedtime"] as const;
export const ROUTES = ["PO", "IV", "IM", "SC", "SL", "Topical", "Inhaled", "Nasal", "Ophthalmic", "Otic", "PR"] as const;
type Source = "all" | "mine" | "system";
const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

interface LineDraft {
  key: string;
  medicineId: string;
  genericName: string;
  dosage: string;
  quantity: string;
  instruction: string;
  isControlled: boolean;
  route: string;
  meal: "Before" | "After" | null;
  timing: string[];
  durationKind: "Maintain" | "Days" | "Weeks" | null;
  durationValue: string;
  indication: string;
}

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;
const blankLine = (): LineDraft => ({ key: newKey(), medicineId: "", genericName: "", dosage: "", quantity: "", instruction: "", isControlled: false, route: "PO", meal: null, timing: [], durationKind: null, durationValue: "", indication: "" });

function fromItem(i: RxItem): LineDraft {
  const kind = i.duration_kind === "Maintain" || i.duration_kind === "Days" || i.duration_kind === "Weeks" ? i.duration_kind : null;
  return {
    key: newKey(),
    medicineId: i.medicine_id === NIL_GUID ? "" : i.medicine_id,
    genericName: i.generic_name,
    dosage: i.dosage,
    quantity: i.quantity,
    instruction: i.instruction ?? "",
    isControlled: !!i.is_controlled_substance,
    route: i.route || "PO",
    meal: i.meal_relation === "Before" || i.meal_relation === "After" ? i.meal_relation : null,
    timing: (i.timing ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    durationKind: kind,
    durationValue: i.duration_value ? String(i.duration_value) : "",
    indication: i.indication ?? "",
  };
}

export function toItem(l: LineDraft): Omit<RxItem, "id"> {
  const hasNumber = l.durationKind === "Days" || l.durationKind === "Weeks";
  return {
    medicine_id: l.medicineId || NIL_GUID,
    generic_name: l.genericName.trim(),
    dosage: l.dosage.trim(),
    quantity: l.quantity.trim(),
    instruction: l.instruction.trim() || null,
    is_controlled_substance: l.isControlled,
    route: l.route || null,
    meal_relation: l.meal,
    timing: l.timing.length ? l.timing.join(", ") : null,
    duration_kind: l.durationKind,
    duration_value: hasNumber ? Number(l.durationValue) || null : null,
    indication: l.indication.trim() || null,
  };
}

/** Stable text form of the editor state (line keys excluded) for the unsaved-changes check. */
function snapshotOf(title: string, lines: LineDraft[]): string {
  return JSON.stringify({ t: title, l: lines.map((l) => ({ ...l, key: "" })) });
}

function describe(i: RxItem): string {
  const when = [i.meal_relation ? `${i.meal_relation.toLowerCase()} meals` : "", i.timing ?? ""].filter(Boolean).join(" · ");
  const dur = i.duration_kind === "Maintain" ? "maintenance" : i.duration_kind && i.duration_value ? `${i.duration_value} ${i.duration_kind.toLowerCase()}` : "";
  return [i.generic_name, i.dosage, i.route, when, dur].filter(Boolean).join(" · ");
}

export function RxTab({ ctx }: { ctx: TabCtx }) {
  const { data, toast, panelId } = ctx;
  const [source, setSource] = useState<Source>("all");
  const rows = data.rx.items;
  const visible = useMemo(
    () =>
      rows
        .filter((t) => !ctx.isHidden(t.template_id))
        .filter((t) => source === "all" || (source === "system") === t.is_system_template)
        .filter((t) => matchesQuery(ctx.query, t.title, ...t.prescription_template_items.flatMap((i) => [i.generic_name, i.dosage, i.instruction, i.indication]))),
    [rows, source, ctx],
  );

  async function duplicate(row: RxTemplateRow) {
    try {
      const created = await createRxTemplate(null, ctx.doctorId, {
        title: `${row.title} (copy)`,
        is_system_template: false,
        items: row.prescription_template_items.map((i) => ({ ...fromItemToPlain(i) })),
      });
      data.rx.setItems((prev) => [...prev, created].sort(byTitle));
      toast.push("success", `Duplicated to “${created.title}”.`);
      ctx.openPanel(created.template_id);
    } catch {
      toast.push("error", "Couldn’t duplicate the prescription set. Please try again.");
    }
  }

  const confirm = useConfirmDelete((id, label) =>
    ctx.deleteWithUndo({
      id,
      label,
      commit: () => deleteRxTemplate(null, id),
      afterCommit: () => data.rx.setItems((prev) => prev.filter((t) => t.template_id !== id)),
    }),
  );
  const editing = panelId && panelId !== "new" ? rows.find((t) => t.template_id === panelId) ?? null : null;

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-center gap-sm">
        <div className="flex gap-xs overflow-x-auto" role="group" aria-label="Source">
          {(["all", "mine", "system"] as const).map((s) => (
            <FilterChip key={s} active={source === s} onClick={() => setSource(s)}>{s === "all" ? "All" : s === "mine" ? "Mine" : "System"}</FilterChip>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => ctx.openPanel("new")}>New prescription set</Button>
      </div>
      <LoadGate status={data.rx.status} reload={data.rx.reload} empty={false} label="prescription sets">
        {visible.length === 0 ? (
          <EmptyHint>{rows.length === 0 ? "No prescription sets yet." : "No prescription sets match these filters."}</EmptyHint>
        ) : (
          <ul className="grid grid-cols-1 gap-sm xl:grid-cols-2">
            {visible.map((t) => (
              <ItemCard
                key={t.template_id}
                title={t.title}
                highlight={panelId === t.template_id}
                onOpen={() => ctx.openPanel(t.template_id)}
                pills={<><Pill>{t.prescription_template_items.length} med{t.prescription_template_items.length === 1 ? "" : "s"}</Pill><Pill tone={t.is_system_template ? "system" : "mine"}>{t.is_system_template ? "System" : "Mine"}</Pill></>}
                preview={truncate(t.prescription_template_items.map((i) => i.generic_name).join(", "))}
                actions={
                  <>
                    <TextAction onClick={() => ctx.openPanel(t.template_id)}>{t.is_system_template ? "View" : "Edit"}</TextAction>
                    <TextAction onClick={() => void duplicate(t)}>Duplicate</TextAction>
                    {!t.is_system_template && <TextAction tone="danger" onClick={() => confirm.ask(t.template_id, t.title)}>Delete</TextAction>}
                  </>
                }
              />
            ))}
          </ul>
        )}
      </LoadGate>
      {panelId && (panelId === "new" || editing) && <RxEditor key={panelId} ctx={ctx} row={editing} onDuplicate={duplicate} />}
      {confirm.modal}
    </div>
  );
}

/** Row → create-payload shape (drops ids / timestamps, keeps every clinical field). */
function fromItemToPlain(i: RxItem): Omit<RxItem, "id"> {
  return toItem(fromItem(i));
}

function RxEditor({ ctx, row, onDuplicate }: { ctx: TabCtx; row: RxTemplateRow | null; onDuplicate: (r: RxTemplateRow) => Promise<void> }) {
  const readOnly = !!row?.is_system_template;
  const initialLines = useMemo(() => (row ? row.prescription_template_items.map(fromItem) : [blankLine()]), [row]);
  const initialSnapshot = useMemo(() => snapshotOf(row?.title ?? "", initialLines), [row, initialLines]);
  const [title, setTitle] = useState(row?.title ?? "");
  const [lines, setLines] = useState<LineDraft[]>(initialLines);
  const [saving, setSaving] = useState(false);
  const dirty = snapshotOf(title, lines) !== initialSnapshot;
  const reason = validateRxTemplate({ title, items: lines });
  const medicines = ctx.data.medicines.items;

  function patch(key: string, p: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }
  function pickMedicine(key: string, name: string) {
    const m = medicines.find((x) => x.generic_name.toLowerCase() === name.trim().toLowerCase());
    patch(key, { genericName: name, medicineId: m?.id ?? "" });
  }

  async function save() {
    if (reason || saving) return;
    setSaving(true);
    try {
      const items = lines.filter((l) => l.genericName.trim()).map(toItem);
      const body = { title: title.trim(), is_system_template: false, items };
      const saved = row ? await updateRxTemplate(null, row.template_id, ctx.doctorId, body) : await createRxTemplate(null, ctx.doctorId, body);
      ctx.data.rx.setItems((prev) => (row ? prev.map((t) => (t.template_id === saved.template_id ? saved : t)) : [...prev, saved]).sort(byTitle));
      ctx.toast.push("success", `Prescription set “${body.title}” saved.`);
      ctx.closePanel();
    } catch {
      ctx.toast.push("error", "Prescription set was not saved. Your edits are still here — try again.");
    } finally {
      setSaving(false);
    }
  }

  const chip = (on: boolean) => cn("min-h-11 rounded-lg border px-sm text-label-md", on ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant");

  return (
    <SidePanel
      isOpen
      title={row ? (readOnly ? row.title : `Edit “${row.title}”`) : "New prescription set"}
      subtitle={readOnly ? "System set — read only. Duplicate it to make your own copy." : undefined}
      dirty={dirty}
      saving={saving}
      readOnly={readOnly}
      onClose={ctx.closePanel}
      onSave={save}
      saveBlockedReason={reason}
      footer={readOnly && row ? <Button onClick={() => void onDuplicate(row)}>Duplicate to mine</Button> : undefined}
    >
      {readOnly && row ? (
        <ul className="space-y-sm" aria-label="Medicines in this set">
          {row.prescription_template_items.map((i, n) => (
            <li key={i.id ?? n} className="rounded-lg border border-outline-variant p-sm text-body-md text-on-surface">
              {describe(i)}
              {i.indication && <span className="block text-label-md text-on-surface-variant">For: {i.indication}</span>}
              {i.instruction && <span className="block text-label-md text-on-surface-variant">{i.instruction}</span>}
              {i.is_controlled_substance && <Pill>Controlled</Pill>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-md">
          <Field label="Set name">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. "Fever kit — adult"' autoFocus />
          </Field>
          <datalist id="rx-medicines">{medicines.map((m) => <option key={m.id} value={m.generic_name} />)}</datalist>
          {lines.map((l, idx) => (
            <fieldset key={l.key} className="space-y-sm rounded-xl border border-outline-variant p-md">
              <legend className="px-xs text-label-md font-semibold text-on-surface">Medicine {idx + 1}</legend>
              <div className="flex items-center justify-end gap-xs">
                <IconButton label={`Move medicine ${idx + 1} up`} icon="expand_less" disabled={idx === 0} onClick={() => setLines((p) => { const ids = moveId(p.map((x) => x.key), l.key, -1); return ids.map((k) => p.find((x) => x.key === k)!); })} />
                <IconButton label={`Move medicine ${idx + 1} down`} icon="expand_more" disabled={idx === lines.length - 1} onClick={() => setLines((p) => { const ids = moveId(p.map((x) => x.key), l.key, 1); return ids.map((k) => p.find((x) => x.key === k)!); })} />
                <IconButton label={`Remove medicine ${idx + 1}`} icon="delete" tone="danger" disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} />
              </div>
              <Field label="Medicine">
                <input className={inputCls} list="rx-medicines" value={l.genericName} onChange={(e) => pickMedicine(l.key, e.target.value)} placeholder="Generic name" />
              </Field>
              <div className="grid grid-cols-2 gap-sm">
                <Field label="Dosage"><input className={inputCls} value={l.dosage} onChange={(e) => patch(l.key, { dosage: e.target.value })} placeholder="500 mg" /></Field>
                <Field label="Quantity"><input className={inputCls} value={l.quantity} onChange={(e) => patch(l.key, { quantity: e.target.value })} placeholder="21 tabs" /></Field>
              </div>
              <Field label="Route">
                <select className={inputCls} value={l.route} onChange={(e) => patch(l.key, { route: e.target.value })}>
                  {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <div>
                <span className="mb-xs block text-label-md font-medium text-on-surface">Meals</span>
                <div className="flex gap-sm">
                  {(["Before", "After"] as const).map((m) => <button key={m} type="button" aria-pressed={l.meal === m} onClick={() => patch(l.key, { meal: l.meal === m ? null : m })} className={chip(l.meal === m)}>{m}</button>)}
                </div>
              </div>
              <div>
                <span className="mb-xs block text-label-md font-medium text-on-surface">Timing</span>
                <div className="flex flex-wrap gap-sm">
                  {TIMING_SLOTS.map((s) => <button key={s} type="button" aria-pressed={l.timing.includes(s)} onClick={() => patch(l.key, { timing: l.timing.includes(s) ? l.timing.filter((x) => x !== s) : [...l.timing, s] })} className={chip(l.timing.includes(s))}>{s}</button>)}
                </div>
              </div>
              <div>
                <span className="mb-xs block text-label-md font-medium text-on-surface">Duration</span>
                <div className="flex flex-wrap items-center gap-sm">
                  {(["Maintain", "Days", "Weeks"] as const).map((k) => <button key={k} type="button" aria-pressed={l.durationKind === k} onClick={() => patch(l.key, { durationKind: l.durationKind === k ? null : k })} className={chip(l.durationKind === k)}>{k}</button>)}
                  {(l.durationKind === "Days" || l.durationKind === "Weeks") && (
                    <input type="number" min={1} aria-label="Duration number" className={cn(inputCls, "w-28")} value={l.durationValue} onChange={(e) => patch(l.key, { durationValue: e.target.value })} placeholder={`# ${l.durationKind.toLowerCase()}`} />
                  )}
                </div>
              </div>
              <Field label="Indication"><input className={inputCls} value={l.indication} onChange={(e) => patch(l.key, { indication: e.target.value })} placeholder="e.g. for fever" /></Field>
              <Field label="Directions"><input className={inputCls} value={l.instruction} onChange={(e) => patch(l.key, { instruction: e.target.value })} placeholder="e.g. with water" /></Field>
              <label className="flex min-h-11 items-center gap-sm text-body-md text-on-surface">
                <input type="checkbox" checked={l.isControlled} onChange={(e) => patch(l.key, { isControlled: e.target.checked })} /> Controlled substance
              </label>
            </fieldset>
          ))}
          <Button variant="secondary" onClick={() => setLines((p) => [...p, blankLine()])}>Add medicine</Button>
        </div>
      )}
    </SidePanel>
  );
}
//JJQR - END
