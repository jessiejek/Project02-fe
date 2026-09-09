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
import { createClient } from "@/lib/supabase/client";
import { queryMedicines } from "@/lib/data/lookups";
import type { PrescriptionLineItem, PrescriptionGroup, PrescriptionTemplate, Medicine } from "@/data/types";
import type { Database } from "@/data/supabase-types";

type DbTemplateItem = Database["public"]["Tables"]["prescription_template_items"]["Row"];

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function sig(item: PrescriptionLineItem) {
  return `Sig. ${item.dosage} ${item.instruction}`.trim();
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
              <div>
                <p className="text-body-md font-medium text-on-surface">
                  {item.genericName} #{item.quantity}
                </p>
                <p className="text-label-md text-on-surface-variant">{sig(item)}</p>
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
        <Button onClick={() => onSave({ ...item, genericName, dosage, quantity, instruction })} disabled={!genericName.trim() || !dosage.trim()}>
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

function NewRxTab({ medicines, onAdd }: NewRxTabProps) {
  const [query, setQuery] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [dosage, setDosage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [mealTiming, setMealTiming] = useState<"Before Meal" | "After Meal" | null>(null);
  const [instructions, setInstructions] = useState("");
  const [addToFavorites, setAddToFavorites] = useState(false);

  const matches = query.length >= 3 && !selectedMedicine ? medicines.filter((m) => m.genericName.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  const canAdd = selectedMedicine !== null && dosage.trim() !== "" && quantity.trim() !== "";

  function reset() {
    setQuery("");
    setSelectedMedicine(null);
    setDosage("");
    setQuantity("");
    setMealTiming(null);
    setInstructions("");
    setAddToFavorites(false);
  }

  function handleAdd() {
    if (!selectedMedicine || !canAdd) return;
    const instruction = `${mealTiming ?? ""} ${instructions}`.trim();
    onAdd({ rxId: selectedMedicine.id, genericName: selectedMedicine.genericName, dosage, quantity, instruction }, addToFavorites);
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
          placeholder="Search medication (type 3+ chars)"
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
      <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
      <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity (e.g. 50pcs)" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
      <div className="grid grid-cols-2 gap-sm">
        {(["Before Meal", "After Meal"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMealTiming((prev) => (prev === option ? null : option))}
            aria-pressed={mealTiming === option}
            className={cn(
              "rounded-lg border px-md py-sm text-label-md",
              mealTiming === option ? "border-primary bg-primary/10 text-primary" : "border-outline-variant text-on-surface-variant",
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value.slice(0, 200))}
          placeholder="Instructions (optional)"
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
    const supabase = createClient();
    const [favRes, tplRes] = await Promise.all([
      supabase.from("doctor_favorite_medicines").select("*").eq("doctor_id", doctorId),
      supabase.from("prescription_templates").select("*, prescription_template_items(*)").or(`doctor_id.eq.${doctorId},is_system_template.eq.true`),
    ]);
    setFavorites(
      (favRes.data ?? []).map((f) => ({
        id: f.id,
        item: { id: f.id, rxId: f.medicine_id, genericName: f.generic_name, dosage: f.dosage, quantity: f.quantity, instruction: f.instruction ?? "" },
      })),
    );
    setTemplates((tplRes.data ?? []).map(toTemplate));
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
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
      const supabase = createClient();
      const { data } = await supabase
        .from("doctor_favorite_medicines")
        .insert({ doctor_id: doctorId, medicine_id: item.rxId, generic_name: item.genericName, dosage: item.dosage, quantity: item.quantity, instruction: item.instruction || null })
        .select()
        .single();
      if (data) {
        setFavorites((prev) => [
          ...prev,
          { id: data.id, item: { id: data.id, rxId: data.medicine_id, genericName: data.generic_name, dosage: data.dosage, quantity: data.quantity, instruction: data.instruction ?? "" } },
        ]);
      }
    }
  }

  function handleTemplateAddAll(template: PrescriptionTemplate) {
    template.items.forEach((item) => {
      if (!isDuplicate(item.genericName, item.dosage)) {
        setItems((prev) => [...prev, { ...item, id: newId("rxi") }]);
      }
    });
  }

  async function handleSave() {
    if (items.length === 0) {
      showToast("error", "Select Prescriptions to continue this process!");
      return;
    }
    if (isAddToTemplate && templateTitle.trim() === "") {
      showToast("error", "Template title required!");
      return;
    }

    const supabase = createClient();
    let groupId: string;
    if (mode === "edit" && group) {
      groupId = group.id;
      await supabase.from("prescription_groups").update({ updated_at: new Date().toISOString() }).eq("group_id", groupId);
      await supabase.from("prescription_line_items").delete().eq("group_id", groupId);
    } else {
      const { data, error } = await supabase
        .from("prescription_groups")
        .insert({ patient_id: patientId, doctor_id: doctorId, booking_id: effectiveBookingId })
        .select()
        .single();
      if (error || !data) return;
      groupId = data.group_id;
    }
    await supabase.from("prescription_line_items").insert(
      items.map((i) => ({
        group_id: groupId,
        medicine_id: i.rxId,
        generic_name: i.genericName,
        dosage: i.dosage,
        quantity: i.quantity,
        instruction: i.instruction || null,
        is_controlled_substance: i.isControlledSubstance ?? false,
      })),
    );

    // 8d: "Add to Template" writes prescription_templates + its items
    // alongside the group/line-items write — a separate, additional insert,
    // not a substitute for the Templates tab's own Add/Edit modal.
    if (isAddToTemplate) {
      const { data: tplData } = await supabase
        .from("prescription_templates")
        .insert({ doctor_id: doctorId, title: templateTitle.trim() })
        .select()
        .single();
      if (tplData) {
        await supabase.from("prescription_template_items").insert(
          items.map((i) => ({
            template_id: tplData.template_id,
            medicine_id: i.rxId,
            generic_name: i.genericName,
            dosage: i.dosage,
            quantity: i.quantity,
            instruction: i.instruction || null,
            is_controlled_substance: i.isControlledSubstance ?? false,
          })),
        );
      }
    }

    if (embedded) {
      onSaved?.();
    } else {
      router.push(`/doctor/patients/${patientId}?bookingId=${effectiveBookingId}&tab=prescriptions`);
    }
  }

  return (
    <div className={cn(!embedded && "mx-auto max-w-[64rem]", "space-y-lg")}>
      {toast && <Toast key={toast.key} variant={toast.variant} message={toast.message} />}

      <div className="flex items-center justify-between">
        {!embedded && <h1 className="text-headline-md text-on-surface">Prescriptions</h1>}
        <Button onClick={handleSave} className={cn(embedded && "ml-auto")}>
          <Icon name="check" className="text-[16px]" />
          Save
        </Button>
      </div>

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
          const supabase = createClient();
          if (editingTemplate) {
            await supabase.from("prescription_templates").update({ title }).eq("template_id", editingTemplate.id);
            await supabase.from("prescription_template_items").delete().eq("template_id", editingTemplate.id);
            await supabase.from("prescription_template_items").insert(
              tplItems.map((i) => ({
                template_id: editingTemplate.id,
                medicine_id: i.rxId,
                generic_name: i.genericName,
                dosage: i.dosage,
                quantity: i.quantity,
                instruction: i.instruction || null,
                is_controlled_substance: i.isControlledSubstance ?? false,
              })),
            );
          } else {
            const { data: tplData } = await supabase.from("prescription_templates").insert({ doctor_id: doctorId, title }).select().single();
            if (tplData) {
              await supabase.from("prescription_template_items").insert(
                tplItems.map((i) => ({
                  template_id: tplData.template_id,
                  medicine_id: i.rxId,
                  generic_name: i.genericName,
                  dosage: i.dosage,
                  quantity: i.quantity,
                  instruction: i.instruction || null,
                  is_controlled_substance: i.isControlledSubstance ?? false,
                })),
              );
            }
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
                const supabase = createClient();
                await supabase.from("prescription_templates").delete().eq("template_id", templateDeleteTarget!.id);
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
    </div>
  );
}
