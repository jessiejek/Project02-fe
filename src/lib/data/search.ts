import { api } from "@/lib/api/client";

export interface SearchPatientHit {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
}

export interface SearchDoctorHit {
  doctor_id: string;
  full_name: string;
  specialization: string;
}

export interface SearchBookingHit {
  booking_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  queue_number: string | null;
  patient_name: string;
}

export interface GlobalSearchResult {
  patients: SearchPatientHit[];
  doctors: SearchDoctorHit[];
  bookings: SearchBookingHit[];
}

//JJQR - AI (Oct 31, 2026)
export async function globalSearch(q: string): Promise<GlobalSearchResult> {
  const raw = await api.get<{
    patients?: SearchPatientHit[];
    doctors?: SearchDoctorHit[];
    bookings?: SearchBookingHit[];
  }>("/api/search", { query: { q } });
  return {
    patients: raw.patients ?? [],
    doctors: raw.doctors ?? [],
    bookings: raw.bookings ?? [],
  };
}
//JJQR - END
