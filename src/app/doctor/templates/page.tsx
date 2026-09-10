"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toast } from "@/components/ui/Toast";
import {
  queryDiagnosisTemplates,
  createDiagnosisTemplate,
  updateDiagnosisTemplate,
  deleteDiagnosisTemplate,
  type DiagnosisTemplateRow,
} from "@/lib/data/clinical";

// Doctor's reusable free-text diagnoses. Picked into the consultation
// Diagnosis section; this screen is the "easy edit" surface (§16.8).
export default function DoctorTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DiagnosisTemplateRow[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // add-row state
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);

  // inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setRows(await queryDiagnosisTemplates());
      } catch {
        setError("Could not load your templates.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function add() {
    if (!newLabel.trim() || !newBody.trim()) return;
    setAdding(true);
    setError("");
    try {
      const created = await createDiagnosisTemplate(null as never, {
        label: newLabel.trim(),
        body: newBody.trim(),
      });
      setRows((prev) => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
      setNewLabel("");
      setNewBody("");
      setToast("Template added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the template.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(r: DiagnosisTemplateRow) {
    setEditingId(r.id);
    setEditLabel(r.label);
    setEditBody(r.body);
    setError("");
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim() || !editBody.trim()) return;
    setSavingId(id);
    setError("");
    try {
      const updated = await updateDiagnosisTemplate(null as never, id, {
        label: editLabel.trim(),
        body: editBody.trim(),
      });
      setRows((prev) =>
        prev.map((r) => (r.id === id ? updated : r)).sort((a, b) => a.label.localeCompare(b.label)),
      );
      setEditingId(null);
      setToast("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the template.");
    } finally {
      setSavingId(null);
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await deleteDiagnosisTemplate(null as never, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (editingId === id) setEditingId(null);
      setToast("Template deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the template.");
    }
  }

  return (
    <AppShell role="doctor">
      <div className="mx-auto max-w-[44rem] space-y-lg">
        <div>
          <h1 className="text-headline-lg text-on-surface">Diagnosis Templates</h1>
          <p className="mt-xs text-body-md text-on-surface-variant">
            Your reusable diagnoses. Pick them from the <strong>Diagnosis</strong> step of a
            consultation instead of retyping — this is where you add and edit them.
          </p>
        </div>

        {toast && <Toast key={toast} variant="success" message={toast} />}
        {error && (
          <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>
        )}

        <Card>
          <h2 className="mb-sm text-headline-sm text-on-surface">Add a template</h2>
          <div className="space-y-sm">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Short label (e.g. URTI)"
              className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
            />
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Diagnosis text as it should appear on the record"
              rows={2}
              className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
            />
            <Button onClick={add} disabled={adding || !newLabel.trim() || !newBody.trim()}>
              {adding ? "Adding…" : "Add template"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-md text-headline-sm text-on-surface">
            Your templates {rows.length > 0 && <span className="text-label-md text-on-surface-variant">({rows.length})</span>}
          </h2>

          {loading ? (
            <p className="text-body-md text-on-surface-variant">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-body-md text-on-surface-variant">No templates yet. Add one above.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {rows.map((r) => (
                <li key={r.id} className="py-md">
                  {editingId === r.id ? (
                    <div className="space-y-sm">
                      <input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
                      />
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
                      />
                      <div className="flex gap-sm">
                        <Button
                          onClick={() => saveEdit(r.id)}
                          disabled={savingId === r.id || !editLabel.trim() || !editBody.trim()}
                        >
                          {savingId === r.id ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)} disabled={savingId === r.id}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-md">
                      <div className="min-w-0">
                        <p className="text-body-md font-medium text-on-surface">{r.label}</p>
                        <p className="text-body-sm text-on-surface-variant">{r.body}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-xs">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          aria-label={`Edit ${r.label}`}
                          className="rounded-md p-xs text-on-surface-variant hover:bg-surface-container-high"
                        >
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          aria-label={`Delete ${r.label}`}
                          className="rounded-md p-xs text-on-surface-variant hover:bg-surface-container-high"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
