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

import { MAX_UPLOAD_FILES, checkUploadFiles, uploadTitle, defaultUploadTitle, cameraPhotoName, nextPhotoNumber } from "@/lib/visit-upload"; // rules shared with the tests

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
  const cameraRef = useRef<HTMLInputElement>(null); //JJQR - AI (2026-11-26) - why: "Take a picture" (owner pt95u) //JJQR - END
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [saved, setSaved] = useState(0); // a retry after a partial failure skips the files already saved

  // code review: reset only when the pop-up OPENS (not when the suggested title changes while it is open — that wiped the picked files)
  const wasOpen = useRef(false);
  //JJQR - AI (2026-11-25) - owner: remember the title we filled in ourselves, so picking other files can replace it (never a title the doctor typed)
  const autoTitle = useRef("");
  //JJQR - END
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setFiles([]); setTitle(suggestedTitle ?? ""); setError(""); setSaved(0); setSending(false);
      autoTitle.current = ""; //JJQR - AI (2026-11-25) - owner: a fresh pop-up has no auto-filled title yet //JJQR - END
      if (inputRef.current) inputRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = ""; //JJQR - AI (2026-11-26) - why: a fresh pop-up starts with no photo //JJQR - END
    }
    wasOpen.current = isOpen;
  }, [isOpen, suggestedTitle]);

  //JJQR - AI (2026-11-26) - why: owner (pt95u) "there should also be take a picture". A photo from the camera JOINS the files already chosen (it does not
  // replace them), gets its own name ("Photo 1.jpg"), and goes through the same checks (10 files, 10 MB, JPG/PNG) and the same ONE consultation.
  function addPhotos(list: FileList | null) {
    const shots = Array.from(list ?? []);
    if (cameraRef.current) cameraRef.current.value = ""; // the same input can take the next picture
    if (shots.length === 0) return;
    let n = nextPhotoNumber(files);
    const named = shots.map((f) => new File([f], cameraPhotoName(f.name, f.type, n++), { type: f.type || "image/jpeg", lastModified: f.lastModified }));
    pick(null, [...files, ...named]);
  }
  //JJQR - END

  function pick(list: FileList | null, all?: File[]) { //JJQR - AI (2026-11-26) - why: `all` = the full list after a photo was added //JJQR - END
    const picked = all ?? Array.from(list ?? []);
    setError(checkUploadFiles(picked) ?? "");
    setFiles(picked);
    setSaved(0);
    //JJQR - AI (2026-11-25) - owner: several files with no suggested title opened with an empty Title; pre-fill "Lab results <visit date>" / "Documents <visit date>" (one file = its name, as before). Same as the desktop.
    if (!title.trim() || title === autoTitle.current) {
      const t = defaultUploadTitle(kind, visitDate, picked, suggestedTitle);
      autoTitle.current = t;
      setTitle(t);
    }
    //JJQR - END
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
        {/*JJQR - AI (2026-11-26) - why: owner (pt95u): "Take a picture" right beside Choose Files. capture="environment" opens the iPad's rear camera
            (a computer without a camera simply shows its file picker). The photo joins the list above the Title. */}
        <div className="flex flex-wrap items-center gap-sm">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            disabled={sending}
            onChange={(e) => pick(e.target.files)}
            className="block min-w-0 flex-1 text-body-sm"
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={sending}
            onChange={(e) => addPhotos(e.target.files)}
            className="hidden"
            data-testid="visit-upload-camera"
          />
          <Button type="button" variant="secondary" disabled={sending || files.length >= MAX_UPLOAD_FILES} onClick={() => cameraRef.current?.click()} className="shrink-0">
            Take a picture
          </Button>
        </div>
        {/*JJQR - END */}
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
