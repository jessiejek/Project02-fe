"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";
import type { PatientSummary } from "@/data/types";

const BLANK_NEW_PATIENT = { firstName: "", lastName: "", dateOfBirth: "", contactNumber: "", sex: "" as "" | "Male" | "Female" };

// user_id null + is_guest true/false is the schema's own resolution for
// NoAccount vs AccountUnknown (see schema.sql's comment on patients.is_guest)
// — not a stored enum, so every real reader derives it the same way.
function accountStatus(userId: string | null, isGuest: boolean): PatientSummary["accountStatus"] {
  if (userId) return "LinkedAccount";
  return isGuest ? "NoAccount" : "AccountUnknown";
}

// Stitch patients_list_admin.
export default function AdminPatientsPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [newPatient, setNewPatient] = useState(BLANK_NEW_PATIENT);
  const rows = patients.filter((p) =>
    `${p.fullName} ${p.patientCode} ${p.contactNumber} ${p.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
      if (data) {
        setPatients(
          data.map((p) => ({
            id: p.patient_id,
            patientCode: p.patient_code,
            fullName: `${p.first_name} ${p.last_name}`,
            sex: p.sex,
            dateOfBirth: p.date_of_birth,
            contactNumber: p.contact_number ?? "",
            email: p.email,
            accountStatus: accountStatus(p.user_id, p.is_guest),
          })),
        );
      }
    }
    load();
  }, []);

  const canCreate = newPatient.firstName.trim() !== "" && newPatient.lastName.trim() !== "" && newPatient.dateOfBirth.trim() !== "" && newPatient.sex !== "";

  async function handleCreate() {
    if (!canCreate) return;
    const supabase = createClient();
    const patientCode = `MF-${Math.floor(1000 + Math.random() * 9000)}`;
    const { data, error } = await supabase
      .from("patients")
      .insert({
        patient_code: patientCode,
        first_name: newPatient.firstName.trim(),
        last_name: newPatient.lastName.trim(),
        date_of_birth: newPatient.dateOfBirth,
        sex: newPatient.sex as "Male" | "Female",
        contact_number: newPatient.contactNumber || null,
        email: "",
        is_guest: true,
        user_id: null,
      })
      .select("*")
      .single();
    if (!error && data) {
      setPatients((prev) => [
        {
          id: data.patient_id,
          patientCode: data.patient_code,
          fullName: `${data.first_name} ${data.last_name}`,
          sex: data.sex,
          dateOfBirth: data.date_of_birth,
          contactNumber: data.contact_number ?? "",
          email: data.email,
          accountStatus: accountStatus(data.user_id, data.is_guest),
        },
        ...prev,
      ]);
    }
    setNewPatient(BLANK_NEW_PATIENT);
    setAddOpen(false);
  }

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-headline-lg text-on-surface">Patients</h2>
          <Button onClick={() => setAddOpen(true)}>+ Add Patient</Button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patients..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm sm:w-80"
        />
        <DataTable
          columns={[
            { header: "Code", render: (p) => p.patientCode },
            { header: "Full Name", render: (p) => p.fullName },
            { header: "Account", render: (p) => <StatusPill status={p.accountStatus} /> },
            { header: "Contact", render: (p) => p.contactNumber },
            { header: "Email", render: (p) => p.email },
          ]}
          rows={rows}
          rowKey={(p) => p.id}
          rowHref={(p) => `/admin/patients/${p.id}`}
          renderMobileCard={(p) => (
            <div className="space-y-xs">
              <div className="flex items-center justify-between">
                <p className="text-body-md font-medium text-on-surface">{p.fullName}</p>
                <StatusPill status={p.accountStatus} />
              </div>
              <p className="text-label-sm text-on-surface-variant">{p.patientCode} · {p.contactNumber}</p>
              <p className="text-label-sm text-on-surface-variant">{p.email}</p>
            </div>
          )}
        />
      </div>

      <Modal
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); setNewPatient(BLANK_NEW_PATIENT); }}
        title="Add Patient"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setAddOpen(false); setNewPatient(BLANK_NEW_PATIENT); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!canCreate}>Create</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <input
            placeholder="First Name*"
            value={newPatient.firstName}
            onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
            className="rounded-lg border border-outline-variant px-md py-sm"
          />
          <input
            placeholder="Last Name*"
            value={newPatient.lastName}
            onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
            className="rounded-lg border border-outline-variant px-md py-sm"
          />
          <input
            placeholder="Date of Birth*"
            value={newPatient.dateOfBirth}
            onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })}
            className="rounded-lg border border-outline-variant px-md py-sm"
          />
          <select
            value={newPatient.sex}
            onChange={(e) => setNewPatient({ ...newPatient, sex: e.target.value as "" | "Male" | "Female" })}
            className="rounded-lg border border-outline-variant px-md py-sm text-on-surface-variant"
          >
            <option value="">Sex*</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <input
            placeholder="Contact Number"
            value={newPatient.contactNumber}
            onChange={(e) => setNewPatient({ ...newPatient, contactNumber: e.target.value })}
            className="rounded-lg border border-outline-variant px-md py-sm"
          />
        </div>
      </Modal>
    </AppShell>
  );
}
