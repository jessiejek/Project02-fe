"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { inviteStaffMember } from "@/app/actions/inviteStaffMember";
import { revokeStaffInvite } from "@/app/actions/revokeStaffInvite";
import { createClient } from "@/lib/supabase/client";
import { queryStaffAccounts } from "@/lib/data/staff";
import type { StaffMember } from "@/data/types";

// Stitch staff_management.
export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  // admin.md §9: Invite Staff form was decorative — "Send Invite" had no
  // onClick at all, and Revoke didn't remove the pending invite.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [invitedAt, setInvitedAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const data = await queryStaffAccounts(supabase, { role: "Staff" });
      setStaff(data.map((s) => ({ id: s.staff_id, fullName: s.full_name, email: s.email, role: "Staff", status: s.status })));
    }
    load();
  }, []);

  async function toggleStatus(id: string) {
    const target = staff.find((s) => s.id === id);
    if (!target) return;
    const nextStatus = target.status === "Active" ? "Inactive" : "Active";
    const supabase = createClient();
    await supabase.from("staff_accounts").update({ status: nextStatus }).eq("staff_id", id);
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, status: nextStatus } : s)));
  }

  async function revoke(id: string) {
    const result = await revokeStaffInvite(id);
    if (!result.success) {
      setInviteError(result.error);
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
    setPhone("");
    setInvitedAt(new Date().toLocaleTimeString());
  }

  return (
    <AppShell role="admin">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">Staff Management</h2>

        <Card>
          <h3 className="mb-md text-headline-sm text-on-surface">Invite Staff</h3>
          {inviteError && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{inviteError}</p>}
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name*"
              className="rounded-lg border border-outline-variant px-md py-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email* (normalized to lowercase)"
              className="rounded-lg border border-outline-variant px-md py-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="rounded-lg border border-outline-variant px-md py-sm"
            />
          </div>
          <Button className="mt-md" onClick={sendInvite} disabled={!fullName.trim() || !email.trim() || inviting}>
            {inviting ? "Sending invite…" : "Send Invite"}
          </Button>
        </Card>
        {invitedAt && <Toast key={invitedAt} variant="success" message={`Invite sent at ${invitedAt}.`} />}

        <DataTable
          columns={[
            { header: "Full Name", render: (s) => s.fullName },
            { header: "Email", render: (s) => s.email },
            { header: "Role", render: (s) => s.role },
            { header: "Status", render: (s) => <StatusPill status={s.status} /> },
            {
              header: "Action",
              align: "right",
              render: (s) =>
                s.status === "Invited" ? (
                  <Button variant="danger" onClick={() => revoke(s.id)}>Revoke</Button>
                ) : (
                  <Button variant="secondary" onClick={() => toggleStatus(s.id)}>
                    {s.status === "Active" ? "Deactivate" : "Activate"}
                  </Button>
                ),
            },
          ]}
          rows={staff}
          rowKey={(s) => s.id}
          renderMobileCard={(s) => (
            <div className="space-y-sm">
              <div className="flex items-start justify-between gap-md">
                <div>
                  <p className="text-body-md font-medium text-on-surface">{s.fullName}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {s.email} · {s.role}
                  </p>
                </div>
                <StatusPill status={s.status} />
              </div>
              {s.status === "Invited" ? (
                <Button variant="danger" className="w-full" onClick={() => revoke(s.id)}>
                  Revoke
                </Button>
              ) : (
                <Button variant="secondary" className="w-full" onClick={() => toggleStatus(s.id)}>
                  {s.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
              )}
            </div>
          )}
        />
      </div>
    </AppShell>
  );
}
