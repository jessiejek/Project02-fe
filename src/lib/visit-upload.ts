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

//JJQR - AI (2026-11-25) - owner: several files with no suggested title opened with an empty Title. Same rule as the desktop's PatientFileUpload:
// the suggested title (e.g. the ordered tests) when there is one; one file = its name without the extension; several = "Lab results <visit date>" / "Documents <visit date>".
export function defaultUploadTitle(kind: "lab" | "doc", visitDate: string, files: { name: string }[], suggested?: string): string {
  const s = suggested?.trim();
  if (s) return s;
  if (files.length === 1) return files[0].name.replace(/\.[^.]+$/, "");
  if (files.length === 0) return "";
  return `${kind === "lab" ? "Lab results" : "Documents"} ${visitDate}`;
}
//JJQR - END

//JJQR - AI (2026-11-25) - owner: upload times were shown in raw UTC; show them in Manila time. The server sends UTC (a value without a zone is read as UTC).
// withTime: "YYYY-MM-DD HH:mm" (uploads panel), otherwise "YYYY-MM-DD" (chart's Results & files line).
export function formatUploadedManila(iso: string, withTime = true): string {
  if (!iso) return "";
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return withTime ? iso.slice(0, 16).replace("T", " ") : iso.slice(0, 10);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return withTime ? `${date} ${parts.hour}:${parts.minute}` : date;
}
//JJQR - END
