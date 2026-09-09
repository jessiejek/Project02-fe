"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import { queryDoctors } from "@/lib/data/doctors";
import { queryDoctorServices } from "@/lib/data/doctorServices";
import type { ManagedService } from "@/data/types";

const CATEGORIES: ManagedService["category"][] = ["Consultation", "Procedure", "Laboratory", "Diagnostic"];

const BLANK_FORM = {
  name: "",
  category: CATEGORIES[0],
  description: "",
  price: "",
  doctorIds: [] as string[],
};

interface DoctorOption {
  id: string;
  name: string;
  slotDurationMinutes: number;
}

// Stitch services_catalog — hard delete only, per admin.md §7 (no soft-delete
// path despite the separate isActive toggle). Assigned doctors persist via
// doctor_services (remaining.md A.6).
export default function AdminServicesPage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ManagedService[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [assignedDoctorIds, setAssignedDoctorIds] = useState<Record<string, string[]>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [servicesRes, doctorsRes, links] = await Promise.all([
        supabase.from("services").select("*").order("category").order("name"),
        queryDoctors(supabase),
        queryDoctorServices(supabase),
      ]);

      const doctorOptions: DoctorOption[] = doctorsRes
        .filter((d) => d.staff_accounts?.status !== "Inactive")
        .map((d) => ({
          id: d.doctor_id,
          name: d.staff_accounts?.full_name ?? "",
          slotDurationMinutes: d.slot_duration_minutes,
        }));
      const nameByDoctorId = new Map(doctorOptions.map((d) => [d.id, d.name]));

      const linksByService: Record<string, string[]> = {};
      for (const link of links) {
        if (!linksByService[link.service_id]) linksByService[link.service_id] = [];
        linksByService[link.service_id].push(link.doctor_id);
      }

      setDoctors(doctorOptions);
      setAssignedDoctorIds(linksByService);
      setServices(
        (servicesRes.data ?? []).map((s) => {
          const doctorIds = linksByService[s.service_id] ?? [];
          return {
            id: s.service_id,
            name: s.name,
            category: s.category,
            description: s.description ?? undefined,
            price: Number(s.price),
            isActive: s.is_active,
            doctorNames: doctorIds.map((id) => nameByDoctorId.get(id) ?? "Unknown").filter(Boolean),
          };
        }),
      );
      setLoading(false);
    }
    load();
  }, []);

  async function toggleActive(id: string) {
    const target = services.find((s) => s.id === id);
    if (!target) return;
    const supabase = createClient();
    await supabase.from("services").update({ is_active: !target.isActive }).eq("service_id", id);
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s)));
  }

  function openNew() {
    setSaveError("");
    setForm(BLANK_FORM);
    setEditingId("new");
  }

  function openEdit(s: ManagedService) {
    setSaveError("");
    setForm({
      name: s.name,
      category: s.category,
      description: s.description ?? "",
      price: String(s.price),
      doctorIds: assignedDoctorIds[s.id] ?? [],
    });
    setEditingId(s.id);
  }

  function toggleDoctor(id: string) {
    setForm((prev) => ({
      ...prev,
      doctorIds: prev.doctorIds.includes(id) ? prev.doctorIds.filter((d) => d !== id) : [...prev.doctorIds, id],
    }));
  }

  async function syncDoctorAssignments(serviceId: string, doctorIds: string[]) {
    const supabase = createClient();
    await supabase.from("doctor_services").delete().eq("service_id", serviceId);
    if (doctorIds.length === 0) return;
    await supabase.from("doctor_services").insert(
      doctorIds.map((doctorId) => {
        const doctor = doctors.find((d) => d.id === doctorId);
        return {
          service_id: serviceId,
          doctor_id: doctorId,
          duration_minutes: doctor?.slotDurationMinutes || 30,
        };
      }),
    );
  }

  async function saveService() {
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    setSaveError("");
    const supabase = createClient();
    const doctorNames = form.doctorIds
      .map((id) => doctors.find((d) => d.id === id)?.name ?? "")
      .filter(Boolean);

    if (editingId === "new") {
      const { data, error } = await supabase
        .from("services")
        .insert({
          name: form.name.trim(),
          category: form.category,
          description: form.description || null,
          price: Number(form.price),
        })
        .select("service_id")
        .single();
      if (error || !data) {
        setSaving(false);
        setSaveError("Could not create this service.");
        return;
      }
      await syncDoctorAssignments(data.service_id, form.doctorIds);
      setAssignedDoctorIds((prev) => ({ ...prev, [data.service_id]: form.doctorIds }));
      setServices((prev) => [
        ...prev,
        {
          id: data.service_id,
          name: form.name.trim(),
          category: form.category,
          description: form.description || undefined,
          price: Number(form.price),
          isActive: true,
          doctorNames,
        },
      ]);
    } else if (editingId) {
      const { error } = await supabase
        .from("services")
        .update({
          name: form.name.trim(),
          category: form.category,
          description: form.description || null,
          price: Number(form.price),
        })
        .eq("service_id", editingId);
      if (error) {
        setSaving(false);
        setSaveError("Could not update this service.");
        return;
      }
      await syncDoctorAssignments(editingId, form.doctorIds);
      setAssignedDoctorIds((prev) => ({ ...prev, [editingId]: form.doctorIds }));
      setServices((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                name: form.name.trim(),
                category: form.category,
                description: form.description || undefined,
                price: Number(form.price),
                doctorNames,
              }
            : s,
        ),
      );
    }
    setSaving(false);
    setEditingId(null);
  }

  if (loading) {
    return (
      <AppShell role="admin">
        <p className="text-body-md text-on-surface-variant">Loading services...</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="admin">
      <div className="space-y-xl">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Services Catalog</h2>
          <Button onClick={openNew}>+ Add Service</Button>
        </div>

        {CATEGORIES.map((category) => {
          const items = services.filter((s) => s.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="space-y-md">
              <h3 className="text-headline-sm text-on-surface">{category}</h3>
              {items.map((s) => (
                <Card key={s.id} className="flex flex-wrap items-center justify-between gap-md">
                  <div className="flex items-center gap-md">
                    <button
                      type="button"
                      onClick={() => toggleActive(s.id)}
                      className={`h-6 w-11 rounded-full transition-colors ${s.isActive ? "bg-primary" : "bg-outline-variant"}`}
                    >
                      <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${s.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                    <div>
                      <p className="text-body-md text-on-surface">{s.name}</p>
                      <p className="text-label-sm text-on-surface-variant">₱{s.price} · {s.doctorNames.join(", ") || "Unassigned"}</p>
                    </div>
                  </div>
                  <div className="flex gap-sm">
                    <Button variant="secondary" onClick={() => openEdit(s)}>Edit</Button>
                    <Button variant="danger" onClick={() => setDeletingId(s.id)}>Delete</Button>
                  </div>
                </Card>
              ))}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Delete Service"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deletingId) return;
                const supabase = createClient();
                await supabase.from("services").delete().eq("service_id", deletingId);
                setServices((prev) => prev.filter((s) => s.id !== deletingId));
                setAssignedDoctorIds((prev) => {
                  const next = { ...prev };
                  delete next[deletingId];
                  return next;
                });
                setDeletingId(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">Delete this service? This cannot be undone.</p>
      </Modal>

      <Modal
        isOpen={editingId !== null}
        onClose={() => setEditingId(null)}
        title={editingId === "new" ? "Add Service" : "Edit Service"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={saveService} disabled={!form.name.trim() || !form.price || saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <div className="space-y-md">
          {saveError && <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{saveError}</p>}
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Name*"
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ManagedService["category"] }))}
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
            className="w-full rounded-lg border border-outline-variant p-md"
            rows={2}
          />
          <input
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value.replace(/[^0-9.]/g, "") }))}
            placeholder="Price*"
            className="w-full rounded-lg border border-outline-variant px-md py-sm"
          />
          <div>
            <p className="mb-sm text-label-md text-on-surface-variant">Assigned Doctors</p>
            {doctors.length === 0 ? (
              <p className="text-label-sm text-on-surface-variant">No active doctors found.</p>
            ) : (
              <div className="space-y-xs">
                {doctors.map((d) => (
                  <label key={d.id} className="flex items-center gap-sm text-body-md text-on-surface">
                    <input
                      type="checkbox"
                      checked={form.doctorIds.includes(d.id)}
                      onChange={() => toggleDoctor(d.id)}
                      className="h-5 w-5"
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
