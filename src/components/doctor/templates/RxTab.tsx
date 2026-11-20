"use client";
//JJQR - AI (Nov 19, 2026) - new file: prescription set tab - full editor incl. route, meals, timing, duration, indication and the controlled-substance flag (preserved on edit)
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { createRxTemplate, updateRxTemplate, deleteRxTemplate, type RxItem, type RxTemplateRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { validateRxTemplate } from "@/lib/templates/validation";
import { moveId } from "@/lib/templates/reorder";
import { cn } from "@/lib/cn";
import { copyTitle, isCopyTitle, rxSig } from "@/lib/templates/format";
//JJQR - AI (Nov 20, 2026)
import { asNeededFromWire, asNeededToWire, suggestFromSig } from "@/lib/rx-structured";
//JJQR - END
import type { TabCtx } from "./types";
import { EmptyHint, Field, IconButton, ItemCard, ItemList, LoadGate, NIL_GUID, Pill, RestoreBuiltIns, TextAction, inputCls, truncate, useConfirmDelete, useViewMode } from "./shared";

export const TIMING_SLOTS = ["Breakfast", "Lunch", "Dinner", "Bedtime"] as const;
export const ROUTES = ["PO", "IV", "IM", "SC", "SL", "Topical", "Inhaled", "Nasal", "Ophthalmic", "Otic", "PR"] as const;
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
  //JJQR - AI (Nov 20, 2026)
  asNeeded: boolean | null;
  //JJQR - END
}

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;
const blankLine = (): LineDraft => ({ key: newKey(), medicineId: "", genericName: "", dosage: "", quantity: "", instruction: "", isControlled: false, route: "PO", meal: null, timing: [], durationKind: null, durationValue: "", indication: "", asNeeded: null });

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
    //JJQR - AI (Nov 20, 2026)
    asNeeded: asNeededFromWire(i.as_needed),
    //JJQR - END
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
    //JJQR - AI (Nov 20, 2026)
    as_needed: asNeededToWire(l.asNeeded),
    //JJQR - END
  };
}

/** Stable text form of the editor state (line keys excluded) for the unsaved-changes check. */
function snapshotOf(title: string, lines: LineDraft[]): string {
  return JSON.stringify({ t: title, l: lines.map((l) => ({ ...l, key: "" })) });
}

//JJQR - AI (Nov 19, 2026) - cards show the sig (drug, dose, frequency, duration) in normal case
function RxSigPreview({ items }: { items: RxItem[] }) {
  const mode = useViewMode();
  const sigs = items.map(rxSig);
  if (mode === "list") return <>{truncate(sigs.join("; "), 220)}</>;
  return (
    <span className="block space-y-[2px]">
      {sigs.slice(0, 3).map((x, i) => <span key={i} className="block">{x}</span>)}
      {sigs.length > 3 && <span className="block text-on-surface-variant">+{sigs.length - 3} more</span>}
    </span>
  );
}
//JJQR - END

export function RxTab({ ctx }: { ctx: TabCtx }) {
  const { data, toast, panelId } = ctx;
  const rows = data.rx.items;
  //JJQR - AI (Nov 20, 2026) A1 — one list only: every prescription set is hers (Edit / Duplicate / Delete).
  const visible = useMemo(
    () =>
      rows
        .slice()
        .sort(byTitle)
        .filter((t) => !ctx.isHidden(t.template_id))
        .filter((t) => matchesQuery(ctx.query, t.title, ...t.prescription_template_items.flatMap((i) => [i.generic_name, i.dosage, i.instruction, i.indication]))),
    [rows, ctx],
  );

  async function duplicate(row: RxTemplateRow) {
    try {
      const created = await createRxTemplate(null, ctx.doctorId, {
        title: copyTitle(row.title, rows.map((r) => r.title)),
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
        <Button className="ml-auto" onClick={() => ctx.openPanel("new")}>New prescription set</Button>
      </div>
      <LoadGate status={data.rx.status} reload={data.rx.reload} empty={false} label="prescription sets">
        {visible.length === 0 ? (
          <EmptyHint>{rows.length === 0 ? "No prescription sets yet." : "No prescription sets match these filters."}</EmptyHint>
        ) : (
          <ItemList>
            {visible.map((t) => (
              <ItemCard
                key={t.template_id}
                title={t.title}
                highlight={panelId === t.template_id}
                onOpen={() => ctx.openPanel(t.template_id)}
                pills={<>{isCopyTitle(t.title) && <Pill>Copy</Pill>}<Pill>{t.prescription_template_items.length} med{t.prescription_template_items.length === 1 ? "" : "s"}</Pill></>}
                preview={<RxSigPreview items={t.prescription_template_items} />}
                actions={
                  <>
                    <TextAction onClick={() => ctx.openPanel(t.template_id)}>Edit</TextAction>
                    <TextAction onClick={() => void duplicate(t)}>Duplicate</TextAction>
                    <TextAction tone="danger" onClick={() => confirm.ask(t.template_id, t.title)}>Delete</TextAction>
                  </>
                }
              />
            ))}
          </ItemList>
        )}
      </LoadGate>
      {panelId && (panelId === "new" || editing) && <RxEditor key={panelId} ctx={ctx} row={editing} />}
      {/*JJQR - AI (Nov 20, 2026) A4 */}
      <RestoreBuiltIns doctorId={ctx.doctorId} kind="rx" onRestored={data.rx.reload} toast={toast} />
      {confirm.modal}
    </div>
  );
}

/** Row → create-payload shape (drops ids / timestamps, keeps every clinical field). */
function fromItemToPlain(i: RxItem): Omit<RxItem, "id"> {
  return toItem(fromItem(i));
}

function RxEditor({ ctx, row }: { ctx: TabCtx; row: RxTemplateRow | null }) {
  const initialLines = useMemo(() => (row ? row.prescription_template_items.map(fromItem) : [blankLine()]), [row]);
  const initialSnapshot = useMemo(() => snapshotOf(row?.title ?? "", initialLines), [row, initialLines]);
  const [title, setTitle] = useState(row?.title ?? "");
  const [lines, setLines] = useState<LineDraft[]>(initialLines);
  //JJQR - AI (Nov 20, 2026) - fields already saved on a template line are never overwritten by the sig parser
  const locked = useRef<Set<string>>(
    new Set(initialLines.flatMap((l) => [l.meal != null ? l.key + ":meal" : "", l.timing.length ? l.key + ":timing" : "", l.asNeeded != null ? l.key + ":asNeeded" : ""].filter(Boolean))),
  );
  //JJQR - END
  const [saving, setSaving] = useState(false);
  const dirty = snapshotOf(title, lines) !== initialSnapshot;
  const reason = validateRxTemplate({ title, items: lines });
  const medicines = ctx.data.medicines.items;

  function patch(key: string, p: Partial<LineDraft>) {
    //JJQR - AI (Nov 20, 2026) - pill taps lock that field; typing Directions pre-fills the unlocked ones from the sig parser
    if ("meal" in p) locked.current.add(key + ":meal");
    if ("timing" in p) locked.current.add(key + ":timing");
    if ("asNeeded" in p) locked.current.add(key + ":asNeeded");
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...p };
        if ("instruction" in p || "route" in p) {
          const s = suggestFromSig({ instruction: next.instruction, route: next.route });
          if (!locked.current.has(key + ":asNeeded")) next.asNeeded = s.asNeeded;
          if (!locked.current.has(key + ":meal")) next.meal = s.meal;
          if (!locked.current.has(key + ":timing")) next.timing = next.asNeeded === true ? [] : s.slots;
        }
        return next;
      }),
    );
    //JJQR - END
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
      title={row ? `Edit “${row.title}”` : "New prescription set"}
      dirty={dirty}
      saving={saving}
      onClose={ctx.closePanel}
      onSave={save}
      saveBlockedReason={reason}
    >
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
              {/* JJQR - AI (Nov 20, 2026) */}
              <div className="flex flex-wrap gap-sm">
                <button type="button" aria-pressed={l.asNeeded === true} onClick={() => patch(l.key, { asNeeded: l.asNeeded === true ? false : true })} className={cn(chip(l.asNeeded === true), "min-h-[44px] min-w-[44px] px-md")}>As needed</button>
              </div>
              {/* JJQR - END */}
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
    </SidePanel>
  );
}
//JJQR - END
