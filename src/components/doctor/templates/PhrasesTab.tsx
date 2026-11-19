"use client";
//JJQR - AI (Nov 19, 2026) - new file: phrases tab - grouped by SOAP field; create / edit / delete / reorder (↑↓) / move to another field / search
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { createSoapPhrase, updateSoapPhrase, deleteSoapPhrase, reorderSoapPhrases, type SoapPhraseRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { validatePhrase } from "@/lib/templates/validation";
import { moveId } from "@/lib/templates/reorder";
import { phraseNameFromText } from "@/lib/templates/format";
import { PHRASE_FIELDS, phraseFieldLabel, type PhraseField } from "@/lib/templates/urlState";
import { cn } from "@/lib/cn";
import type { TabCtx } from "./types";
import { EmptyHint, Field, IconButton, LoadGate, TextAction, inputCls, truncate, useConfirmDelete } from "./shared";

const sortRows = (rows: SoapPhraseRow[]) =>
  rows.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label));

export function PhrasesTab({ ctx }: { ctx: TabCtx }) {
  const { data, toast, panelId } = ctx;
  const rows = data.phrases.items;
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [movingId, setMovingId] = useState<string | null>(null);

  // Deep link ?field=Plan → scroll that section into view once the list is ready.
  useEffect(() => {
    if (ctx.field && data.phrases.status === "ready") sectionRefs.current[ctx.field]?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [ctx.field, data.phrases.status]);

  const grouped = useMemo(() => {
    const out: Record<string, SoapPhraseRow[]> = {};
    for (const f of PHRASE_FIELDS) out[f.value] = [];
    for (const p of sortRows(rows)) (out[p.field] ??= []).push(p);
    return out;
  }, [rows]);

  async function reorder(field: string, id: string, dir: -1 | 1) {
    const ids = grouped[field].map((p) => p.id);
    const next = moveId(ids, id, dir);
    if (next === ids) return;
    const before = data.phrases.items;
    // Optimistic: assign 1..n to this field's phrases in the new order.
    data.phrases.setItems((prev) => prev.map((p) => (p.field === field ? { ...p, sort_order: next.indexOf(p.id) + 1 } : p)));
    try {
      await reorderSoapPhrases(null, ctx.doctorId, next);
    } catch {
      data.phrases.setItems(before);
      toast.push("error", "Couldn’t save the new order. It was put back.");
    }
  }

  async function moveToField(row: SoapPhraseRow, field: string) {
    if (field === row.field) return;
    setMovingId(row.id);
    try {
      const saved = await updateSoapPhrase(null, row.id, { field, label: row.label, body: row.body });
      data.phrases.setItems((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      toast.push("success", `Moved “${row.label}” to ${phraseFieldLabel(field)}.`);
    } catch {
      toast.push("error", "Couldn’t move the phrase. It stays where it was.");
    } finally {
      setMovingId(null);
    }
  }

  const confirm = useConfirmDelete((id, label) =>
    ctx.deleteWithUndo({
      id,
      label,
      commit: () => deleteSoapPhrase(null, id),
      afterCommit: () => data.phrases.setItems((prev) => prev.filter((p) => p.id !== id)),
    }),
  );

  const editing = panelId && panelId !== "new" ? rows.find((p) => p.id === panelId) ?? null : null;

  return (
    <div className="space-y-lg">
      <div className="flex justify-end">
        <Button onClick={() => ctx.openPanel("new", ctx.field)}>Add phrase</Button>
      </div>
      <LoadGate status={data.phrases.status} reload={data.phrases.reload} empty={false} label="phrases">
        {PHRASE_FIELDS.map((f) => {
          const all = grouped[f.value] ?? [];
          const visible = all.filter((p) => !ctx.isHidden(p.id)).filter((p) => matchesQuery(ctx.query, p.label, p.body));
          const filtering = ctx.query.trim() !== "";
          return (
            <section
              key={f.value}
              ref={(el) => { sectionRefs.current[f.value] = el; }}
              aria-label={`${f.label} phrases`}
              className={cn("scroll-mt-md rounded-xl border bg-surface-container-lowest p-md", ctx.field === f.value ? "border-primary ring-2 ring-primary/20" : "border-outline-variant")}
            >
              <div className="mb-sm flex items-center justify-between gap-sm">
                <h3 className="text-body-md font-semibold text-on-surface">{f.label} <span className="font-normal text-on-surface-variant">({all.length})</span></h3>
                <TextAction onClick={() => ctx.openPanel("new", f.value)}>Add to {f.label}</TextAction>
              </div>
              {visible.length === 0 ? (
                <EmptyHint>{all.length === 0 ? "No phrases yet." : "No phrases match your search."}</EmptyHint>
              ) : (
                <ul className="divide-y divide-outline-variant">
                  {visible.map((p) => {
                    const idx = all.findIndex((x) => x.id === p.id);
                    return (
                      <li key={p.id} className={cn("flex flex-wrap items-center gap-sm py-sm", panelId === p.id && "bg-primary/5")}>
                        <button type="button" onClick={() => ctx.openPanel(p.id, p.field)} className="min-w-0 flex-1 basis-48 text-left">
                          <span className="block truncate text-body-md font-medium text-on-surface">{p.label}</span>
                          <span className="block truncate text-label-md text-on-surface-variant">{truncate(p.body, 120)}</span>
                        </button>
                        <div className="flex items-center gap-xs">
                          <IconButton label={`Move “${p.label}” up`} icon="expand_less" disabled={filtering || idx <= 0} onClick={() => void reorder(p.field, p.id, -1)} />
                          <IconButton label={`Move “${p.label}” down`} icon="expand_more" disabled={filtering || idx === all.length - 1} onClick={() => void reorder(p.field, p.id, 1)} />
                          {/*JJQR - AI (Nov 19, 2026) - "Move to…" menu replaces the per-row Field dropdown */}
                          <MoveToMenu label={p.label} current={p.field} busy={movingId === p.id} onMove={(f) => void moveToField(p, f)} />
                          {/*JJQR - END */}
                          <TextAction onClick={() => ctx.openPanel(p.id, p.field)}>Edit</TextAction>
                          <TextAction tone="danger" onClick={() => confirm.ask(p.id, p.label)}>Delete</TextAction>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </LoadGate>
      {panelId && (panelId === "new" || editing) && <PhraseEditor key={`${panelId}:${ctx.field ?? ""}`} ctx={ctx} row={editing} />}
      {confirm.modal}
    </div>
  );
}

//JJQR - AI (Nov 19, 2026)
function MoveToMenu({ label, current, busy, onMove }: { label: string; current: string; busy: boolean; onMove: (field: string) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={`Move “${label}” to another field`}
        className="flex min-h-11 cursor-pointer list-none items-center gap-xs rounded-lg px-sm text-label-md text-primary hover:bg-surface-container-high [&::-webkit-details-marker]:hidden"
      >
        Move to…
      </summary>
      <ul role="menu" className="absolute right-0 z-20 mt-xs min-w-44 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest py-xs shadow-lg">
        {PHRASE_FIELDS.filter((o) => o.value !== current).map((o) => (
          <li key={o.value} role="none">
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => { if (ref.current) ref.current.open = false; onMove(o.value); }}
              className="block min-h-11 w-full px-md text-left text-body-md text-on-surface hover:bg-surface-container-high disabled:opacity-40"
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
//JJQR - END

function PhraseEditor({ ctx, row }: { ctx: TabCtx; row: SoapPhraseRow | null }) {
  const initial = { field: (row?.field as PhraseField) ?? ctx.field ?? "ChiefComplaint", label: row?.label ?? "", body: row?.body ?? "" };
  const [field, setField] = useState<string>(initial.field);
  const [label, setLabel] = useState(initial.label);
  const [body, setBody] = useState(initial.body);
  //JJQR - AI (Nov 19, 2026) - the name follows the first words of the text until the doctor types their own name
  const [nameEdited, setNameEdited] = useState(!!row?.label);
  //JJQR - END
  const [saving, setSaving] = useState(false);
  const dirty = field !== initial.field || label !== initial.label || body !== initial.body;
  const reason = validatePhrase({ label, body });

  async function save() {
    if (reason || saving) return;
    setSaving(true);
    try {
      const input = { field, label: label.trim(), body: body.trim() };
      if (row) {
        const saved = await updateSoapPhrase(null, row.id, input);
        ctx.data.phrases.setItems((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        const saved = await createSoapPhrase(null, ctx.doctorId, input);
        ctx.data.phrases.setItems((prev) => [...prev, saved]);
      }
      ctx.toast.push("success", `Phrase “${input.label}” saved.`);
      ctx.closePanel();
    } catch {
      ctx.toast.push("error", "Phrase was not saved. Your edits are still here — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel isOpen title={row ? `Edit “${row.label}”` : "New phrase"} dirty={dirty} saving={saving} onClose={ctx.closePanel} onSave={save} saveBlockedReason={reason}>
      <div className="space-y-md">
        <Field label="SOAP field">
          <select className={inputCls} value={field} onChange={(e) => setField(e.target.value)}>
            {PHRASE_FIELDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Phrase name" hint="Filled in from the first words of your text. Shown in the “Insert phrase…” list.">
          <input className={inputCls} value={label} onChange={(e) => { setLabel(e.target.value); setNameEdited(true); }} placeholder="Fills in from your text — or type your own" autoFocus />
        </Field>
        <Field label="Phrase text" hint="Inserted into the note at the cursor, on its own line.">
          <textarea className={cn(inputCls, "min-h-40")} rows={6} value={body} onChange={(e) => { setBody(e.target.value); if (!nameEdited) setLabel(phraseNameFromText(e.target.value)); }} />
        </Field>
      </div>
    </SidePanel>
  );
}
//JJQR - END
