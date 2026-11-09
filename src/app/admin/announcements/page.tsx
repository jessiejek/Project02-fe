"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { cn } from "@/lib/cn";
import { formatClinicDateShort } from "@/lib/format";
import { queryAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from "@/lib/data/admin";

const BLANK_FORM = { title: "", body: "", isActive: true };
interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  postedDate: string;
  isActive: boolean;
}

// Stitch announcements_management_admin — full CRUD, confirmed Admin-only
// writes per admin.md's resolved open question #3.
export default function AdminAnnouncementsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = null as never;
      setLoading(true);
      try {
        const data = await queryAnnouncements(supabase);
        if (cancelled) return;
        setAnnouncements(
          data.map((a) => ({
            id: a.id,
            title: a.title ?? "",
            body: a.body ?? "",
            postedDate: (a.created_at ?? "").slice(0, 10),
            isActive: a.is_active,
          })),
        );
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  async function toggleActive(id: string) {
    const target = announcements.find((a) => a.id === id);
    if (!target) return;
    const nextState = !target.isActive;
    const supabase = null as never;
    setTogglingId(id);
    setListError("");
    try {
      await updateAnnouncement(supabase, id, { is_active: nextState });
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: nextState } : a)));
    } catch {
      setListError(`“${target.title}” could not be ${nextState ? "shown" : "hidden"}. Try again.`);
    } finally {
      setTogglingId(null);
    }
  }

  function openNew() {
    setForm(BLANK_FORM);
    setError("");
    setEditingId("new");
  }

  function openEdit(a: AnnouncementRow) {
    setForm({ title: a.title ?? "", body: a.body ?? "", isActive: a.isActive });
    setError("");
    setEditingId(a.id);
  }

  async function saveAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return;
    const supabase = null as never;
    setSaving(true);
    setError("");
    try {
      if (editingId === "new") {
        const data = await createAnnouncement(supabase, {
          title: form.title.trim(),
          body: form.body.trim(),
          is_active: form.isActive,
        });
        setAnnouncements((prev) => [
          {
            id: data.id,
            title: data.title,
            body: data.body,
            postedDate: data.created_at.slice(0, 10),
            isActive: data.is_active,
          },
          ...prev,
        ]);
      } else if (editingId) {
        await updateAnnouncement(supabase, editingId, { title: form.title.trim(), body: form.body.trim(), is_active: form.isActive });
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === editingId ? { ...a, title: form.title, body: form.body, isActive: form.isActive } : a)),
        );
      }
      setEditingId(null);
    } catch {
      setError("The announcement could not be saved. Your text is still here; try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    const supabase = null as never;
    setSaving(true);
    setError("");
    try {
      await deleteAnnouncement(supabase, deletingId);
      setAnnouncements((prev) => prev.filter((a) => a.id !== deletingId));
      setDeletingId(null);
    } catch {
      setError("The announcement could not be deleted. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const deleting = announcements.find((a) => a.id === deletingId);
  const live = announcements.filter((a) => a.isActive).length;

  return (
    <AppShell role="admin">
      <div className="mx-auto max-w-doctor-record space-y-lg">
        <PageHeader
          title="Announcements"
          description={loading || loadError ? "Notices shown on the patient and staff dashboards." : <>Notices shown on the patient and staff dashboards. <span className="tabular-nums">{live}</span> of <span className="tabular-nums">{announcements.length}</span> currently shown.</>}
          actions={<Button onClick={openNew}><Icon name="add_circle" className="text-[16px]" />New announcement</Button>}
        />

        {listError && <FormAlert>{listError}</FormAlert>}

        {loading ? (
          <div className="space-y-md" aria-busy="true">
            <p className="sr-only" role="status">Loading announcements…</p>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : loadError ? (
          <ErrorState title="Announcements unavailable" message="Announcements could not be loaded. Try again." onRetry={() => setReloadKey((k) => k + 1)} />
        ) : announcements.length === 0 ? (
          <EmptyState icon="campaign" message="No announcements yet. Post one to let patients know about holidays or schedule changes." action={<Button onClick={openNew}>New announcement</Button>} />
        ) : (
          <ul className="space-y-md">
            {announcements.map((a) => (
              <li key={a.id}>
                <Card className={cn("space-y-md", !a.isActive && "bg-surface-container-low")}>
                  <div className="flex flex-wrap items-start justify-between gap-md">
                    <div className="min-w-0 flex-1 space-y-xs">
                      <h2 className="break-words text-headline-sm text-on-surface">{a.title}</h2>
                      <p className="line-clamp-3 whitespace-pre-line break-words text-body-md text-on-surface-variant">{a.body}</p>
                      <p className="text-label-md tabular-nums text-on-surface-variant">Posted {formatClinicDateShort(a.postedDate)}</p>
                    </div>
                    <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-sm text-label-md text-on-surface">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={a.isActive}
                        aria-label={`Show “${a.title}”`}
                        disabled={togglingId === a.id}
                        onClick={() => toggleActive(a.id)}
                        className={cn("relative h-6 w-11 rounded-full transition-colors disabled:opacity-60", a.isActive ? "bg-primary" : "bg-outline")}
                      >
                        <span className={cn("absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform", a.isActive && "translate-x-5")} />
                      </button>
                      <span aria-hidden="true">{a.isActive ? "Shown" : "Hidden"}</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-sm border-t border-outline-variant pt-md">
                    <Button variant="secondary" className="px-md" onClick={() => openEdit(a)}><Icon name="edit" className="text-[14px]" />Edit</Button>
                    <Button variant="ghost" className="px-md text-status-danger hover:bg-status-danger-surface" onClick={() => { setError(""); setDeletingId(a.id); }}>
                      <Icon name="delete" className="text-[14px]" />Delete
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={editingId !== null}
        onClose={() => { if (!saving) setEditingId(null); }}
        title={editingId === "new" ? "New announcement" : "Edit announcement"}
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveAnnouncement} disabled={!form.title.trim() || !form.body.trim()} loading={saving}>
              {editingId === "new" ? (form.isActive ? "Post announcement" : "Save as hidden") : "Save changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {error && <FormAlert>{error}</FormAlert>}
          <div className="space-y-xs">
            <label htmlFor="ann-title" className={labelStyles}>Title</label>
            <input id="ann-title" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} className={inputStyles()} />
          </div>
          <div className="space-y-xs">
            <label htmlFor="ann-body" className={labelStyles}>Message</label>
            <textarea id="ann-body" value={form.body} onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))} rows={5} className={inputStyles("py-md")} />
          </div>
          <label className="flex min-h-11 items-center gap-sm text-body-md text-on-surface">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-5 w-5 accent-primary"
            />
            Show on dashboards now
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={deletingId !== null}
        onClose={() => { if (!saving) setDeletingId(null); }}
        title="Delete announcement?"
        footer={
          <>
            <Button variant="secondary" disabled={saving} onClick={() => setDeletingId(null)}>Keep it</Button>
            <Button variant="danger" loading={saving} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <div className="space-y-md">
          {error && <FormAlert>{error}</FormAlert>}
          <p className="text-body-md text-on-surface-variant">
            “{deleting?.title}” will be removed for everyone. This can&apos;t be undone; hide it instead if you may need it again.
          </p>
        </div>
      </Modal>
    </AppShell>
  );
}
