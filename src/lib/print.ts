/**
 * Open a focused print window. Returns false if the browser blocked popups.
 * Pass `opts.brand` to override the default brand line, or `null` to omit it
 * entirely (the body carries its own letterhead — see `print-forms.ts`).
 */
export function printHtml(title: string, bodyHtml: string, opts?: { brand?: string | null }): boolean {
  const brand = opts && "brand" in opts ? opts.brand : "Dr. Grace Gavino Clinic";
  const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
  if (!win) return false;

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 16mm; }
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
    .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6d7a77; margin-bottom: 12px; }
  </style>
</head>
<body>
  ${brand ? `<div class="brand">${escapeHtml(brand)}</div>` : ""}
  ${bodyHtml}
  <script>
    window.onload = function () {
      setTimeout(function () { window.focus(); window.print(); }, 50);
    };
  </script>
</body>
</html>`);
  win.document.close();
  return true;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
