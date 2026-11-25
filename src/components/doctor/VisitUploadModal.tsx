//JJQR - AI (Nov 25, 2026) - owner: same as the desktop. Upload a patient's results (CBC, urinalysis, X-ray… one or several files: PDF, JPG, PNG,
// up to 10 MB each, at most 10 per upload) and TAG them to ONE consultation (its booking). Used by the consultation's Lab Orders step and by each
// visit in the patient chart. One title for all files ("(1 of 3)" is added per file). While files are sending the pop-up cannot be closed
// (closing early made the screen think nothing was saved and invited a duplicate upload).
"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { uploadPatientDocument, uploadPatientLabResult } from "@/lib/data/patientFiles";

export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

/** Checks the picked files like the desktop does; returns a message, or null when they can be uploaded. */
export function checkUploadFiles(files: { name: string; size: number }[]): string | null {
  if (files.length === 0) return "Choose at least one file.";
  if (files.length > MAX_UPLOAD_FILES) return `Choose up to ${MAX_UPLOAD_FILES} files at a time (you chose ${files.length}). Nothing was uploaded.`;
  for (const f of files) {
    if (!TYPES[extOf(f.name)]) return `"${f.name}" is not a PDF, JPG or PNG file. Nothing was uploaded.`;
    if (f.size === 0) return `"${f.name}" is empty. Nothing was uploaded.`;
    if (f.size > MAX_UPLOAD_BYTES) return `"${f.name}" is larger than 10 MB. Scan or save it smaller, then try again. Nothing was uploaded.`;
  }
  return null;
}

/** Title of file i of n: the typed title, plus "(i of n)" when several files go up together. */
export function uploadTitle(title: string, i: number, n: number): string {
  return n === 1 ? title.trim() : `${title.trim()} (${i + 1} of ${n})`;
}

export function VisitUploadModal({
  isOpen, onClose, onUploaded, patientId, bookingId, visitDate, kind = "lab", suggestedTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Called after at least one file was saved (the caller reloads its list). */
  onUploaded: (count: number) => void;
  patientId: string;
  bookingId: string;
  visitDate: string;
  kind?: "lab" | "doc";
  suggestedTitle?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(0); // a retry after a partial failure skips the files already saved

  useEffect(() => {
    if (!isOpen) return;
    setFiles([]); setTitle(suggestedTitle ?? ""); setError(""); setSaved(0); setSending(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [isOpen, suggestedTitle]);

  function pick(list: FileList | null) {
    const picked = Array.from(list ?? []);
    setError(checkUploadFiles(picked) ?? "");
    setFiles(picked);
    setSaved(0);
    if (!title.trim() && picked.length === 1) setTitle(picked[0].name.replace(/\.[^.]+$/, ""));
  }

  async function upload() {
    const problem = checkUploadFiles(files);
    if (problem) { setError(problem); return; }
    if (!title.trim()) { setError("Enter a title."); return; }
    setError("");
    setSending(true);
    let done = saved;
    try {
      for (let i = done; i < files.length; i++) {
        const name = uploadTitle(title, i, files.length);
        try {
          if (kind === "lab") await uploadPatientLabResult(files[i], { patientId, bookingId, resultTitle: name });
          else await uploadPatientDocument(files[i], { patientId, bookingId, title: name });
          done = i + 1;
          setSaved(done);
        } catch (e) {
          const msg = e instanceof Error && e.message ? e.message : "could not be uploaded";
          setError(done === 0
            ? `"${files[i].name}": ${msg}. If the connection dropped it may already be saved — check the list before uploading it again.`
            : `${done} file(s) saved. "${files[i].name}": ${msg}. Press Upload to send the rest.`);
          return;
        }
      }
      onUploaded(done);
      onClose();
    } finally {
      setSending(false);
      if (done > 0 && done < files.length) onUploaded(done);
    }
  }

  const close = () => { if (!sending) onClose(); };
  const many = files.length > 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={many ? `Upload ${files.length} files` : kind === "lab" ? "Upload lab result" : "Upload document"}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={sending}>Cancel</Button>
          <Button onClick={upload} disabled={sending || files.length === 0}>{sending ? "Uploading…" : "Upload"}</Button>
        </>
      }
    >
      <div className="space-y-md">
        {error && <FormAlert>{error}</FormAlert>}
        <p className="text-body-sm text-on-surface-variant">Saved with the consultation on {visitDate}. One or several PDF, JPG or PNG files (up to {MAX_UPLOAD_FILES}, 10 MB each).</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          disabled={sending}
          onChange={(e) => pick(e.target.files)}
          className="block w-full text-body-sm"
        />
        {files.length > 0 && (
          <ul className="space-y-xs text-body-sm text-on-surface">
            {files.map((f, i) => <li key={i} className="break-all">• {f.name}{i < saved ? " — saved" : ""}</li>)}
          </ul>
        )}
        <label className="block space-y-xs">
          <span className={labelStyles}>Title</span>
          <input
            value={title}
            maxLength={180}
            disabled={sending}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === "lab" ? "e.g. CBC, Urinalysis, Chest X-ray" : "e.g. Referral letter"}
            className={inputStyles()}
          />
        </label>
      </div>
    </Modal>
  );
}
//JJQR - END
