//JJQR - AI (Nov 25, 2026) - upload rules shared by the consultation's Lab Orders upload and the chart's per-visit upload
import test from "node:test";
import assert from "node:assert/strict";
import { checkUploadFiles, uploadTitle, MAX_UPLOAD_BYTES, defaultUploadTitle, formatUploadedManila } from "./visit-upload.ts";

test("one PDF, JPG or PNG under 10 MB is accepted", () => {
  assert.equal(checkUploadFiles([{ name: "CBC.pdf", size: 1000 }]), null);
  assert.equal(checkUploadFiles([{ name: "xray.JPG", size: 1000 }, { name: "ua.jpeg", size: 5 }, { name: "scan.png", size: MAX_UPLOAD_BYTES }]), null);
});

test("nothing picked, too many, wrong type, empty or too large is refused with a reason", () => {
  assert.match(checkUploadFiles([]), /at least one/);
  assert.match(checkUploadFiles(Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.pdf`, size: 1 }))), /up to 10/);
  assert.match(checkUploadFiles([{ name: "notes.docx", size: 1 }]), /not a PDF, JPG or PNG/);
  assert.match(checkUploadFiles([{ name: "noext", size: 1 }]), /not a PDF, JPG or PNG/);
  assert.match(checkUploadFiles([{ name: "empty.pdf", size: 0 }]), /empty/);
  assert.match(checkUploadFiles([{ name: "big.pdf", size: MAX_UPLOAD_BYTES + 1 }]), /larger than 10 MB/);
});

test("one title for all files; '(i of n)' only when several go up together", () => {
  assert.equal(uploadTitle("  CBC  ", 0, 1), "CBC");
  assert.equal(uploadTitle("CBC, Urinalysis", 1, 3), "CBC, Urinalysis (2 of 3)");
});
//JJQR - END

//JJQR - AI (2026-11-25) - owner: pre-filled title for several files; upload times in Manila time
test("title: suggested first, one file = its name, several = 'Lab results <date>' / 'Documents <date>'", () => {
  const three = [{ name: "a.pdf" }, { name: "b.jpg" }, { name: "c.png" }];
  assert.equal(defaultUploadTitle("lab", "2026-11-25", three, "CBC, Urinalysis"), "CBC, Urinalysis");
  assert.equal(defaultUploadTitle("lab", "2026-11-25", three, "   "), "Lab results 2026-11-25");
  assert.equal(defaultUploadTitle("lab", "2026-11-25", three), "Lab results 2026-11-25");
  assert.equal(defaultUploadTitle("doc", "2026-11-25", three), "Documents 2026-11-25");
  assert.equal(defaultUploadTitle("lab", "2026-11-25", [{ name: "CBC scan.pdf" }]), "CBC scan");
  assert.equal(defaultUploadTitle("lab", "2026-11-25", []), "");
  assert.equal(uploadTitle(defaultUploadTitle("lab", "2026-11-25", three), 0, 3), "Lab results 2026-11-25 (1 of 3)");
});

test("upload times are shown in Manila time (UTC+8), including across midnight", () => {
  assert.equal(formatUploadedManila("2026-11-25T09:05:00Z"), "2026-11-25 17:05");
  assert.equal(formatUploadedManila("2026-11-25T17:30:00.123+00:00"), "2026-11-26 01:30");
  assert.equal(formatUploadedManila("2026-11-25T17:30:00"), "2026-11-26 01:30"); // no zone = UTC
  assert.equal(formatUploadedManila("2026-11-25T17:30:00Z", false), "2026-11-26");
  assert.equal(formatUploadedManila(""), "");
});
//JJQR - END
