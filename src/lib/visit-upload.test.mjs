//JJQR - AI (Nov 25, 2026) - upload rules shared by the consultation's Lab Orders upload and the chart's per-visit upload
import test from "node:test";
import assert from "node:assert/strict";
import { checkUploadFiles, uploadTitle, MAX_UPLOAD_BYTES } from "./visit-upload.ts";

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
