"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { queryMedicines } from "@/lib/data/lookups";
import {
  queryFavoriteMedicines,
  queryRxTemplates,
  addFavoriteMedicine,
  createRxTemplate,
  updateRxTemplate,
  deleteRxTemplate,
  upsertRxGroupByBooking,
} from "@/lib/data/clinical";
import type { PrescriptionLineItem, PrescriptionGroup, PrescriptionTemplate, Medicine } from "@/data/types";
import type { Database } from "@/data/supabase-types";

type DbTemplateItem = Database["public"]["Tables"]["prescription_template_items"]["Row"];

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// §16.8 Form 1 — turn the structured Rx-pad fields into a readable directions
// line, e.g. "After lunch, maintenance." / "Before breakfast & dinner, for 5 days."
function slotList(timing: string | null | undefined): string {
  const slots = (timing ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (slots.length === 0) return "";
  if (slots.length === 1) return slots[0];
  return `${slots.slice(0, -1).join(", ")} & ${slots[slots.length - 1]}`;
}
function durationPhrase(kind: PrescriptionLineItem["durationKind"], value: PrescriptionLineItem["durationValue"]): string {
  if (kind === "Maintain") return "maintenance";
  if ((kind === "Days" || kind === "Weeks") && value) {
    const unit = kind === "Days" ? "day" : "week";
    return `for ${value} ${unit}${value === 1 ? "" : "s"}`;
  }
  return "";
}
// meal + timing collapse into one natural phrase: "after lunch", "before breakfast & dinner".
function whenPhrase(meal: PrescriptionLineItem["mealRelation"], timing: string | null | undefined): string {
  const slots = slotList(timing);
  const m = meal ? meal.toLowerCase() : "";
  if (m && slots) return `${m} ${slots}`;
  if (m) return `${m} meals`;
  if (slots) return `at ${slots}`;
  return "";
}
export function directionsLine(item: PrescriptionLineItem): string {
  const parts = [whenPhrase(item.mealRelation, item.timing), durationPhrase(item.durationKind, item.durationValue)].filter(Boolean);
  if (parts.length === 0) return "";
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

interface LineItemListProps {
  items: PrescriptionLineItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  onEdit: (item: PrescriptionLineItem) => void;
}

function LineItemList({ items, selectedIds, onToggleSelect, onToggleSelectAll, onBulkDelete, onEdit }: LineItemListProps) {
  const sorted = [...items].sort((a, b) => a.genericName.localeCompare(b.genericName));
  return (
    <div className="space-y-sm">
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-sm text-label-md text-on-surface-variant">
            <input
              type="checkbox"
              checked={selectedIds.length === items.length}
              onChange={onToggleSelectAll}
              className="h-4 w-4"
            />
            Select All
          </label>
          {selectedIds.length > 0 && (
            <button type="button" onClick={onBulkDelete} aria-label="Delete selected" className="text-error">
              <Icon name="delete" className="text-[18px]" />
            </button>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant p-lg text-center text-body-md text-on-surface-variant">
          Add New Medicine
        </p>
      ) : (
        sorted.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-sm rounded-lg border border-outline-variant p-md">
            <div className="flex items-start gap-sm">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggleSelect(item.id)}
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0">
                <p className="text-body-md font-medium text-on-surface">
                  {item.genericName}
                  {item.dosage ? <span className="font-normal text-on-surface-variant"> {item.dosage}</span> : null}
                </p>
                <p className="text-label-sm text-on-surface-variant">Dispense: {item.quantity}</p>
                {directionsLine(item) && (
                  <p className="mt-1 text-label-md text-on-surface">
                    <span className="text-on-surface-variant">Sig:</span> {directionsLine(item)}
                  </p>
                )}
                {item.indication && (
                  <p className="text-label-sm text-on-surface-variant">For {item.indication}</p>
                )}
                {item.instruction && (
                  <p className="text-label-sm text-on-surface-variant">{item.instruction}</p>
                )}
              </div>
            </div>
            <button type="button" onClick={() => onEdit(item)} aria-label="Edit item" className="text-on-surface-variant">
              <Icon name="edit" className="text-[16px]" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

interface EditLineItemModalProps {
  item: PrescriptionLineItem | null;
  onClose: () => void;
  onSave: (item: PrescriptionLineItem) => void;
}

function EditLineItemModal({ item, onClose, onSave }: EditLineItemModalProps) {
  const [genericName, setGenericName] = useState(item?.genericName ?? "");
  const [dosage, setDosage] = useState(item?.dosage ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? "");
  const [instruction, setInstruction] = useState(item?.instruction ?? "");

  if (!item) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Prescription"
      footer={
        <Button onClick={() => onSave({ ...item, genericName, dosage, quantity, instruction })} disabled={!genericName.trim() || !quantity.trim()}>
          Save
        </Button>
      }
    >
      <div className="space-y-md">
        <input value={genericName} onChange={(e) => setGenericName(e.target.value)} placeholder="Medication" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
        <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
        <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity (e.g. 50pcs)" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
        <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Instructions" rows={3} className="w-full rounded-lg border border-outline-variant p-md" />
      </div>
    </Modal>
  );
}

interface NewRxTabProps {
  medicines: Medicine[];
  onAdd: (item: Omit<PrescriptionLineItem, "id">, addToFavorites: boolean) => void;
}

const TIMING_SLOTS = ["Breakfast", "Lunch", "Dinner", "Bedtime"] as const;

function NewRxTab({ medicines, onAdd }: NewRxTabProps) {
  const [query, setQuery] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [dosage, setDosage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [mealRelation, setMealRelation] = useState<"Before" | "After" | null>(null);
  const [timingSlots, setTimingSlots] = useState<string[]>([]);
  const [durationKind, setDurationKind] = useState<"Maintain" | "Days" | "Weeks" | null>(null);
  const [durationValue, setDurationValue] = useState("");
  const [indication, setIndication] = useState("");
  const [instructions, setInstructions] = useState("");
  const [addToFavorites, setAddToFavorites] = useState(false);

  const matches = query.length >= 3 && !selectedMedicine ? medicines.filter((m) => m.genericName.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  // Free-text is allowed — the paper Rx pad isn't limited to a catalog. A picked
  // catalog match just also carries its medicine id.
  const effectiveGenericName = (selectedMedicine?.genericName ?? query).trim();
  const canAdd = effectiveGenericName !== "" && quantity.trim() !== "";

  function reset() {
    setQuery("");
    setSelectedMedicine(null);
    setDosage("");
    setQuantity("");
    setMealRelation(null);
    setTimingSlots([]);
    setDurationKind(null);
    setDurationValue("");
    setIndication("");
    setInstructions("");
    setAddToFavorites(false);
  }

  function toggleSlot(slot: string) {
    setTimingSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  }

  function handleAdd() {
    if (!canAdd) return;
    onAdd(
      {
        rxId: selectedMedicine?.id ?? "",
        genericName: effectiveGenericName,
        dosage,
        quantity,
        instruction: instructions.trim(),
        mealRelation,
        timing: timingSlots.length ? timingSlots.join(", ") : null,
        durationKind,
        durationValue: durationKind === "Days" || durationKind === "Weeks" ? Number(durationValue) || null : null,
        indication: indication.trim() || null,
      },
      addToFavorites,
    );
    reset();
  }

  return (
    <div className="space-y-md">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedMedicine(null);
          }}
          placeholder="Medication — pick from the list or just type it"
          className="w-full rounded-lg border border-outline-variant px-md py-sm"
        />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMedicine(m);
                  setQuery(m.genericName);
                }}
                className="block w-full px-md py-sm text-left text-body-md hover:bg-surface-container-low"
              >
                {m.genericName}
              </button>
            ))}
          </div>
        )}
      </div>
      {query.trim() !== "" && !selectedMedicine && (
        <p className="text-label-sm text-on-surface-variant">
          Will be added as typed: <strong>{query.trim()}</strong>
        </p>
      )}
      <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage / strength" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
      <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="# Quantity (e.g. 30, 1 box)" className="w-full rounded-lg border border-outline-variant px-md py-sm" />

      {/* §16.8 Form 1 — before/after meals */}
      <div>
        <p className="mb-xs text-label-sm text-on-surface-variant">Meals</p>
        <div className="grid grid-cols-2 gap-sm">
          {(["Before", "After"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMealRelation((prev) => (prev === option ? null : option))}
              aria-pressed={mealRelation === option}
              className={cn(
                "rounded-lg border px-md py-sm text-label-md",
                mealRelation === option ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* §16.8 Form 1 — Breakfast / Lunch / Dinner / Bedtime (multiple) */}
      <div>
        <p className="mb-xs text-label-sm text-on-surface-variant">Timing</p>
        <div className="grid grid-cols-4 gap-sm">
          {TIMING_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => toggleSlot(slot)}
              aria-pressed={timingSlots.includes(slot)}
              className={cn(
                "rounded-lg border px-xs py-sm text-label-sm",
                timingSlots.includes(slot) ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
              )}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* §16.8 Form 1 — DURATION: Maintain | ___ Days | ___ Weeks */}
      <div>
        <p className="mb-xs text-label-sm text-on-surface-variant">Duration</p>
        <div className="flex flex-wrap items-center gap-sm">
          {(["Maintain", "Days", "Weeks"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDurationKind((prev) => (prev === k ? null : k))}
              aria-pressed={durationKind === k}
              className={cn(
                "rounded-lg border px-md py-sm text-label-md",
                durationKind === k ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
              )}
            >
              {k}
            </button>
          ))}
          {(durationKind === "Days" || durationKind === "Weeks") && (
            <input
              type="number"
              min={1}
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              placeholder={`# ${durationKind.toLowerCase()}`}
              className="w-28 rounded-lg border border-outline-variant px-md py-sm text-body-md"
            />
          )}
        </div>
      </div>

      <input
        value={indication}
        onChange={(e) => setIndication(e.target.value)}
        placeholder="Indication (e.g. for fever, for cough)"
        className="w-full rounded-lg border border-outline-variant px-md py-sm"
      />
      <div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value.slice(0, 200))}
          placeholder="Sig. / extra instructions (optional)"
          rows={2}
          className="w-full rounded-lg border border-outline-variant p-md"
        />
        <p className="mt-xs text-right text-label-sm text-on-surface-variant">{instructions.length}/200</p>
      </div>
      <label className="flex items-center gap-sm text-label-md text-on-surface-variant">
        <input type="checkbox" checked={addToFavorites} onChange={(e) => setAddToFavorites(e.target.checked)} className="h-4 w-4" />
        Add to Favorites
      </label>
      <Button variant="secondary" onClick={handleAdd} disabled={!canAdd} className="w-full">
        Add Item
      </Button>
    </div>
  );
}

interface FavoritesTabProps {
  favorites: { id: string; item: PrescriptionLineItem }[];
  onAdd: (item: PrescriptionLineItem) => void;
}

function FavoritesTab({ favorites, onAdd }: FavoritesTabProps) {
  const [search, setSearch] = useState("");
  const filtered = favorites.filter((f) => f.item.genericName.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-sm">
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Favorite" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
      {filtered.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No favorites yet.</p>
      ) : (
        filtered.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onAdd(f.item)}
            className="block w-full rounded-lg border border-outline-variant p-md text-left text-body-md hover:bg-surface-container-low"
          >
            {f.item.genericName}
          </button>
        ))
      )}
    </div>
  );
}

interface TemplatesTabProps {
  templates: PrescriptionTemplate[];
  onAddAll: (template: PrescriptionTemplate) => void;
  onAddNew: () => void;
  onEdit: (template: PrescriptionTemplate) => void;
  onDelete: (template: PrescriptionTemplate) => void;
}

function TemplatesTab({ templates, onAddAll, onAddNew, onEdit, onDelete }: TemplatesTabProps) {
  const [search, setSearch] = useState("");
  const filtered = templates.filter((t) => (t.title ?? "").toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-sm">
      <Button onClick={onAddNew} className="w-full">
        <Icon name="add_circle" className="text-[16px]" />
        Add Template
      </Button>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Templates" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
      {filtered.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No templates yet.</p>
      ) : (
        filtered.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-outline-variant p-md">
            <button type="button" onClick={() => onAddAll(t)} className="text-left text-body-md text-on-surface hover:underline">
              {t.title}
            </button>
            {!t.isSystemTemplate && (
              <div className="flex items-center gap-sm">
                <button type="button" onClick={() => onEdit(t)} aria-label="Edit template" className="text-on-surface-variant">
                  <Icon name="edit" className="text-[16px]" />
                </button>
                <button type="button" onClick={() => onDelete(t)} aria-label="Delete template" className="text-error">
                  <Icon name="delete" className="text-[16px]" />
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

const RX_TABS = [
  { id: "new", label: "New Prescription" },
  { id: "favorites", label: "Favorites" },
  { id: "templates", label: "Templates" },
];

interface TemplateModalProps {
  isOpen: boolean;
  template: PrescriptionTemplate | null; // null = creating a new one
  medicines: Medicine[];
  favorites: { id: string; item: PrescriptionLineItem }[];
  onClose: () => void;
  onSave: (title: string, items: PrescriptionLineItem[]) => void | Promise<void>;
}

function TemplateModal({ isOpen, template, medicines, favorites, onClose, onSave }: TemplateModalProps) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [items, setItems] = useState<PrescriptionLineItem[]>(template?.items ?? []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<PrescriptionLineItem | null>(null);
  const [tab, setTab] = useState("new");

  const originalSnapshot = JSON.stringify({ title: template?.title ?? "", items: template?.items ?? [] });
  const currentSnapshot = JSON.stringify({ title, items });
  const canSave = title.trim() !== "" && items.length > 0 && currentSnapshot !== originalSnapshot;

  function addItem(item: Omit<PrescriptionLineItem, "id">) {
    setItems((prev) => [...prev, { ...item, id: newId("tpli") }]);
  }

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={template ? "Edit Template" : "Add Template"}>
      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <div className="space-y-md">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Template Title" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
          <LineItemList
            items={items}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
            onToggleSelectAll={() => setSelectedIds(selectedIds.length === items.length ? [] : items.map((i) => i.id))}
            onBulkDelete={() => {
              setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
              setSelectedIds([]);
            }}
            onEdit={setEditingItem}
          />
        </div>
        <div>
          <Tabs tabs={RX_TABS.slice(0, 2)} activeId={tab} onChange={setTab} className="mb-md" />
          {tab === "new" && <NewRxTab medicines={medicines} onAdd={(item) => addItem(item)} />}
          {tab === "favorites" && <FavoritesTab favorites={favorites} onAdd={(item) => addItem(item)} />}
        </div>
      </div>
      <div className="mt-lg flex justify-end">
        <Button onClick={() => onSave(title, items)} disabled={!canSave}>
          Save
        </Button>
      </div>
      <EditLineItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(updated) => {
          setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          setEditingItem(null);
        }}
      />
    </Modal>
  );
}

export interface PrescriptionFormProps {
  mode: "create" | "edit";
  patientId: string;
  doctorId: string;
  bookingId?: string; // required on create; carried over from the existing group on edit
  group?: PrescriptionGroup; // when editing
  copyFromGroup?: PrescriptionGroup; // when creating via copy
  /**
   * Renders inline within the consultation page's Prescription section
   * instead of as its own page — no outer heading/max-width, and saving
   * stays in place instead of redirecting to the patient's Prescriptions tab.
   */
  embedded?: boolean;
  /** Called after a successful save — used in embedded mode so the parent can re-key/remount this form with the freshly-saved group. */
  onSaved?: () => void;
}

// Shared by .../prescriptions/create, .../prescriptions/[prescriptionId], and
// the consultation page's Prescription section (embedded) —
// clinic-prescriptions-fe.md §2's two-column create/edit layout, following
// the same create/edit-sharing pattern as DoctorForm.tsx.
export function PrescriptionForm({ mode, patientId, doctorId, bookingId, group, copyFromGroup, embedded, onSaved }: PrescriptionFormProps) {
  const router = useRouter();
  const seedItems = group?.items ?? copyFromGroup?.items.map((i) => ({ ...i, id: newId("rxi") })) ?? [];

  const [items, setItems] = useState<PrescriptionLineItem[]>(seedItems);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<PrescriptionLineItem | null>(null);
  const [isAddToTemplate, setIsAddToTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [rxTab, setRxTab] = useState("new");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ key: number; variant: ToastVariant; message: string } | null>(null);
  const [favorites, setFavorites] = useState<{ id: string; item: PrescriptionLineItem }[]>([]);
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrescriptionTemplate | null>(null);
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState<PrescriptionTemplate | null>(null);
  // Rarely changes — fetch once per mount (Implementation-Phases/03-reference-clinic-data.md §3d).
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  function toTemplate(t: { template_id: string; doctor_id: string; title: string; is_system_template: boolean; prescription_template_items: DbTemplateItem[] }): PrescriptionTemplate {
    return {
      id: t.template_id,
      doctorId: t.doctor_id,
      title: t.title,
      isSystemTemplate: t.is_system_template,
      items: t.prescription_template_items.map((i) => ({
        id: i.id,
        rxId: i.medicine_id,
        genericName: i.generic_name,
        dosage: i.dosage,
        quantity: i.quantity,
        instruction: i.instruction ?? "",
        isControlledSubstance: i.is_controlled_substance,
      })),
    };
  }

  async function reloadFavoritesAndTemplates() {
    const supabase = null as never;
    const [favRes, tplRes] = await Promise.all([
      queryFavoriteMedicines(supabase, doctorId),
      queryRxTemplates(supabase, doctorId),
    ]);
    setFavorites(
      favRes.map((f) => ({
        id: f.id,
        item: { id: f.id, rxId: f.medicine_id, genericName: f.generic_name, dosage: f.dosage, quantity: f.quantity, instruction: f.instruction ?? "" },
      })),
    );
    setTemplates(tplRes.map((t) => toTemplate(t as Parameters<typeof toTemplate>[0])));
  }

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      const data = await queryMedicines(supabase);
      setMedicines(data.map((m) => ({ id: m.medicine_id, genericName: m.generic_name })));
      await reloadFavoritesAndTemplates();
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  const effectiveBookingId = group?.bookingId ?? bookingId ?? "";

  function showToast(variant: ToastVariant, message: string) {
    setToast({ key: Date.now(), variant, message });
  }

  function isDuplicate(genericName: string, dosage: string) {
    return items.some((i) => i.genericName === genericName && i.dosage === dosage);
  }

  function addLineItem(item: Omit<PrescriptionLineItem, "id">) {
    if (isDuplicate(item.genericName, item.dosage)) {
      showToast("error", "Item already exist.");
      return;
    }
    setItems((prev) => [...prev, { ...item, id: newId("rxi") }]);
  }

  async function handleNewRxAdd(item: Omit<PrescriptionLineItem, "id">, addToFavorites: boolean) {
    const wasDuplicate = isDuplicate(item.genericName, item.dosage);
    addLineItem(item);
    if (addToFavorites && !wasDuplicate) {
      const supabase = null as never;
      const data = await addFavoriteMedicine(supabase, doctorId, {
        medicine_id: item.rxId || "00000000-0000-0000-0000-000000000000",
        generic_name: item.genericName,
        dosage: item.dosage,
        quantity: item.quantity,
        instruction: item.instruction || null,
      });
      setFavorites((prev) => [
        ...prev,
        { id: data.id, item: { id: data.id, rxId: data.medicine_id, genericName: data.generic_name, dosage: data.dosage, quantity: data.quantity, instruction: data.instruction ?? "" } },
      ]);
    }
  }

  function handleTemplateAddAll(template: PrescriptionTemplate) {
    template.items.forEach((item) => {
      if (!isDuplicate(item.genericName, item.dosage)) {
        setItems((prev) => [...prev, { ...item, id: newId("rxi") }]);
      }
    });
  }

  function handleSaveClick() {
    if (items.length === 0) {
      showToast("error", "Select Prescriptions to continue this process!");
      return;
    }
    if (isAddToTemplate && templateTitle.trim() === "") {
      showToast("error", "Template title required!");
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmSave() {
    setSaving(true);
    try {
      const supabase = null as never;
      await upsertRxGroupByBooking(supabase, effectiveBookingId, {
        patient_id: patientId,
        doctor_id: doctorId,
        items: items.map((i) => ({
          medicine_id: i.rxId || "00000000-0000-0000-0000-000000000000",
          generic_name: i.genericName,
          dosage: i.dosage,
          quantity: i.quantity,
          instruction: i.instruction || null,
          is_controlled_substance: i.isControlledSubstance ?? false,
          // §16.8 Form 1 structured columns.
          meal_relation: i.mealRelation ?? null,
          timing: i.timing ?? null,
          duration_kind: i.durationKind ?? null,
          duration_value: i.durationValue ?? null,
          indication: i.indication ?? null,
        })),
      });

      // 8d: "Add to Template" writes prescription_templates + its items
      // alongside the group/line-items write — a separate, additional insert,
      // not a substitute for the Templates tab's own Add/Edit modal.
      if (isAddToTemplate) {
        await createRxTemplate(supabase, doctorId, {
          title: templateTitle.trim(),
          is_system_template: false,
          items: items.map((i) => ({
            medicine_id: i.rxId || "00000000-0000-0000-0000-000000000000",
            generic_name: i.genericName,
            dosage: i.dosage,
            quantity: i.quantity,
            instruction: i.instruction || null,
            is_controlled_substance: i.isControlledSubstance ?? false,
          })),
        });
      }

      setConfirmOpen(false);
      if (embedded) {
        onSaved?.();
      } else {
        router.push(`/doctor/patients/${patientId}?bookingId=${effectiveBookingId}&tab=prescriptions`);
      }
    } catch {
      showToast("error", "Could not save the prescription. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn(!embedded && "mx-auto max-w-[64rem]", "space-y-lg")}>
      {toast && <Toast key={toast.key} variant={toast.variant} message={toast.message} />}

      {!embedded && <h1 className="text-headline-md text-on-surface">Prescriptions</h1>}

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <Card className="space-y-md">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">Add to Template</span>
            <button
              type="button"
              onClick={() => setIsAddToTemplate((v) => !v)}
              className={cn("h-6 w-11 rounded-full p-1 transition-colors", isAddToTemplate ? "bg-primary" : "bg-surface-container-high")}
              aria-pressed={isAddToTemplate}
            >
              <span className={cn("block h-4 w-4 rounded-full bg-white transition-transform", isAddToTemplate && "translate-x-5")} />
            </button>
          </div>
          {isAddToTemplate && (
            <input
              value={templateTitle}
              onChange={(e) => setTemplateTitle(e.target.value)}
              placeholder="Template Title"
              className="w-full rounded-lg border border-outline-variant px-md py-sm"
            />
          )}
          <LineItemList
            items={items}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
            onToggleSelectAll={() => setSelectedIds(selectedIds.length === items.length ? [] : items.map((i) => i.id))}
            onBulkDelete={() => {
              setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
              setSelectedIds([]);
            }}
            onEdit={setEditingItem}
          />
        </Card>

        <Card>
          <Tabs tabs={RX_TABS} activeId={rxTab} onChange={setRxTab} className="mb-md" />
          {rxTab === "new" && <NewRxTab medicines={medicines} onAdd={handleNewRxAdd} />}
          {rxTab === "favorites" && <FavoritesTab favorites={favorites} onAdd={addLineItem} />}
          {rxTab === "templates" && (
            <TemplatesTab
              templates={templates}
              onAddAll={handleTemplateAddAll}
              onAddNew={() => {
                setEditingTemplate(null);
                setTemplateModalOpen(true);
              }}
              onEdit={(t) => {
                setEditingTemplate(t);
                setTemplateModalOpen(true);
              }}
              onDelete={(t) => setTemplateDeleteTarget(t)}
            />
          )}
        </Card>
      </div>

      {/* Save sits at the bottom-right of the section's content, matching
          every other consultation section (Diagnosis/Lab Orders/Vitals/…)
          instead of floating in its own header row up top. */}
      <div className="flex justify-end border-t border-outline-variant pt-md">
        <Button loading={saving} onClick={handleSaveClick}>
          <Icon name="check" className="text-[16px]" />
          Save
        </Button>
      </div>

      <EditLineItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={(updated) => {
          setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          setEditingItem(null);
        }}
      />

      <TemplateModal
        isOpen={templateModalOpen}
        template={editingTemplate}
        medicines={medicines}
        favorites={favorites}
        onClose={() => setTemplateModalOpen(false)}
        onSave={async (title, tplItems) => {
          const supabase = null as never;
          const items = tplItems.map((i) => ({
            medicine_id: i.rxId || "00000000-0000-0000-0000-000000000000",
            generic_name: i.genericName,
            dosage: i.dosage,
            quantity: i.quantity,
            instruction: i.instruction || null,
            is_controlled_substance: i.isControlledSubstance ?? false,
          }));
          if (editingTemplate) {
            await updateRxTemplate(supabase, editingTemplate.id, doctorId, { title, is_system_template: false, items });
          } else {
            await createRxTemplate(supabase, doctorId, { title, is_system_template: false, items });
          }
          await reloadFavoritesAndTemplates();
          setTemplateModalOpen(false);
        }}
      />

      <Modal
        isOpen={templateDeleteTarget !== null}
        onClose={() => setTemplateDeleteTarget(null)}
        title="Delete Template?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTemplateDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const supabase = null as never;
                await deleteRxTemplate(supabase, templateDeleteTarget!.id);
                setTemplates((prev) => prev.filter((t) => t.id !== templateDeleteTarget!.id));
                setTemplateDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">Are you sure you want to delete this template?</p>
      </Modal>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Prescription"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setConfirmOpen(false)}>
              Go Back
            </Button>
            <Button loading={saving} onClick={confirmSave}>Confirm &amp; Save</Button>
          </>
        }
      >
        <ul className="space-y-xs text-body-md">
          {items.map((item, i) => (
            <li key={item.id} className="text-on-surface">
              {i + 1}. {item.genericName} {item.dosage} — #{item.quantity}
              {item.instruction ? <span className="text-on-surface-variant"> · {item.instruction}</span> : null}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
