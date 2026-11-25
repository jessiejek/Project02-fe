//JJQR - AI (Nov 25, 2026) - owner: same as the desktop. The consultation's Lab Orders step is split 75% tests / 25% this panel:
// the lab results and documents uploaded for THIS consultation (booking), newest first, each with Open. The Upload button is in the step title bar.
"use client";

import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { openPatientFile, queryPatientDocuments, queryPatientLabResults } from "@/lib/data/patientFiles";
import { formatUploadedManila } from "@/lib/visit-upload"; //JJQR - AI (2026-11-25) - owner: Manila upload times //JJQR - END

interface VisitFile { id: string; title: string; uploadedAt: string; kind: "lab-result" | "document" }

export function VisitFilesPanel({ bookingId, version }: { bookingId: string; version: number }) {
  const [files, setFiles] = useState<VisitFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // code review: files can be uploaded from the chart (opened in a new tab by "Patient chart") — reload when the doctor comes back to this tab
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") setRetry((n) => n + 1); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // one load per visit (and after an upload: `version` changes); a failure is shown once with Try again
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const supabase = null as never;
    Promise.all([queryPatientLabResults(supabase, { bookingId }), queryPatientDocuments(supabase, { bookingId })])
      .then(([labs, docs]) => {
        if (cancelled) return;
        setFiles([
          ...labs.map((l) => ({ id: l.id, title: l.result_title || "Lab result", uploadedAt: l.uploaded_at ?? "", kind: "lab-result" as const })),
          ...docs.map((d) => ({ id: d.id, title: d.title || d.file_name, uploadedAt: d.uploaded_at ?? "", kind: "document" as const })),
        ].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
      })
      .catch(() => { if (!cancelled) { setFailed(true); setFiles(null); } });
    return () => { cancelled = true; };
  }, [bookingId, version, retry]);

  return (
    <div className="space-y-sm rounded-lg border border-outline-variant bg-primary/5 p-md">
      <p className="text-body-md font-semibold text-on-surface">Uploaded results</p>
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      {failed ? (
        <>
          <p className="text-body-sm text-on-surface-variant">Uploaded results could not be loaded. Check the internet.</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)} className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}>Try again</button>
        </>
      ) : files === null ? (
        <p className="text-body-sm text-on-surface-variant">Loading uploaded results…</p>
      ) : files.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">None yet. Press &quot;Upload results&quot; (top right) to add the patient&apos;s CBC, urinalysis, X-ray… one or several PDF, JPG or PNG files.</p>
      ) : (
        files.map((f) => (
          <div key={f.kind + f.id} className="flex items-center justify-between gap-sm rounded-md border border-outline-variant bg-surface-container-lowest px-sm py-xs">
            <span className="min-w-0">
              <span className="block break-words text-body-sm font-semibold text-on-surface">{f.title}</span>
              <span className="block text-[12px] text-on-surface-variant">{/* //JJQR - AI (2026-11-25) - owner: upload time in Manila time, not raw UTC */}Uploaded {formatUploadedManila(f.uploadedAt)}{/* //JJQR - END */}</span>
            </span>
            <button
              type="button"
              onClick={() => { setError(""); openPatientFile(f.kind, f.id).catch((e) => setError(e instanceof Error ? e.message : "Could not open the file.")); }}
              className={buttonStyles("secondary", "!min-h-8 !px-sm !text-[13px]")}
            >
              Open
            </button>
          </div>
        ))
      )}
    </div>
  );
}
//JJQR - END
