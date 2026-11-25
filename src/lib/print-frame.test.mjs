//JJQR - AI (Nov 21, 2026) - printing in the desktop app uses a hidden frame; the browser keeps the pop-up
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./print.ts", import.meta.url), "utf8");

test("the browser still prints through a pop-up window (unchanged)", () => {
  //JJQR - AI (2026-11-25) - the window opened in the tap is used first (lib/print-window.ts); otherwise the same pop-up as before
  assert.match(src, /const win = useFrame \? null : \(takeReservedPrintWindow<Window>\(\) \?\? window\.open\("", "_blank", "width=800,height=900"\)\);/);
  //JJQR - END
  assert.match(src, /if \(!useFrame && !win\) return false;/);
  assert.match(src, /win!\.document\.write\(documentHtml\(true\)\);/);
  assert.match(src, /window\.onload = function \(\) \{\s*setTimeout\(function \(\) \{ window\.focus\(\); window\.print\(\); \}, 50\);/);
});

test("only the desktop build (NEXT_PUBLIC_LOCAL_NODE=1) prints through a hidden frame inside the page", () => {
  assert.match(src, /const useFrame = process\.env\.NEXT_PUBLIC_LOCAL_NODE === "1";/);
  assert.match(src, /if \(useFrame\) return printInHiddenFrame\(documentHtml\(false\)\);/);
  assert.match(src, /document\.createElement\("iframe"\)/);
  assert.match(src, /w\.print\(\)/);
});

test("the frame waits for images, prints once, and removes itself (even when a webview never raises afterprint)", () => {
  assert.match(src, /w\.addEventListener\("load"/);
  assert.match(src, /afterprint/);
  assert.match(src, /setTimeout\(cleanup, 120_000\)/);
  // the frame path never contains the auto-print script (the parent prints it)
  assert.match(src, /\$\{autoPrint \? `/);
});
//JJQR - END
