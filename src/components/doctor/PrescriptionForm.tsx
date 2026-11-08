"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { queryClinicSettings } from "@/lib/data/admin";
import { queryDoctorById } from "@/lib/data/doctors";
import { queryPatientById } from "@/lib/data/patients";
import { printPrescription } from "@/lib/print-forms";
import type { PrescriptionLineItem, PrescriptionGroup, PrescriptionTemplate, Medicine } from "@/data/types";
import type { Database } from "@/data/supabase-types";
import { checkDrugSafety } from "@/lib/clinical/drug-safety";
import { mgPerKgDose, mlFromConcentration } from "@/lib/clinical/peds-dosing";

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

//JJQR - AI (Oct 31, 2026) — print-ready sig checks
function instructionHasFrequencyLike(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(bd|bid|tid|qid|qd|q\d+h|daily|every|\d+\s*x|\d+x|times?\s*(a|per)\s*day|once|twice|thrice|hourly|weekly|prn)\b/.test(t);
}
function instructionHasDurationLike(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(day|days|week|weeks|month|months|ongoing|maintenance|maintain)\b/.test(t);
}
export function itemPrintSigComplete(item: PrescriptionLineItem): boolean {
  if (!item.dosage?.trim()) return false;
  if (!item.route?.trim()) return false;
  const hasFreq = !!(item.timing?.trim()) || instructionHasFrequencyLike(item.instruction ?? "");
  if (!hasFreq) return false;
  return (
    item.durationKind === "Maintain" ||
    ((item.durationKind === "Days" || item.durationKind === "Weeks") && !!item.durationValue) ||
    instructionHasDurationLike(item.instruction ?? "")
  );
}
//JJQR - END

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

// Same field set as NewRxTab (§16.8 Form 1's Rx-pad columns) — editing a line
// item used to only expose Medication/Dosage/Quantity/Instructions, silently
// dropping the meal/timing/duration/indication it was added with.
function EditLineItemModal({ item, onClose, onSave }: EditLineItemModalProps) {
  const [genericName, setGenericName] = useState(item?.genericName ?? "");
  const [dosage, setDosage] = useState(item?.dosage ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? "");
  const [mealRelation, setMealRelation] = useState<"Before" | "After" | null>(item?.mealRelation ?? null);
  const [timingSlots, setTimingSlots] = useState<string[]>(
    item?.timing ? item.timing.split(",").map((s) => s.trim()).filter(Boolean) : [],
  );
  const [durationKind, setDurationKind] = useState<"Maintain" | "Days" | "Weeks" | null>(item?.durationKind ?? null);
  const [durationValue, setDurationValue] = useState(item?.durationValue ? String(item.durationValue) : "");
  const [indication, setIndication] = useState(item?.indication ?? "");
  const [instruction, setInstruction] = useState(item?.instruction ?? "");

  if (!item) return null;

  function toggleSlot(slot: string) {
    setTimingSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  }

  function handleSave() {
    onSave({
      ...item!,
      genericName,
      dosage,
      quantity,
      mealRelation,
      timing: timingSlots.length ? timingSlots.join(", ") : null,
      durationKind,
      durationValue: durationKind === "Days" || durationKind === "Weeks" ? Number(durationValue) || null : null,
      indication: indication.trim() || null,
      instruction,
    });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Prescription"
      footer={
        <Button onClick={handleSave} disabled={!genericName.trim() || !quantity.trim()}>
          Save
        </Button>
      }
    >
      <div className="space-y-md">
        <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Medication</span><input value={genericName} onChange={(e) => setGenericName(e.target.value)} placeholder="Medication — pick from the list or just type it" className="w-full rounded-lg border border-outline-variant px-md py-sm" /></label>
        <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Dosage / strength</span><input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage / strength" className="w-full rounded-lg border border-outline-variant px-md py-sm" /></label>
        <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Quantity</span><input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="# Quantity (e.g. 30, 1 box)" className="w-full rounded-lg border border-outline-variant px-md py-sm" /></label>

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
            value={instruction}
            onChange={(e) => setInstruction(e.target.value.slice(0, 200))}
            placeholder="Sig. / extra instructions (optional)"
            rows={2}
            className="w-full rounded-lg border border-outline-variant p-md"
          />
          <p className="mt-xs text-right text-label-sm text-on-surface-variant">{instruction.length}/200</p>
        </div>
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
  //JJQR - AI (Oct 31, 2026)
  const [route, setRoute] = useState("PO");
  //JJQR - END

  const matches = query.length >= 3 && !selectedMedicine ? medicines.filter((m) => m.genericName.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  const effectiveGenericName = (selectedMedicine?.genericName ?? query).trim();
  const canAdd = effectiveGenericName !== "" && quantity.trim() !== "";
  //JJQR - AI (Oct 31, 2026) — F-014 catalog soft warning
  const showCatalogWarning = effectiveGenericName !== "" && !selectedMedicine && !medicines.some((m) => m.genericName.toLowerCase() === effectiveGenericName.toLowerCase());
  //JJQR - END

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
    setRoute("PO");
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
        //JJQR - AI (Oct 31, 2026)
        route: route.trim() || "PO",
        //JJQR - END
      },
      addToFavorites,
    );
    reset();
  }

  return (
    <div className="space-y-md">
      <div className="relative">
        <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Medication</span><input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedMedicine(null);
          }}
          placeholder="Medication — pick from the list or just type it"
          className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm"
        /></label>
        {/* JJQR - AI (Oct 31, 2026) */}
        {showCatalogWarning && (
          <p className="mt-xs text-label-sm text-status-warning">
            Not in catalog — prefer picking a generic from the list (RA 6675).
          </p>
        )}
        {/* JJQR - END */}
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
      <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Dosage / strength</span><input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage / strength" className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm" /></label>
      <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Quantity</span><input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="# Quantity (e.g. 30, 1 box)" className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm" /></label>
      {/* JJQR - AI (Oct 31, 2026) — F-008 route */}
      <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Route</span><input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Route (e.g. PO)" className="min-h-[44px] w-full rounded-lg border border-outline-variant px-md py-sm" /></label>
      {/* JJQR - END */}

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
      <input aria-label="Search Favorite" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Favorite" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
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
      <Button variant="secondary" onClick={onAddNew} className="w-full">
        <Icon name="add_circle" className="text-[16px]" />
        Add Template
      </Button>
      <input aria-label="Search Templates" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Templates" className="w-full rounded-lg border border-outline-variant px-md py-sm" />
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
      <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
        key={editingItem?.id ?? "closed"}
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
  patientName?: string;
  /** Called after a successful save — used in embedded mode so the parent can re-key/remount this form with the freshly-saved group. */
  onSaved?: () => void;
  //JJQR - AI (Oct 31, 2026)
  patientAllergies?: string[];
  allergyAckRequired?: boolean;
  allergyAcked?: boolean;
  onNeedAllergyAck?: () => void;
  priorRxItems?: PrescriptionLineItem[];
  patientPregnant?: boolean;
  patientAgeYears?: number | null;
  weightKg?: number | null;
  //JJQR - END
}

// Shared by .../prescriptions/create, .../prescriptions/[prescriptionId], and
// the consultation page's Prescription section (embedded) —
// clinic-prescriptions-fe.md §2's two-column create/edit layout, following
// the same create/edit-sharing pattern as DoctorForm.tsx.
export function PrescriptionForm({ mode, patientName, patientId, doctorId, bookingId, group, copyFromGroup, embedded, onSaved, patientAllergies, allergyAckRequired, allergyAcked, onNeedAllergyAck, priorRxItems, patientPregnant, patientAgeYears, weightKg }: PrescriptionFormProps) {
  const router = useRouter();
  const seedItems = group?.items ?? copyFromGroup?.items.map((i) => ({ ...i, id: newId("rxi") })) ?? [];

  const [items, setItems] = useState<PrescriptionLineItem[]>(seedItems);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<PrescriptionLineItem | null>(null);
  const [isAddToTemplate, setIsAddToTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [rxTab, setRxTab] = useState("new");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ key: number; variant: ToastVariant; message: string } | null>(null);
  const [favorites, setFavorites] = useState<{ id: string; item: PrescriptionLineItem }[]>([]);
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrescriptionTemplate | null>(null);
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState<PrescriptionTemplate | null>(null);
  // Rarely changes — fetch once per mount (Implementation-Phases/03-reference-clinic-data.md §3d).
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  //JJQR - AI (Oct 31, 2026)
  const [printSigError, setPrintSigError] = useState(false);
  const [pedsMgPerKg, setPedsMgPerKg] = useState("");
  const [pedsMaxMg, setPedsMaxMg] = useState("");
  const [pedsConcMgMl, setPedsConcMgMl] = useState("");
  const [pedsWeightInput, setPedsWeightInput] = useState("");
  const safetyToastRef = useRef("");
  //JJQR - END

  const safetyAlerts = useMemo(
    () =>
      checkDrugSafety(
        items.map((i) => i.genericName),
        { pregnant: patientPregnant },
      ),
    [items, patientPregnant],
  );

  function safetyForProspective(extraGeneric?: string) {
    const names = [...items.map((i) => i.genericName), ...(extraGeneric ? [extraGeneric] : [])];
    return checkDrugSafety(names, { pregnant: patientPregnant });
  }

  function applySafetyBeforeAdd(genericName: string): boolean {
    const alerts = safetyForProspective(genericName);
    const block = alerts.find((a) => a.level === "block");
    if (block) {
      showToast("error", block.message);
      return false;
    }
    const warn = alerts.find((a) => a.level === "warn");
    if (warn) showToast("warning", warn.message);
    return true;
  }

  function allergyBlockReason(genericName: string): string | null {
    if (!patientAllergies?.length) return null;
    const g = genericName.trim().toLowerCase();
    if (!g) return null;
    for (const raw of patientAllergies) {
      const al = raw.trim().toLowerCase();
      if (!al) continue;
      if (g.includes(al) || al.includes(g)) return raw.trim();
    }
    return null;
  }

  function requireAllergyAckBeforeAdd(): boolean {
    if (allergyAckRequired && !allergyAcked && items.length === 0) {
      onNeedAllergyAck?.();
      return false;
    }
    return true;
  }

  function reportAllergyConflict(genericName: string, allergen: string) {
    const message = `Allergy conflict: ${genericName} ↔ ${allergen}`;
    showToast("error", message);
  }

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

  useEffect(() => {
    const warns = safetyAlerts.filter((a) => a.level === "warn").map((a) => a.message);
    const key = warns.join("|");
    if (!key || key === safetyToastRef.current) return;
    safetyToastRef.current = key;
    showToast("warning", warns[0]);
  }, [safetyAlerts]);

  function isDuplicate(genericName: string, _dosage: string) {
    //JJQR - AI (Oct 31, 2026) — F-019: warn on same generic regardless of dose
    return items.some((i) => i.genericName.toLowerCase() === genericName.toLowerCase());
    //JJQR - END
  }

  function addLineItem(item: Omit<PrescriptionLineItem, "id">) {
    if (!requireAllergyAckBeforeAdd()) return;
    const blocked = allergyBlockReason(item.genericName);
    if (blocked) {
      reportAllergyConflict(item.genericName, blocked);
      return;
    }
    if (!applySafetyBeforeAdd(item.genericName)) return;
    if (isDuplicate(item.genericName, item.dosage)) {
      showToast("error", "Item already exist.");
      return;
    }
    setItems((prev) => [...prev, { ...item, id: newId("rxi") }]);
    setPrintSigError(false);
  }

  async function handleNewRxAdd(item: Omit<PrescriptionLineItem, "id">, addToFavorites: boolean) {
    if (!requireAllergyAckBeforeAdd()) return;
    const blocked = allergyBlockReason(item.genericName);
    if (blocked) {
      reportAllergyConflict(item.genericName, blocked);
      return;
    }
    if (!applySafetyBeforeAdd(item.genericName)) return;
    const wasDuplicate = isDuplicate(item.genericName, item.dosage);
    if (wasDuplicate) {
      showToast("error", "Item already exist.");
      return;
    }
    setItems((prev) => [...prev, { ...item, id: newId("rxi") }]);
    setPrintSigError(false);
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
    if (!requireAllergyAckBeforeAdd()) return;
    template.items.forEach((item) => {
      const blocked = allergyBlockReason(item.genericName);
      if (blocked) {
        reportAllergyConflict(item.genericName, blocked);
        return;
      }
      if (!applySafetyBeforeAdd(item.genericName)) return;
      if (!isDuplicate(item.genericName, item.dosage)) {
        setItems((prev) => [...prev, { ...item, id: newId("rxi"), route: item.route ?? "PO" }]);
      }
    });
    setPrintSigError(false);
  }

  function handleRefillLastVisit() {
    if (!priorRxItems?.length) return;
    if (!requireAllergyAckBeforeAdd()) return;
    const toAdd: PrescriptionLineItem[] = [];
    for (const item of priorRxItems) {
      const blocked = allergyBlockReason(item.genericName);
      if (blocked) {
        reportAllergyConflict(item.genericName, blocked);
        continue;
      }
      if (!applySafetyBeforeAdd(item.genericName)) continue;
      if (isDuplicate(item.genericName, item.dosage)) continue;
      toAdd.push({ ...item, id: newId("rxi") });
    }
    if (toAdd.length) {
      setItems((prev) => [...prev, ...toAdd]);
      setPrintSigError(false);
    }
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
          //JJQR - AI (Oct 31, 2026)
          route: i.route ?? null,
          //JJQR - END
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

  // Same letterhead form the patient portal prints from — the doctor
  // previously had no way to hand a patient a physical Rx from inside the
  // consultation at all, only Save.
  async function handlePrint() {
    if (items.length === 0) {
      showToast("error", "Select Prescriptions to continue this process!");
      return;
    }
    if (!items.every(itemPrintSigComplete)) {
      setPrintSigError(true);
      showToast("error", "Complete dose, route, frequency, and duration (sig) before printing.");
      return;
    }
    setPrintSigError(false);
    setPrinting(true);
    try {
      const supabase = null as never;
      const [clinic, doctor, patient] = await Promise.all([
        queryClinicSettings(supabase),
        queryDoctorById(supabase, doctorId),
        queryPatientById(supabase, patientId),
      ]);
      printPrescription({
        clinic: clinic
          ? { clinic_name: clinic.clinic_name, address: clinic.address, contact_number: clinic.contact_number }
          : { clinic_name: "Grace Medical Clinic", address: "", contact_number: null },
        doctor: {
          full_name: doctor?.staff_accounts?.full_name ?? "",
          license_number: doctor?.license_number ?? null,
          ptr_number: doctor?.ptr_number ?? null,
          //JJQR - AI (Oct 31, 2026)
          s2_number: doctor?.s2_number ?? null,
          //JJQR - END
        },
        patient: {
          full_name: patient ? `${patient.first_name} ${patient.last_name}`.trim() : "",
          patient_code: patient?.patient_code,
          date_of_birth: patient?.date_of_birth ?? null,
          sex: patient?.sex ?? null,
          address: patient?.address ?? null,
        },
        items: items.map((i) => ({
          generic_name: i.genericName,
          dosage: i.dosage,
          quantity: i.quantity,
          instruction: i.instruction,
          timing: i.timing,
          meal_relation: i.mealRelation,
          duration_kind: i.durationKind,
          duration_value: i.durationValue,
          indication: i.indication,
          is_controlled_substance: i.isControlledSubstance,
          //JJQR - AI (Oct 31, 2026)
          route: i.route ?? null,
          //JJQR - END
        })),
      });
    } finally {
      setPrinting(false);
    }
  }

  const printReady = items.length > 0 && items.every(itemPrintSigComplete);

  //JJQR - AI (Oct 31, 2026) — peds weight: override state or derive from weightKg
  const effectiveWeight =
    pedsWeightInput !== ""
      ? pedsWeightInput
      : weightKg != null && Number.isFinite(weightKg)
        ? String(weightKg)
        : "";
  //JJQR - END

  const pedsWeightNum = Number.parseFloat(effectiveWeight.replace(/[^\d.]/g, ""));
  const pedsMgPerKgNum = Number.parseFloat(pedsMgPerKg);
  const pedsMaxNum = pedsMaxMg.trim() ? Number.parseFloat(pedsMaxMg) : undefined;
  const pedsConcNum = Number.parseFloat(pedsConcMgMl);
  const pedsDose =
    Number.isFinite(pedsMgPerKgNum) && Number.isFinite(pedsWeightNum) && pedsWeightNum > 0
      ? mgPerKgDose(pedsMgPerKgNum, pedsWeightNum, pedsMaxNum)
      : null;
  const pedsMl =
    pedsDose && Number.isFinite(pedsConcNum) && pedsConcNum > 0
      ? mlFromConcentration(pedsDose.mg, pedsConcNum)
      : null;
  const showPedsHelper = patientAgeYears != null && patientAgeYears < 18;

  return (
    <div className={cn(!embedded && "mx-auto max-w-doctor-record", "space-y-lg")}>
      {toast && <Toast key={toast.key} variant={toast.variant} message={toast.message} />}

      {/* Top-right, same slot as every other consultation section's Save
          (SOAP's "Use Template…"/"Save as Template" row, etc.) — visible
          only while this section is open. */}
      <div className="flex flex-wrap items-start justify-between gap-lg">
        {!embedded && <div className="space-y-xs"><h1 className="text-balance text-headline-lg font-semibold text-on-surface">{mode === "edit" ? "Edit prescription" : "New prescription"}</h1>{patientName && <p className="text-body-md text-on-surface-variant">For {patientName}</p>}</div>}
        <div className={cn("flex items-center gap-sm", embedded && "ml-auto")}>
          {(!embedded || printReady) && <Button variant="secondary" loading={printing} disabled={!printReady} onClick={handlePrint}>
            <Icon name="print" className="text-[16px]" />
            Print
          </Button>}
          <Button variant={embedded ? "secondary" : "primary"} loading={saving} onClick={handleSaveClick}>
            <Icon name="check" className="text-[16px]" />
            {embedded ? "Save medications" : "Save prescription"}
          </Button>
        </div>
      </div>
      {printSigError && (
        <p className="text-label-md text-error">Complete dose, route, frequency, and duration (sig) before printing.</p>
      )}
      {safetyAlerts.length > 0 && (
        <ul className="space-y-xs rounded-lg border border-status-warning-border bg-status-warning-surface px-md py-sm text-label-sm text-status-warning">
          {safetyAlerts.map((a, idx) => (
            <li key={`${a.level}-${idx}`}>{a.message}</li>
          ))}
        </ul>
      )}
      {showPedsHelper && (
        <div className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-label-sm text-on-surface-variant">
          <p className="font-medium text-on-surface">Pediatric dose helper (mg/kg)</p>
          <div className="mt-sm grid grid-cols-2 gap-sm sm:grid-cols-4">
            <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Dose (mg/kg)</span><input
              placeholder="mg/kg"
              value={pedsMgPerKg}
              onChange={(e) => setPedsMgPerKg(e.target.value)}
              className="rounded-lg border border-outline-variant px-sm py-xs"
            /></label>
            {/* JJQR - AI (Oct 31, 2026) — effectiveWeight display */}
            <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Weight (kg)</span><input
              placeholder="Weight kg"
              value={effectiveWeight}
              onChange={(e) => setPedsWeightInput(e.target.value)}
              className="rounded-lg border border-outline-variant px-sm py-xs"
            /></label>
            {/* JJQR - END */}
            <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Maximum dose (mg, optional)</span><input
              placeholder="Max mg (opt)"
              value={pedsMaxMg}
              onChange={(e) => setPedsMaxMg(e.target.value)}
              className="rounded-lg border border-outline-variant px-sm py-xs"
            /></label>
            <label className="block min-w-0 space-y-xs"><span className="text-label-md font-medium text-on-surface">Concentration (mg/mL, optional)</span><input
              placeholder="mg/mL (opt)"
              value={pedsConcMgMl}
              onChange={(e) => setPedsConcMgMl(e.target.value)}
              className="rounded-lg border border-outline-variant px-sm py-xs"
            /></label>
          </div>
          {pedsDose && (
            <p className="mt-sm">
              ≈ {pedsDose.mg} mg{pedsDose.capped ? " (max cap applied)" : ""}
              {pedsMl != null ? ` · ≈ ${pedsMl} mL` : ""}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <Card className="space-y-lg">
          <h2 className="text-headline-sm font-semibold text-on-surface">Prescription items <span className="tabular-nums">({items.length})</span></h2>
          {/* JJQR - AI (Oct 31, 2026) */}
          {priorRxItems && priorRxItems.length > 0 && (
            <Button variant="secondary" className="w-full" onClick={handleRefillLastVisit}>
              Refill last visit Rx
            </Button>
          )}
          {/* JJQR - END */}
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">Add to Template</span>
            <button
              type="button"
              onClick={() => setIsAddToTemplate((v) => !v)}
              className={cn("h-6 w-11 rounded-full p-1 transition-colors", isAddToTemplate ? "bg-primary" : "bg-surface-container-high")}
              aria-label="Save these medications as a reusable template"
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
          <h2 className="mb-md text-headline-sm font-semibold text-on-surface">Add medication</h2>
          <Tabs tabs={RX_TABS} activeId={rxTab} onChange={setRxTab} className="mb-md" />
          {rxTab === "new" && <NewRxTab medicines={medicines} onAdd={handleNewRxAdd} />}
          {rxTab === "favorites" && (
            <FavoritesTab
              favorites={favorites}
              onAdd={(item) => {
                const { id: _omit, ...rest } = item;
                addLineItem(rest);
              }}
            />
          )}
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
        key={editingItem?.id ?? "closed"}
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
        <ul className="space-y-sm text-body-md">
          {items.map((item, i) => (
            <li key={item.id} className="rounded-lg border border-outline-variant p-sm text-on-surface">
              <p>
                {i + 1}. {item.genericName} {item.dosage} — #{item.quantity}
                {item.route ? <span className="text-on-surface-variant"> · {item.route}</span> : null}
              </p>
              {/* JJQR - AI (Oct 31, 2026) — F-018 stronger sig preview */}
              {directionsLine(item) && (
                <p className="text-label-md text-on-surface-variant">
                  Sig preview: {directionsLine(item)}
                </p>
              )}
              {/* JJQR - END */}
              {item.instruction ? <span className="text-on-surface-variant"> · {item.instruction}</span> : null}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
