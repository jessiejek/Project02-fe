"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSession } from "@/components/providers/SessionProvider";
import { openPatientFile, queryPatientDocuments, uploadPatientDocument } from "@/lib/data/patientFiles";
import { queryMyBookings } from "@/lib/data/bookings";
import { PatientFileUpload, PatientFileRow } from "@/components/patient/PatientFileUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { inputStyles } from "@/components/ui/fieldStyles";
import { formatClinicDate, formatClinicDateShort } from "@/lib/format";

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
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!session?.patientId) return;
    const patientId = session.patientId;

    async function load() {
      let bookingRows, docsData;
      try {
        [bookingRows, docsData] = await Promise.all([
          queryMyBookings(null as never, patientId),
          queryPatientDocuments(null as never, { patientId }),
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

      setDocuments(
        (docsData ?? []).map((doc) => {
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
      setListStatus("ready");
    }

    load();
  }, [session?.patientId, retryKey]);

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
    let data;
    try {
      data = await uploadPatientDocument(file, {
        patientId: session.patientId,
        bookingId,
        title: title.trim() || undefined,
      });
    } catch (e) {
      setUploading(false);
      setError(e instanceof Error ? e.message : "Upload failed.");
      return;
    }
    setUploading(false);

    const b = Array.isArray(data.bookings) ? data.bookings[0] : data.bookings;
    const doctor = b ? (Array.isArray(b.doctors) ? b.doctors[0] : b.doctors) : undefined;
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

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[48rem] space-y-lg">
        <PageHeader title="Documents" description="Referral letters, IDs and other papers for a visit. Your doctor can open them." />
        {loading || !session?.patientId || listStatus === "loading" ? (
          <div className="space-y-lg" aria-busy="true"><SkeletonCard lines={4} /><SkeletonCard lines={2} /></div>
        ) : listStatus === "error" ? (
          <ErrorState title="Your documents didn’t load" message="Check your connection, then try again." onRetry={() => { setListStatus("loading"); setRetryKey((k) => k + 1); }} />
        ) : (
          <>
            <PatientFileUpload
              heading="Add a document"
              file={file}
              fileInputRef={fileInputRef}
              onFile={(f) => { setFile(f); setError(""); setSuccess(""); }}
              bookings={bookings}
              bookingId={bookingId}
              onBooking={setBookingId}
              textLabel="Title"
              textValue={title}
              onText={setTitle}
              uploading={uploading}
              onSubmit={handleUpload}
              error={error}
              success={success}
              submitLabel="Upload document"
            />
            <section className="space-y-md">
              <div className="flex flex-wrap items-end justify-between gap-md">
                <h2 className="text-headline-sm text-on-surface">Your documents <span className="font-normal tabular-nums text-on-surface-variant">({documents.length})</span></h2>
                {documents.length > 0 && (
                  <label className="block w-full space-y-xs sm:w-72">
                    <span className="text-label-md text-on-surface-variant">Search documents</span>
                    <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, description or doctor" className={inputStyles()} />
                  </label>
                )}
              </div>
              {filtered.length === 0 ? (
                <EmptyState icon="folder_open" message={documents.length === 0 ? "No documents yet." : `No documents match “${search.trim()}”.`} />
              ) : (
                <ul className="divide-y divide-outline-variant/40 rounded-xl border border-outline-variant bg-surface-container-lowest">
                  {filtered.map((doc) => (
                    <PatientFileRow
                      key={doc.id}
                      icon="description"
                      title={doc.title || doc.fileName}
                      meta={<><span className="tabular-nums">{formatClinicDate(doc.uploadedAt)}</span>{doc.doctorName && <> · {doc.doctorName}</>}{doc.description && <> · {doc.description}</>}</>}
                      onOpen={() => {
                        setError("");
                        openPatientFile("document", doc.id).catch((e) => setError(e instanceof Error ? e.message : "Could not open the file."));
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
