"use client";
//JJQR - AI (Nov 19, 2026) - new file: favorite medicines tab - add / edit / remove / reorder (↑↓)
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { addFavoriteMedicine, updateFavoriteMedicine, deleteFavoriteMedicine, reorderFavoriteMedicines, type FavoriteMedicineRow } from "@/lib/data/clinical";
import { matchesQuery } from "@/lib/templates/search";
import { validateFavorite } from "@/lib/templates/validation";
import { moveId } from "@/lib/templates/reorder";
import type { TabCtx } from "./types";
import { EmptyHint, Field, IconButton, LoadGate, NIL_GUID, TextAction, inputCls, useConfirmDelete } from "./shared";

export function FavoritesTab({ ctx }: { ctx: TabCtx }) {
  const { data, toast, panelId } = ctx;
  const rows = data.favorites.items;
  const shown = rows.filter((f) => !ctx.isHidden(f.id));
  const filtering = ctx.query.trim() !== "";
  const visible = shown.filter((f) => matchesQuery(ctx.query, f.generic_name, f.dosage, f.instruction));

  async function reorder(id: string, dir: -1 | 1) {
    const ids = shown.map((f) => f.id);
    const next = moveId(ids, id, dir);
    if (next === ids) return;
    const before = data.favorites.items;
    data.favorites.setItems((prev) => next.map((i) => prev.find((f) => f.id === i)!).concat(prev.filter((f) => !next.includes(f.id))));
    try {
      await reorderFavoriteMedicines(null, ctx.doctorId, next);
    } catch {
      data.favorites.setItems(before);
      toast.push("error", "Couldn’t save the new order. It was put back.");
    }
  }

  const confirm = useConfirmDelete((id, label) =>
    ctx.deleteWithUndo({
      id,
      label,
      commit: () => deleteFavoriteMedicine(null, id),
      afterCommit: () => data.favorites.setItems((prev) => prev.filter((f) => f.id !== id)),
    }),
  );
  const editing = panelId && panelId !== "new" ? rows.find((f) => f.id === panelId) ?? null : null;

  return (
    <div className="space-y-md">
      <div className="flex justify-end"><Button onClick={() => ctx.openPanel("new")}>Add favorite medicine</Button></div>
      <LoadGate status={data.favorites.status} reload={data.favorites.reload} empty={false} label="favorite medicines">
        {visible.length === 0 ? (
          rows.length === 0 ? (
          //JJQR - AI (Nov 19, 2026) - favorites empty state with a short how-to
          <div data-testid="favorites-empty" className="space-y-sm rounded-xl border border-dashed border-outline-variant p-lg text-on-surface">
            <p className="text-body-md font-semibold">No favorite medicines yet</p>
            <p className="text-body-md text-on-surface-variant">Favorites are the medicines you prescribe most, one tap away in the prescription step.</p>
            <ol className="list-decimal space-y-xs pl-lg text-body-md text-on-surface-variant">
              <li>Tap <strong className="text-on-surface">Add favorite medicine</strong>.</li>
              <li>Pick the medicine, then add its usual dose, quantity and directions.</li>
              <li>Save. Use the ↑ ↓ buttons to put your top picks first.</li>
            </ol>
            <Button onClick={() => ctx.openPanel("new")}>Add favorite medicine</Button>
          </div>
          //JJQR - END
        ) : (
          <EmptyHint>No favorites match your search.</EmptyHint>
        )
        ) : (
          <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant bg-surface-container-lowest">
            {visible.map((f) => {
              const idx = shown.findIndex((x) => x.id === f.id);
              return (
                <li key={f.id} className={`flex flex-wrap items-center gap-sm px-md py-sm ${panelId === f.id ? "bg-primary/5" : ""}`}>
                  <button type="button" onClick={() => ctx.openPanel(f.id)} className="min-w-0 flex-1 basis-48 text-left">
                    <span className="block truncate text-body-md font-medium text-on-surface">{f.generic_name}</span>
                    <span className="block truncate text-label-md text-on-surface-variant">{[f.dosage, f.quantity, f.instruction].filter(Boolean).join(" · ")}</span>
                  </button>
                  <div className="flex items-center gap-xs">
                    <IconButton label={`Move ${f.generic_name} up`} icon="expand_less" disabled={filtering || idx <= 0} onClick={() => void reorder(f.id, -1)} />
                    <IconButton label={`Move ${f.generic_name} down`} icon="expand_more" disabled={filtering || idx === shown.length - 1} onClick={() => void reorder(f.id, 1)} />
                    <TextAction onClick={() => ctx.openPanel(f.id)}>Edit</TextAction>
                    <TextAction tone="danger" onClick={() => confirm.ask(f.id, f.generic_name)}>Remove</TextAction>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </LoadGate>
      {panelId && (panelId === "new" || editing) && <FavoriteEditor key={panelId} ctx={ctx} row={editing} />}
      {confirm.modal}
    </div>
  );
}

function FavoriteEditor({ ctx, row }: { ctx: TabCtx; row: FavoriteMedicineRow | null }) {
  const initial = { name: row?.generic_name ?? "", medicineId: row?.medicine_id && row.medicine_id !== NIL_GUID ? row.medicine_id : "", dosage: row?.dosage ?? "", quantity: row?.quantity ?? "", instruction: row?.instruction ?? "" };
  const [name, setName] = useState(initial.name);
  const [medicineId, setMedicineId] = useState(initial.medicineId);
  const [dosage, setDosage] = useState(initial.dosage);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [instruction, setInstruction] = useState(initial.instruction);
  const [saving, setSaving] = useState(false);
  const medicines = ctx.data.medicines.items;
  const dirty = name !== initial.name || dosage !== initial.dosage || quantity !== initial.quantity || instruction !== initial.instruction;
  const reason = validateFavorite({ genericName: name });

  async function save() {
    if (reason || saving) return;
    setSaving(true);
    try {
      const input = { medicine_id: medicineId || NIL_GUID, generic_name: name.trim(), dosage: dosage.trim(), quantity: quantity.trim(), instruction: instruction.trim() || null };
      if (row) {
        const saved = await updateFavoriteMedicine(null, row.id, input);
        ctx.data.favorites.setItems((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
      } else {
        const saved = await addFavoriteMedicine(null, ctx.doctorId, input);
        ctx.data.favorites.setItems((prev) => [...prev, saved]);
      }
      ctx.toast.push("success", `Favorite “${input.generic_name}” saved.`);
      ctx.closePanel();
    } catch {
      ctx.toast.push("error", "Favorite was not saved. Your edits are still here — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel isOpen title={row ? `Edit “${row.generic_name}”` : "Add favorite medicine"} dirty={dirty} saving={saving} onClose={ctx.closePanel} onSave={save} saveBlockedReason={reason}>
      <div className="space-y-md">
        <datalist id="fav-medicines">{medicines.map((m) => <option key={m.id} value={m.generic_name} />)}</datalist>
        <Field label="Medicine" hint="Pick from the catalog or type a name.">
          <input
            className={inputCls}
            list="fav-medicines"
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setMedicineId(medicines.find((m) => m.generic_name.toLowerCase() === e.target.value.trim().toLowerCase())?.id ?? "");
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-sm">
          <Field label="Dosage"><input className={inputCls} value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500 mg" /></Field>
          <Field label="Quantity"><input className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="21 tabs" /></Field>
        </div>
        <Field label="Directions"><input className={inputCls} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. 1 tab every 8 hours" /></Field>
      </div>
    </SidePanel>
  );
}
//JJQR - END
