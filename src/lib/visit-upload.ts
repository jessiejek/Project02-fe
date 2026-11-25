//JJQR - AI (Nov 25, 2026) - rules for uploading a patient's results to ONE consultation (same as the desktop's PatientFileUpload):
// 1–10 files per upload, PDF / JPG / PNG, 1 byte to 10 MB each; one title for all, "(i of n)" added when several go up together.
// Plain module (no React) so node:test can check it (visit-upload.test.mjs).
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

/** Checks the picked files; returns a message for the screen, or null when they can be uploaded. */
export function checkUploadFiles(files: { name: string; size: number }[]): string | null {
  if (files.length === 0) return "Choose at least one file.";
  if (files.length > MAX_UPLOAD_FILES) return `Choose up to ${MAX_UPLOAD_FILES} files at a time (you chose ${files.length}). Nothing was uploaded.`;
  for (const f of files) {
    if (!ALLOWED.has(extOf(f.name))) return `"${f.name}" is not a PDF, JPG or PNG file. Nothing was uploaded.`;
    if (f.size === 0) return `"${f.name}" is empty. Nothing was uploaded.`;
    if (f.size > MAX_UPLOAD_BYTES) return `"${f.name}" is larger than 10 MB. Scan or save it smaller, then try again. Nothing was uploaded.`;
  }
  return null;
}

/** Title of file i of n: the typed title, plus "(i of n)" when several files go up together. */
export function uploadTitle(title: string, i: number, n: number): string {
  return n === 1 ? title.trim() : `${title.trim()} (${i + 1} of ${n})`;
}
//JJQR - END
