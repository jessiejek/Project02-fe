"use server";

import { api, ApiError } from "@/lib/api/client";
import { getServerSession } from "@/lib/auth/session";

export type SetPasswordResult = { success: true } | { success: false; error: string };

// Admin support tool: set a temporary password for a Staff or Doctor member (staffId = doctorId for doctors).
// The server checks the password rule, ends their sessions and makes them choose their own at next sign-in.
// The password is only passed through to the API; it is never logged or stored here.
export async function setStaffPassword(staffId: string, newPassword: string): Promise<SetPasswordResult> {
  const session = await getServerSession();
  if (session?.role !== "Admin") return { success: false, error: "Only an admin can set a password." };
  if (!newPassword) return { success: false, error: "Type a new password." };
  try {
    await api.put(`/api/staff-accounts/${staffId}/password`, { newPassword });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof ApiError ? e.message : "The password could not be set. Try again." };
  }
}
