import type { SupabaseClient } from "@supabase/supabase-js";

export const PATIENT_DOCUMENTS_BUCKET = "patient-documents";
export const PATIENT_LAB_RESULTS_BUCKET = "patient-lab-results";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — matches supabase/storage.sql

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function validatePatientUpload(file: File): string | null {
  if (!file || file.size <= 0) return "Choose a file to upload.";
  if (file.size > MAX_UPLOAD_BYTES) return "File must be 10 MB or smaller.";
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return "Allowed types: PDF, JPG, PNG, WEBP, GIF, DOC, DOCX.";
  }
  return null;
}

/** Upload a patient file to Storage and return its public URL + metadata. */
export async function uploadPatientFile(
  supabase: SupabaseClient,
  bucket: string,
  patientId: string,
  bookingId: string,
  file: File,
): Promise<{ fileUrl: string; fileName: string; fileSize: number; contentType: string | null; error: string | null }> {
  const validationError = validatePatientUpload(file);
  if (validationError) {
    return { fileUrl: "", fileName: file.name, fileSize: file.size, contentType: file.type || null, error: validationError };
  }

  const path = `${patientId}/${bookingId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) {
    return {
      fileUrl: "",
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || null,
      error: uploadError.message.includes("Bucket not found")
        ? "Storage bucket is missing. Run supabase/storage.sql in the Supabase SQL editor first."
        : uploadError.message,
    };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    fileUrl: data.publicUrl,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || null,
    error: null,
  };
}
