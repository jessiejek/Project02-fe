import { takeReservedPrintWindow } from "@/lib/print-window"; //JJQR - AI (2026-11-25) - iPad: the window opened in the tap //JJQR - END
/**
 * Open a focused print window. Returns false if the browser blocked popups.
 * Pass `opts.brand` to override the default brand line, or `null` to omit it
 * entirely (the body carries its own letterhead — see `print-forms.ts`).
 * Pass `opts.bare` for clinic forms: skip the default @page margin, body
 * padding/font rules, and brand so the form CSS owns the page.
 */
export function printHtml(
  title: string,
  bodyHtml: string,
  opts?: { brand?: string | null; bare?: boolean },
): boolean {
  const bare = Boolean(opts && opts.bare);
  const brand = bare ? null : opts && "brand" in opts ? opts.brand : "Dr. Grace Gavino Clinic";
  //JJQR - AI (Nov 21, 2026) - the desktop "clinic node" (built with NEXT_PUBLIC_LOCAL_NODE=1) prints through a hidden frame INSIDE the page: an embedded webview (WKWebView on a Mac, WebView2 on
  // Windows) handles pop-up windows unpredictably, while a same-page frame prints the same on every one. The browser version keeps the pop-up exactly as before.
  const useFrame = process.env.NEXT_PUBLIC_LOCAL_NODE === "1";
  //JJQR - END
  // NB: no `noopener`/`noreferrer` here — with either flag `window.open` returns
  // null (per spec), and we need the handle to write the document into. The page
  // we write never navigates anywhere external, so there's no opener to protect.
  //JJQR - AI (2026-11-25) - iPad Safari: use the window already opened in the tap (lib/print-window.ts) when there is one
  const win = useFrame ? null : (takeReservedPrintWindow<Window>() ?? window.open("", "_blank", "width=800,height=900"));
  //JJQR - END
  if (!useFrame && !win) return false;

  const chromeCss = bare
    ? `html, body { margin: 0; padding: 0; }`
    : `@page { margin: 16mm; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      color: #0b1c30;
      font-size: 13px;
      line-height: 1.45;
      margin: 0;
      padding: 24px;
    }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #bcc9c6; padding-bottom: 4px; }
    .meta { color: #3d4947; font-size: 12px; margin-bottom: 16px; }
    .card { border: 1px solid #bcc9c6; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
    .muted { color: #3d4947; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5eeff; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #3d4947; }
    .slip {
      border: 2px dashed #bcc9c6;
      border-radius: 12px;
      padding: 28px 20px;
      text-align: center;
      max-width: 360px;
      margin: 0 auto;
    }
    .slip .queue { font-size: 28px; font-weight: 700; color: #00685f; margin: 8px 0; }
    .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6d7a77; margin-bottom: 12px; }`;

  const documentHtml = (autoPrint: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${chromeCss}
  </style>
</head>
<body>
  ${brand ? `<div class="brand">${escapeHtml(brand)}</div>` : ""}
  ${bodyHtml}${autoPrint ? `
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 50);
    };
  </script>` : ""}
</body>
</html>`;

  //JJQR - AI (Nov 21, 2026) - desktop: write the document into a hidden frame and print THAT frame (the frame's own @page rules apply, so the 4.3in lab form / A5 Rx pad keep their sizes)
  if (useFrame) return printInHiddenFrame(documentHtml(false));
  //JJQR - END

  win!.document.write(documentHtml(true));
  win!.document.close();
  return true;
}

//JJQR - AI (Nov 21, 2026)
function printInHiddenFrame(html: string): boolean {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
  document.body.appendChild(frame);
  const w = frame.contentWindow;
  const d = frame.contentDocument;
  if (!w || !d) {
    frame.remove();
    return false;
  }
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => frame.remove(), 500);
  };
  w.addEventListener("load", () => {
    // `load` fires after the images (letterhead, logo) have loaded, so they are on the printout
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } finally {
        w.addEventListener("afterprint", cleanup);
        setTimeout(cleanup, 120_000); // some webviews never raise afterprint
      }
    }, 50);
  });
  d.open();
  d.write(html);
  d.close();
  return true;
}
//JJQR - END

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
