"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { orDash } from "@/lib/format";
import { todayManila } from "@/lib/clock";
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
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // §16.2 — server-side search + pagination. Debounce the query; reset to page 1
  // whenever the search term changes.
  useEffect(() => {
    let cancelled = false;
    //JJQR - AI (Oct 31, 2026)
    queueMicrotask(() => {
      if (!cancelled) setLoading(true);
    });
    //JJQR - END
    const handle = setTimeout(async () => {
      const supabase = null as never;
      let res: Awaited<ReturnType<typeof queryPatientsPaged>>;
      try {
        res = await queryPatientsPaged(supabase, {
          q: search.trim() || undefined,
          page,
          pageSize: PAGE_SIZE,
          sort: "-created",
        });
      } catch {
        if (!cancelled) { setLoadError("The patient directory could not be loaded. Try again."); setLoading(false); }
        return;
      }
      if (cancelled) return;
      setLoadError("");
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
  }, [search, page, reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const canCreate = newPatient.firstName.trim() !== "" && newPatient.lastName.trim() !== "" && newPatient.dateOfBirth.trim() !== "" && newPatient.sex !== "";

  async function handleCreate() {
    if (!canCreate) return;
    const supabase = null as never;
    setCreating(true);
    setCreateError("");
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
      setNewPatient(BLANK_NEW_PATIENT);
      setAddOpen(false);
    } catch (e) {
      // Keep the modal and the typed details open on failure.
      setCreateError(e instanceof Error && e.message ? e.message : "The patient could not be added. Check the details and try again.");
    } finally {
      setCreating(false);
    }
  }

  function closeAdd() {
    if (creating) return;
    setAddOpen(false);
    setNewPatient(BLANK_NEW_PATIENT);
    setCreateError("");
  }

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <PageHeader
          title="Patients"
          description="Everyone registered at the clinic, newest first. Open a patient to see their visits and account."
          actions={<Button onClick={() => setAddOpen(true)}><Icon name="add_circle" className="text-[16px]" />Add patient</Button>}
        />
        <label className="block max-w-doctor-search space-y-xs">
          <span className="text-label-md text-on-surface-variant">Search patients</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name, patient code, email or phone"
            className={inputStyles()}
          />
        </label>
        {loadError ? (
          <ErrorState title="Patients unavailable" message={loadError} onRetry={() => setReloadKey((k) => k + 1)} retrying={loading} />
        ) : (
          <>
            <DataTable
              columns={[
                { header: "Name", render: (p) => <span className="font-medium text-on-surface">{p.fullName}</span> },
                { header: "Code", render: (p) => <span className="font-mono text-body-sm">{p.patientCode}</span> },
                { header: "Contact", render: (p) => <span className="tabular-nums">{orDash(p.contactNumber)}</span> },
                { header: "Email", render: (p) => <span className="break-all">{orDash(p.email)}</span> },
                { header: "Account", render: (p) => <StatusPill status={p.accountStatus} /> },
              ]}
              rows={rows}
              rowKey={(p) => p.id}
              rowHref={(p) => `/admin/patients/${p.id}`}
              loading={loading}
              emptyMessage={search.trim() ? `No patients match “${search.trim()}”.` : "No patients registered yet."}
              renderMobileCard={(p) => (
                <div className="space-y-xs">
                  <div className="flex items-start justify-between gap-md">
                    <p className="min-w-0 break-words text-body-md font-medium text-on-surface">{p.fullName}</p>
                    <StatusPill status={p.accountStatus} />
                  </div>
                  <p className="text-label-md text-on-surface-variant"><span className="font-mono">{p.patientCode}</span> · <span className="tabular-nums">{orDash(p.contactNumber)}</span></p>
                  {p.email && <p className="break-all text-label-md text-on-surface-variant">{p.email}</p>}
                </div>
              )}
            />

            <nav aria-label="Patient pages" className="flex flex-wrap items-center justify-between gap-md text-label-md text-on-surface-variant">
              <span className="tabular-nums" aria-live="polite">{loading ? "Loading patients…" : `${rangeStart}–${rangeEnd} of ${total}`}</span>
              <div className="flex items-center gap-sm">
                <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  <Icon name="chevron_left" className="text-[14px]" />Previous
                </Button>
                <span className="tabular-nums">Page {page} of {pageCount}</span>
                <Button variant="secondary" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)}>
                  Next<Icon name="chevron_right" className="text-[14px]" />
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>

      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title="Add a patient"
        footer={
          <>
            <Button variant="secondary" disabled={creating} onClick={closeAdd}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!canCreate} loading={creating}>{creating ? "Adding…" : "Add patient"}</Button>
          </>
        }
      >
        <div className="space-y-md">
          {createError && <FormAlert>{createError}</FormAlert>}
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <label className="space-y-xs">
              <span className={labelStyles}>First name</span>
              <input required value={newPatient.firstName} onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })} className={inputStyles()} />
            </label>
            <label className="space-y-xs">
              <span className={labelStyles}>Last name</span>
              <input required value={newPatient.lastName} onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })} className={inputStyles()} />
            </label>
            <label className="space-y-xs">
              <span className={labelStyles}>Date of birth</span>
              <input type="date" required max={todayManila()} value={newPatient.dateOfBirth} onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })} className={inputStyles()} />
            </label>
            <label className="space-y-xs">
              <span className={labelStyles}>Sex</span>
              <select required value={newPatient.sex} onChange={(e) => setNewPatient({ ...newPatient, sex: e.target.value as "" | "Male" | "Female" })} className={inputStyles()}>
                <option value="" disabled>Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
            <label className="space-y-xs sm:col-span-2">
              <span className={labelStyles}>Contact number <span className="font-normal text-on-surface-variant">(optional)</span></span>
              <input type="tel" value={newPatient.contactNumber} onChange={(e) => setNewPatient({ ...newPatient, contactNumber: e.target.value })} className={inputStyles()} />
            </label>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
