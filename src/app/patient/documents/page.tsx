"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";
import { PATIENT_DOCUMENTS_BUCKET, uploadPatientFile } from "@/lib/patientUploads";

interface BookingOption {
  id: string;
  label: string;
}

interface DocumentRow {
  id: string;
  title: string | null;
  description: string | null;
  fileName: string;
  uploadedAt: string;
  fileUrl: string;
  doctorName: string;
}

// Stitch screen_16_documents_upload.
export default function DocumentsPage() {
  const { session, loading } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;

    async function load() {
      const supabase = createClient();
      const [bookingsRes, docsRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("booking_id, appointment_date, doctors(staff_accounts(full_name))")
          .eq("patient_id", patientId)
          .order("appointment_date", { ascending: false }),
        supabase
          .from("patient_documents")
          .select("id, title, description, file_name, file_url, uploaded_at, bookings(doctors(staff_accounts(full_name)))")
          .eq("patient_id", patientId)
          .order("uploaded_at", { ascending: false }),
      ]);

      setBookings(
        (bookingsRes.data ?? []).map((b) => {
          const doctor = Array.isArray(b.doctors) ? b.doctors[0] : b.doctors;
          const staff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
          return {
            id: b.booking_id,
            label: `${staff?.full_name ?? "Doctor"} — ${b.appointment_date}`,
          };
        }),
      );

      setDocuments(
        (docsRes.data ?? []).map((doc) => {
          const booking = Array.isArray(doc.bookings) ? doc.bookings[0] : doc.bookings;
          const doctor = booking ? (Array.isArray(booking.doctors) ? booking.doctors[0] : booking.doctors) : undefined;
          const staff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
          return {
            id: doc.id,
            title: doc.title,
            description: doc.description,
            fileName: doc.file_name,
            uploadedAt: doc.uploaded_at.slice(0, 10),
            fileUrl: doc.file_url,
            doctorName: staff?.full_name ?? "",
          };
        }),
      );
    }

    load();
  }, [session?.patientId]);

  // Patient.md §8: "Can search by title/description/doctor" — doctor is
  // resolved via the document's linked booking.
  const filtered = documents.filter((doc) => {
    return `${doc.title ?? ""} ${doc.description ?? ""} ${doc.doctorName}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  async function handleUpload() {
    if (!session?.patientId) return;
    setError("");
    setSuccess("");
    if (!bookingId) {
      setError("Select a booking to link this document to.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const uploaded = await uploadPatientFile(supabase, PATIENT_DOCUMENTS_BUCKET, session.patientId, bookingId, file);
    if (uploaded.error) {
      setUploading(false);
      setError(uploaded.error);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("patient_documents")
      .insert({
        patient_id: session.patientId,
        booking_id: bookingId,
        file_name: uploaded.fileName,
        file_size: uploaded.fileSize,
        file_content_type: uploaded.contentType,
        title: title.trim() || null,
        file_url: uploaded.fileUrl,
        uploaded_by_user_id: session.userId,
      })
      .select("id, title, description, file_name, file_url, uploaded_at, bookings(doctors(staff_accounts(full_name)))")
      .single();

    setUploading(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "File uploaded, but saving the document record failed.");
      return;
    }

    const booking = Array.isArray(data.bookings) ? data.bookings[0] : data.bookings;
    const doctor = booking ? (Array.isArray(booking.doctors) ? booking.doctors[0] : booking.doctors) : undefined;
    const staff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
    setDocuments((prev) => [
      {
        id: data.id,
        title: data.title,
        description: data.description,
        fileName: data.file_name,
        uploadedAt: data.uploaded_at.slice(0, 10),
        fileUrl: data.file_url,
        doctorName: staff?.full_name ?? "",
      },
      ...prev,
    ]);
    setTitle("");
    setFile(null);
    setBookingId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSuccess("Document uploaded.");
  }

  if (loading || !session?.patientId) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading your documents...</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">My Documents</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, description, or doctor..."
          className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md sm:w-80"
        />

        <Card>
          {error && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>}
          {success && <p className="mb-md rounded-lg bg-green-50 px-md py-sm text-body-sm text-green-800">{success}</p>}
          <label className="mb-md flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant p-xl text-center text-body-md text-on-surface-variant hover:bg-surface-container-low">
            <Icon name="upload_file" className="mb-sm text-[28px]" />
            {file ? file.name : "Drop a file here or click to upload"}
            <span className="mt-xs text-label-sm">PDF / images / DOC — max 10 MB</span>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,application/pdf,image/*"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError("");
                setSuccess("");
              }}
            />
          </label>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <div className="space-y-xs">
              <label className="text-label-md text-on-surface-variant">Link to Booking *</label>
              <select
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
              >
                <option value="">Select a booking</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
              <p className="text-label-sm text-on-surface-variant">Required</p>
            </div>
            <div className="space-y-xs">
              <label className="text-label-md text-on-surface-variant">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
              />
            </div>
          </div>
          <Button className="mt-md" onClick={handleUpload} disabled={uploading || !bookingId || !file}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </Card>

        {filtered.length === 0 ? (
          <EmptyState icon="folder_open" message="No documents yet" />
        ) : (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((doc) => (
              <Card key={doc.id} className="flex items-center gap-md">
                <Icon name="description" className="text-[28px] text-on-surface-variant" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md text-on-surface">{doc.title ?? doc.fileName}</p>
                  <p className="text-label-sm text-on-surface-variant">{doc.uploadedAt}</p>
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-on-surface-variant">
                  <Icon name="download" />
                </a>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
