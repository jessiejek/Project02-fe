"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";

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
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // admin.md §10: Create/Edit modal was fully decorative — inputs had no
  // value/onChange, Save didn't persist. Found during the field-by-field
  // audit of the last 6 Admin screens.
  const [form, setForm] = useState(BLANK_FORM);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("announcements").select("id, title, body, is_active, created_at").order("created_at", { ascending: false });
      setAnnouncements(
        (data ?? []).map((a) => ({
          id: a.id,
          title: a.title ?? "",
          body: a.body ?? "",
          postedDate: (a.created_at ?? "").slice(0, 10),
          isActive: a.is_active,
        })),
      );
      setLoading(false);
    }

    load();
  }, []);

  async function toggleActive(id: string) {
    const target = announcements.find((a) => a.id === id);
    if (!target) return;
    const nextState = !target.isActive;
    const supabase = createClient();
    await supabase.from("announcements").update({ is_active: nextState }).eq("id", id);
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: nextState } : a)));
  }

  function openNew() {
    setForm(BLANK_FORM);
    setEditingId("new");
  }

  function openEdit(a: AnnouncementRow) {
    setForm({ title: a.title ?? "", body: a.body ?? "", isActive: a.isActive });
    setEditingId(a.id);
  }

  async function saveAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return;
    const supabase = createClient();
    if (editingId === "new") {
      const { data } = await supabase
        .from("announcements")
        .insert({ title: form.title.trim(), body: form.body.trim(), is_active: form.isActive })
        .select("id, title, body, is_active, created_at")
        .single();
      if (data) {
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
      }
    } else if (editingId) {
      await supabase
        .from("announcements")
        .update({
          title: form.title.trim(),
          body: form.body.trim(),
          is_active: form.isActive,
        })
        .eq("id", editingId);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, title: form.title, body: form.body, isActive: form.isActive } : a)),
      );
    }
    setEditingId(null);
  }

  if (loading) {
    return (
      <AppShell role="admin">
        <p className="text-body-md text-on-surface-variant">Loading announcements...</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Announcements</h2>
          <Button onClick={openNew}>+ New Announcement</Button>
        </div>

        <div className="space-y-md">
          {announcements.map((a) => (
            <Card key={a.id} className="flex items-start justify-between gap-md">
              <div>
                <h3 className="text-headline-sm text-on-surface">{a.title}</h3>
                <p className="text-body-md text-on-surface-variant">{(a.body ?? "").slice(0, 100)}...</p>
                <p className="mt-xs text-label-sm text-on-surface-variant">{a.postedDate}</p>
              </div>
              <div className="flex items-center gap-sm">
                <button
                  type="button"
                  onClick={() => toggleActive(a.id)}
                  className={`h-6 w-11 rounded-full transition-colors ${a.isActive ? "bg-primary" : "bg-outline-variant"}`}
                >
                  <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${a.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
                <Button variant="secondary" onClick={() => openEdit(a)}>Edit</Button>
                <Button variant="danger" onClick={() => setDeletingId(a.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Modal
        isOpen={editingId !== null}
        onClose={() => setEditingId(null)}
        title={editingId === "new" ? "New Announcement" : "Edit Announcement"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveAnnouncement} disabled={!form.title.trim() || !form.body.trim()}>Save</Button>
          </>
        }
      >
        <div className="space-y-md">
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Title*"
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            placeholder="Body*"
            rows={4}
            className="w-full rounded-lg border border-outline-variant p-md"
          />
          <label className="flex items-center gap-sm text-body-md">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-5 w-5"
            />
            Active
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Delete Announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deletingId) return;
                const supabase = createClient();
                await supabase.from("announcements").delete().eq("id", deletingId);
                setAnnouncements((prev) => prev.filter((a) => a.id !== deletingId));
                setDeletingId(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">Delete this announcement?</p>
      </Modal>
    </AppShell>
  );
}
