"use server";

import { api, ApiError } from "@/lib/api/client";
import { getServerSession } from "@/lib/auth/session";

export type InviteResult = { success: true; staffId: string } | { success: false; error: string };

// Staff/Doctor/Admin are never self-service (Implementation-Phases/02-authentication.md
// §1) — only an existing Admin can provision one. The .NET POST /api/auth/invite
// endpoint creates the User + Profile + StaffAccount(Invited) in one transaction
// and is itself [Authorize(Roles="Admin")]; the check below is a friendlier
// early bail for the UI.
export async function inviteStaffMember(input: {
  email: string;
  fullName: string;
  role: "Staff" | "Doctor" | "Admin";
}): Promise<InviteResult> {
  const session = await getServerSession();
  if (session?.role !== "Admin") return { success: false, error: "Only an admin can send invites." };

  try {
    const res = await api.post<{ user_id: string; staff_id: string }>("/api/auth/invite", {
      email: input.email,
      fullName: input.fullName,
      role: input.role,
    });
    return { success: true, staffId: res.staff_id };
  } catch (e) {
    return { success: false, error: e instanceof ApiError ? e.message : "Could not send invite." };
  }
}
