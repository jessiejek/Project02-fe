"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * Friendly CRUD list for one kind of doctor template. Built for a non-technical
 * user: text buttons (no icon-only actions), inline edit (no modal to get lost
 * in), a two-step "are you sure" for delete, big touch targets.
 *
 * Generic over the row type T and a plain draft object D that the form edits.
 */
export interface TemplateManagerProps<T, D> {
  title: string;
  /** One or two plain sentences: what this is and where it shows up. */
  description: string;
  itemNoun: string; // e.g. "diagnosis", "phrase" — used in button labels
  items: T[];
  getId: (item: T) => string;
  /** Read-only display of a saved item. */
  renderSummary: (item: T) => ReactNode;
  /** A blank draft for "Add new". */
  emptyDraft: D;
  /** Fill a draft from an existing item for "Edit". */
  toDraft: (item: T) => D;
  /** The editable fields. Called with the current draft and a setter. */
  renderForm: (draft: D, setDraft: (d: D) => void) => ReactNode;
  /** True when the draft is complete enough to save. */
  isValid: (draft: D) => boolean;
  onCreate: (draft: D) => Promise<void>;
  onUpdate: (id: string, draft: D) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TemplateManager<T, D>({
  title,
  description,
  itemNoun,
  items,
  getId,
  renderSummary,
  emptyDraft,
  toDraft,
  renderForm,
  isValid,
  onCreate,
  onUpdate,
  onDelete,
}: TemplateManagerProps<T, D>) {
  const [mode, setMode] = useState<{ kind: "idle" } | { kind: "adding" } | { kind: "editing"; id: string }>({ kind: "idle" });
  const [draft, setDraft] = useState<D>(emptyDraft);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  }

  function startAdd() {
    setError("");
    setDraft(emptyDraft);
    setMode({ kind: "adding" });
  }
  function startEdit(item: T) {
    setError("");
    setDraft(toDraft(item));
    setMode({ kind: "editing", id: getId(item) });
  }
  function cancel() {
    setMode({ kind: "idle" });
    setError("");
  }

  async function save() {
    if (!isValid(draft) || busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode.kind === "adding") {
        await onCreate(draft);
        flash("Added.");
      } else if (mode.kind === "editing") {
        await onUpdate(mode.id, draft);
        flash("Saved.");
      }
      setMode({ kind: "idle" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onDelete(id);
      flash("Deleted.");
      setConfirmingDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-md">
      <div>
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
        <p className="mt-xs text-body-md text-on-surface-variant">{description}</p>
      </div>

      {notice && (
        <p className="rounded-lg bg-green-50 px-md py-sm text-body-md text-green-800">{notice}</p>
      )}
      {error && (
        <p className="rounded-lg bg-error-container px-md py-sm text-body-md text-on-error-container">{error}</p>
      )}

      {items.length === 0 && mode.kind !== "adding" && (
        <p className="text-body-md text-on-surface-variant">Nothing saved yet.</p>
      )}

      <ul className="space-y-sm">
        {items.map((item) => {
          const id = getId(item);
          const editing = mode.kind === "editing" && mode.id === id;
          const confirming = confirmingDeleteId === id;
          return (
            <li key={id} className="rounded-xl border border-outline-variant p-md">
              {editing ? (
                <div className="space-y-md">
                  {renderForm(draft, setDraft)}
                  <div className="flex flex-wrap gap-sm">
                    <Button onClick={save} disabled={busy || !isValid(draft)}>
                      {busy ? "Saving…" : "Save changes"}
                    </Button>
                    <Button variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-sm">
                  <div className="text-body-lg text-on-surface">{renderSummary(item)}</div>
                  {confirming ? (
                    <div className="flex flex-wrap items-center gap-sm rounded-lg bg-error-container/40 p-sm">
                      <span className="text-body-md text-on-surface">Delete this {itemNoun} permanently?</span>
                      <Button variant="danger" onClick={() => confirmDelete(id)} disabled={busy}>
                        {busy ? "Deleting…" : "Yes, delete"}
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmingDeleteId(null)} disabled={busy}>
                        Keep it
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-sm">
                      <Button variant="secondary" onClick={() => startEdit(item)} disabled={mode.kind !== "idle"}>
                        Edit
                      </Button>
                      <Button variant="secondary" onClick={() => setConfirmingDeleteId(id)} disabled={mode.kind !== "idle"}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {mode.kind === "adding" ? (
        <div className="rounded-xl border-2 border-dashed border-outline-variant p-md space-y-md">
          <p className="text-body-md font-medium text-on-surface">New {itemNoun}</p>
          {renderForm(draft, setDraft)}
          <div className="flex flex-wrap gap-sm">
            <Button onClick={save} disabled={busy || !isValid(draft)}>{busy ? "Adding…" : "Add"}</Button>
            <Button variant="secondary" onClick={cancel} disabled={busy}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={startAdd} disabled={mode.kind !== "idle"} className="w-full sm:w-auto">
          + Add a new {itemNoun}
        </Button>
      )}
    </Card>
  );
}
