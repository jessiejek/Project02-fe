"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSession } from "@/components/providers/SessionProvider";
import { openPatientFile, queryPatientLabResults, uploadPatientLabResult } from "@/lib/data/patientFiles";
import { queryMyBookings } from "@/lib/data/bookings";
import { PatientFileUpload, PatientFileRow } from "@/components/patient/PatientFileUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatClinicDate, formatClinicDateShort } from "@/lib/format";

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
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;

    async function load() {
      let bookingRows, resultsData;
      try {
        [bookingRows, resultsData] = await Promise.all([
          queryMyBookings(null as never, patientId),
          queryPatientLabResults(null as never, { patientId }),
        ]);
      } catch {
        setListStatus("error");
        return;
      }

      setBookings(
        bookingRows.map((b) => ({
          id: b.booking_id,
          label: `${formatClinicDateShort(b.appointment_date)} · ${b.doctors?.staff_accounts?.full_name ?? "Doctor"}`,
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
      setListStatus("ready");
    }

    load();
  }, [session?.patientId, retryKey]);

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
    setSuccess(`${data.file_name} uploaded.`);
  }

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <PageHeader title="Lab results" description="Upload results from an outside lab so your doctor sees them at your visit." />
        {loading || !session?.patientId || listStatus === "loading" ? (
          <div className="space-y-lg" aria-busy="true"><SkeletonCard lines={4} /><SkeletonCard lines={2} /></div>
        ) : listStatus === "error" ? (
          <ErrorState title="Your lab results didn’t load" message="Check your connection, then try again." onRetry={() => { setListStatus("loading"); setRetryKey((k) => k + 1); }} />
        ) : (
          <>
            <PatientFileUpload
              heading="Add a lab result"
              file={file}
              fileInputRef={fileInputRef}
              onFile={(f) => { setFile(f); setError(""); setSuccess(""); }}
              bookings={bookings}
              bookingId={bookingId}
              onBooking={setBookingId}
              textLabel="Result notes"
              textValue={resultNotes}
              onText={setResultNotes}
              uploading={uploading}
              onSubmit={handleUpload}
              error={error}
              success={success}
              submitLabel="Upload result"
            />
            <section className="space-y-md">
              <h2 className="text-headline-sm text-on-surface">Uploaded results <span className="font-normal tabular-nums text-on-surface-variant">({labResults.length})</span></h2>
              {labResults.length === 0 ? (
                <EmptyState icon="science" message="No lab results yet." />
              ) : (
                <ul className="divide-y divide-outline-variant/40 rounded-xl border border-outline-variant bg-surface-container-lowest">
                  {labResults.map((lab) => (
                    <PatientFileRow
                      key={lab.id}
                      icon="science"
                      title={lab.resultTitle ?? lab.fileName}
                      meta={<>Uploaded <span className="tabular-nums">{formatClinicDate(lab.uploadedAt)}</span></>}
                      onOpen={() => {
                        setError("");
                        openPatientFile("lab-result", lab.id).catch((e) => setError(e instanceof Error ? e.message : "Could not open the file."));
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
