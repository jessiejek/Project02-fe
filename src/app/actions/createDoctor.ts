"use server";

import { api, ApiError } from "@/lib/api/client";
import { getServerSession } from "@/lib/auth/session";
import { dayNameToIndex } from "@/lib/days";
import type { DoctorScheduleDay } from "@/data/types";

export type CreateDoctorResult = { success: true; doctorId: string } | { success: false; error: string };

export interface CreateDoctorInput {
  email: string;
  fullName: string;
  specialization: string;
  consultationFee: number;
  bio: string;
  licenseNumber: string;
  ptrNumber: string;
  s2Number: string;
  slotDurationMinutes: number;
  schedule: DoctorScheduleDay[];
}

// Creating one doctor fans out into User -> Profile -> StaffAccount -> doctors ->
// doctor_schedules. The .NET POST /api/auth/invite endpoint does the whole fan-out
// in a single SaveChanges when a `doctor` payload rides along with role "Doctor",
// so there's no orphaned half-created doctor if any row fails. Endpoint is itself
// [Authorize(Roles="Admin")]; the check below is a friendlier early bail.
export async function createDoctor(input: CreateDoctorInput): Promise<CreateDoctorResult> {
  const session = await getServerSession();
  if (session?.role !== "Admin") return { success: false, error: "Only an admin can create doctors." };

  try {
    const res = await api.post<{ user_id: string; staff_id: string }>("/api/auth/invite", {
      email: input.email,
      fullName: input.fullName,
      role: "Doctor",
      doctor: {
        specialization: input.specialization,
        consultationFee: input.consultationFee,
        bio: input.bio || null,
        licenseNumber: input.licenseNumber || null,
        ptrNumber: input.ptrNumber || null,
        s2Number: input.s2Number || null,
        slotDurationMinutes: input.slotDurationMinutes,
        schedule: input.schedule.map((d) => ({
          dayOfWeek: dayNameToIndex(d.day),
          isActive: d.isActive,
          startTime: d.startTime,
          endTime: d.endTime,
        })),
      },
    });
    return { success: true, doctorId: res.staff_id };
  } catch (e) {
    return { success: false, error: e instanceof ApiError ? e.message : "Could not create the doctor." };
  }
}
