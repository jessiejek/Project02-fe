"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/components/providers/SessionProvider";
import { queryPatientLabResults, uploadPatientLabResult } from "@/lib/data/patientFiles";
import { queryMyBookings } from "@/lib/data/bookings";

interface BookingOption {
  id: string;
  label: string;
}

interface LabResultRow {
  id: string;
  resultTitle: string | null;
  fileName: string;
  uploadedAt: string;
  fileUrl: string;
}

// Stitch screen_17_lab_results_upload — identical pattern to Documents,
// labeled for lab results with a "Result notes" field instead of Description.
export default function LabResultsPage() {
  const { session, loading } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [labResults, setLabResults] = useState<LabResultRow[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;

    async function load() {
      const [bookingRows, resultsData] = await Promise.all([
        queryMyBookings(null as never, patientId),
        queryPatientLabResults(null as never, { patientId }),
      ]);

      setBookings(
        bookingRows.map((b) => ({
          id: b.booking_id,
          label: `${b.doctors?.staff_accounts?.full_name ?? "Doctor"} — ${b.appointment_date}`,
        })),
      );

      setLabResults(
        (resultsData ?? []).map((r) => ({
          id: r.id,
          resultTitle: r.result_title,
          fileName: r.file_name,
          uploadedAt: r.uploaded_at.slice(0, 10),
          fileUrl: r.file_url,
        })),
      );
    }

    load();
  }, [session?.patientId]);

  async function handleUpload() {
    if (!session?.patientId) return;
    setError("");
    setSuccess("");
    if (!bookingId) {
      setError("Select a booking to link this lab result to.");
      return;
    }
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    setUploading(true);
    const notes = resultNotes.trim();
    let data;
    try {
      data = await uploadPatientLabResult(file, {
        patientId: session.patientId,
        bookingId,
        resultTitle: notes || file.name,
        resultText: notes || undefined,
      });
    } catch (e) {
      setUploading(false);
      setError(e instanceof Error ? e.message : "Upload failed.");
      return;
    }
    setUploading(false);

    setLabResults((prev) => [
      {
        id: data.id,
        resultTitle: data.result_title,
        fileName: data.file_name,
        uploadedAt: data.uploaded_at.slice(0, 10),
        fileUrl: data.file_url,
      },
      ...prev,
    ]);
    setResultNotes("");
    setFile(null);
    setBookingId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSuccess("Lab result uploaded.");
  }

  if (loading || !session?.patientId) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading your lab results...</p>
      </AppShell>
    );
  }

  return (
    <AppShell role="patient">
      <div className="space-y-lg">
        <h2 className="text-headline-lg text-on-surface">My Lab Results</h2>

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
              <label className="text-label-md text-on-surface-variant">Result Notes (optional)</label>
              <input
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-md py-sm text-body-md"
              />
            </div>
          </div>
          <Button className="mt-md" onClick={handleUpload} disabled={uploading || !bookingId || !file}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </Card>

        {labResults.length === 0 ? (
          <EmptyState icon="science" message="No lab results yet" />
        ) : (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            {labResults.map((lab) => (
              <Card key={lab.id} className="flex items-center gap-md">
                <Icon name="science" className="text-[28px] text-on-surface-variant" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md text-on-surface">{lab.resultTitle ?? lab.fileName}</p>
                  <p className="text-label-sm text-on-surface-variant">{lab.uploadedAt}</p>
                </div>
                <a href={lab.fileUrl} target="_blank" rel="noreferrer" className="text-on-surface-variant">
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
