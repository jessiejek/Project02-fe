"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RevokeResult = { success: true } | { success: false; error: string };

// Revoking a not-yet-accepted invite means the account never really
// happened — deleting the auth user cascades through profiles/staff_accounts
// (and doctors/doctor_services/doctor_schedules, if this was a doctor invite)
// via schema.sql's `on delete cascade` chain, same rollback mechanism used
// in createDoctor.ts/inviteStaffMember.ts's own failure paths.
export async function revokeStaffInvite(staffId: string): Promise<RevokeResult> {
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller) return { success: false, error: "Not signed in." };

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", caller.id).single();
  if (callerProfile?.role !== "Admin") return { success: false, error: "Only an admin can revoke invites." };

  const admin = createAdminClient();
  const { data: staffRow } = await admin.from("staff_accounts").select("user_id, status").eq("staff_id", staffId).single();
  if (!staffRow) return { success: false, error: "Staff record not found." };
  if (staffRow.status !== "Invited") return { success: false, error: "Only a pending invite can be revoked." };

  const { error } = await admin.auth.admin.deleteUser(staffRow.user_id);
  if (error) return { success: false, error: "Could not revoke this invite." };
  return { success: true };
}
