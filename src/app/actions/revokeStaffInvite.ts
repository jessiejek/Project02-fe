"use server";

import { api, ApiError } from "@/lib/api/client";
import { getServerSession } from "@/lib/auth/session";

export type RevokeResult = { success: true } | { success: false; error: string };

// Revoking a not-yet-accepted invite means the account never really happened —
// deleting the User row cascades through Profile / StaffAccount / Doctor /
// doctor_schedules via the DB FK chain. Only a pending ("Invited") account can
// be revoked; an accepted one is deactivated via the staff edit screen instead.
export async function revokeStaffInvite(staffId: string): Promise<RevokeResult> {
  const session = await getServerSession();
  if (session?.role !== "Admin") return { success: false, error: "Only an admin can revoke invites." };

  try {
    const staff = await api.get<{ user_id: string; status: string }>(`/api/staff-accounts/${staffId}`);
    if (staff.status !== "Invited") return { success: false, error: "Only a pending invite can be revoked." };
    await api.delete(`/api/auth/users/${staff.user_id}`);
    return { success: true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return { success: false, error: "Staff record not found." };
    return { success: false, error: e instanceof ApiError ? e.message : "Could not revoke this invite." };
  }
}
