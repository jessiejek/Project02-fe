"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { queryPatientsPaged, createPatient } from "@/lib/data/patients";
import type { PatientSummary } from "@/data/types";

const PAGE_SIZE = 25;

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
  const [rows, setRows] = useState<PatientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [newPatient, setNewPatient] = useState(BLANK_NEW_PATIENT);

  // §16.2 — server-side search + pagination. Debounce the query; reset to page 1
  // whenever the search term changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const supabase = null as never;
      const res = await queryPatientsPaged(supabase, {
        q: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
        sort: "-created",
      });
      if (cancelled) return;
      setTotal(res.totalCount);
      setRows(
        res.items.map((p) => ({
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
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const canCreate = newPatient.firstName.trim() !== "" && newPatient.lastName.trim() !== "" && newPatient.dateOfBirth.trim() !== "" && newPatient.sex !== "";

  async function handleCreate() {
    if (!canCreate) return;
    const supabase = null as never;
    try {
      const data = await createPatient(supabase, {
        first_name: newPatient.firstName,
        last_name: newPatient.lastName,
        date_of_birth: newPatient.dateOfBirth,
        sex: newPatient.sex as "Male" | "Female",
        contact_number: newPatient.contactNumber || null,
      });
      setRows((prev) => [
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
      setTotal((n) => n + 1);
    } catch {
      /* keep the modal open on failure */
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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search patients by name, code, email, phone..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm sm:w-96"
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

        <div className="flex items-center justify-between text-label-md text-on-surface-variant">
          <span>{loading ? "Loading…" : `${rangeStart}–${rangeEnd} of ${total}`}</span>
          <div className="flex items-center gap-sm">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>Page {page} / {pageCount}</span>
            <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
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
