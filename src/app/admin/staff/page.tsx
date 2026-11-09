"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormAlert } from "@/components/ui/FormAlert";
import { ErrorState } from "@/components/ui/ErrorState";
import { hintStyles, inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { inviteStaffMember } from "@/app/actions/inviteStaffMember";
import { revokeStaffInvite } from "@/app/actions/revokeStaffInvite";
import { queryStaffAccounts, updateStaffAccount } from "@/lib/data/staff";
import type { StaffMember } from "@/data/types";

// Stitch staff_management.
export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  // admin.md §9: Invite Staff form was decorative — "Send Invite" had no
  // onClick at all, and Revoke didn't remove the pending invite.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [invitedAt, setInvitedAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = null as never;
      setLoading(true);
      try {
        const data = await queryStaffAccounts(supabase, { role: "Staff" });
        setStaff(data.map((s) => ({ id: s.staff_id, fullName: s.full_name, email: s.email, role: "Staff", status: s.status })));
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reloadKey]);

  async function toggleStatus(id: string) {
    const target = staff.find((s) => s.id === id);
    if (!target) return;
    const nextStatus = target.status === "Active" ? "Inactive" : "Active";
    const supabase = null as never;
    setBusyId(id);
    setRowError("");
    try {
      await updateStaffAccount(supabase, id, { status: nextStatus });
      setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, status: nextStatus } : s)));
    } catch {
      setRowError(`Could not ${nextStatus === "Active" ? "activate" : "deactivate"} ${target.fullName}. Try again.`);
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(id: string) {
    setBusyId(id);
    setRowError("");
    const result = await revokeStaffInvite(id).catch(() => ({ success: false as const, error: "Could not revoke the invite. Try again." }));
    setBusyId(null);
    if (!result.success) {
      setRowError(result.error);
      return;
    }
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  async function sendInvite() {
    if (!fullName.trim() || !email.trim()) return;
    setInviteError("");
    setInviting(true);
    const result = await inviteStaffMember({ email: email.trim().toLowerCase(), fullName, role: "Staff" });
    setInviting(false);
    if (!result.success) {
      setInviteError(result.error);
      return;
    }
    setStaff((prev) => [
      ...prev,
      { id: result.staffId, fullName, email: email.trim().toLowerCase(), role: "Staff", status: "Invited" },
    ]);
    setFullName("");
    setEmail("");
    setInvitedAt(new Date().toLocaleTimeString());
  }

  const action = (s: StaffMember, full = false) =>
    s.status === "Invited" ? (
      <Button variant="ghost" className={full ? "w-full text-status-danger hover:bg-status-danger-surface" : "px-md text-status-danger hover:bg-status-danger-surface"}
        loading={busyId === s.id} disabled={busyId !== null && busyId !== s.id} onClick={() => revoke(s.id)}>Revoke invite</Button>
    ) : (
      <Button variant="secondary" className={full ? "w-full" : "px-md"} loading={busyId === s.id}
        disabled={busyId !== null && busyId !== s.id} onClick={() => toggleStatus(s.id)}>
        {s.status === "Active" ? "Deactivate" : "Activate"}
      </Button>
    );

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <PageHeader title="Front-desk staff" description="Invite receptionists and manage who can sign in to the staff portal. Doctors are managed under Doctors." />

        <form
          className="space-y-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg"
          onSubmit={(e) => { e.preventDefault(); sendInvite(); }}
          aria-labelledby="invite-heading"
        >
          <div>
            <h2 id="invite-heading" className="text-headline-sm text-on-surface">Invite a staff member</h2>
            <p className={hintStyles}>They get an email to set a password; the account shows as Invited until their first login.</p>
          </div>
          {inviteError && <FormAlert>{inviteError}</FormAlert>}
          <div className="grid grid-cols-1 items-end gap-md sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-xs">
              <label htmlFor="invite-name" className={labelStyles}>Full name</label>
              <input id="invite-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputStyles()} />
            </div>
            <div className="space-y-xs">
              <label htmlFor="invite-email" className={labelStyles}>Email</label>
              <input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyles()} />
            </div>
            <Button type="submit" disabled={!fullName.trim() || !email.trim()} loading={inviting}>
              {inviting ? "Sending invite…" : "Send invite"}
            </Button>
          </div>
        </form>
        {invitedAt && <Toast key={invitedAt} variant="success" message={`Invite sent at ${invitedAt}.`} />}

        <section aria-labelledby="team-heading" className="space-y-md">
          <h2 id="team-heading" className="text-headline-md text-on-surface">Team</h2>
          {rowError && <FormAlert>{rowError}</FormAlert>}
          {loadError ? (
            <ErrorState title="Staff list unavailable" message="The staff list could not be loaded. Try again." onRetry={() => setReloadKey((k) => k + 1)} retrying={loading} />
          ) : (
            <DataTable
              columns={[
                { header: "Name", render: (s) => <span className="font-medium text-on-surface">{s.fullName}</span> },
                { header: "Email", render: (s) => <span className="break-all">{s.email}</span> },
                { header: "Status", render: (s) => <StatusPill status={s.status} /> },
                { header: "Action", align: "right", render: (s) => action(s) },
              ]}
              rows={staff}
              rowKey={(s) => s.id}
              loading={loading}
              emptyMessage="No staff yet. Send an invite above."
              renderMobileCard={(s) => (
                <div className="space-y-sm">
                  <div className="flex items-start justify-between gap-md">
                    <div className="min-w-0">
                      <p className="break-words text-body-md font-medium text-on-surface">{s.fullName}</p>
                      <p className="break-all text-label-md text-on-surface-variant">{s.email}</p>
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                  {action(s, true)}
                </div>
              )}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
