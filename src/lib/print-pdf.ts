//JJQR - AI (Nov 24, 2026) - owner: on an iPad the web printed on A4 because iOS ignores a page's size (AirPrint takes the paper from the printer). So on iPhone/iPad the form is drawn once
// into a real A5 PDF (148 x 210 mm) and opened; a PDF is printed at the size of ITS page. No library: the form is drawn through an SVG foreignObject into a canvas, saved as a JPEG and wrapped in a one-page PDF.

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const MM = 96 / 25.4; // css px per mm
const DPI = 300;

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("image " + res.status);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Draw the printed fragment (its <style> plus the .form sheet) onto a canvas of the given size in mm. */
async function renderCanvas(bodyHtml: string, wMm: number, hMm: number): Promise<HTMLCanvasElement> {
  const doc = new DOMParser().parseFromString("<!doctype html><html><body>" + bodyHtml + "</body></html>", "text/html");
  // pictures must travel inside the SVG as data: URIs (an SVG drawn as an image cannot load anything from the network)
  const imgs = Array.from(doc.querySelectorAll("img"));
  const cache: { [src: string]: string } = {};
  for (const img of imgs) {
    const src = img.getAttribute("src") || "";
    if (!src || src.indexOf("data:") === 0) continue;
    if (!cache[src]) cache[src] = await toDataUri(src);
    img.setAttribute("src", cache[src]);
  }
  const css = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent || "").join("\n")
    .replace(/@page[^{]*\{[^}]*\}/g, "")
    .replace(/(^|[\s,}])html\s*,\s*body/g, "$1.pagebox")
    .replace(/(^|[\s,}])body\b/g, "$1.pagebox");
  doc.querySelectorAll("style").forEach((s) => s.remove());
  const inner = new XMLSerializer().serializeToString(doc.body).replace(/^<body[^>]*>/, "").replace(/<\/body>$/, "");
  const w = Math.round(wMm * MM);
  const h = Math.round(hMm * MM);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%">' +
    '<div xmlns="http://www.w3.org/1999/xhtml" class="pagebox" style="width:' + w + "px;height:" + h + 'px;overflow:hidden;background:#fff;box-sizing:border-box">' +
    "<style>" + css.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "\n.form{box-shadow:none!important;margin:0!important}</style>" +
    inner + "</div></foreignObject></svg>";
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("form could not be drawn"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  const scale = DPI / 96;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** A one-page PDF whose page is exactly wMm x hMm and whose only content is the JPEG. */
export function jpegToPdf(jpeg: Uint8Array, pxW: number, pxH: number, wMm: number, hMm: number): Blob {
  const ptW = (wMm / 25.4) * 72;
  const ptH = (hMm / 25.4) * 72;
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array) => { parts.push(b); length += b.length; };
  const obj = (n: number, head: string, stream?: Uint8Array) => {
    offsets[n] = length;
    if (stream) {
      push(ascii(n + " 0 obj\n" + head.replace("%LEN%", String(stream.length)) + "\nstream\n"));
      push(stream);
      push(ascii("\nendstream\nendobj\n"));
    } else push(ascii(n + " 0 obj\n" + head + "\nendobj\n"));
  };
  push(ascii("%PDF-1.4\n"));
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + ptW.toFixed(2) + " " + ptH.toFixed(2) + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
  obj(4, "<< /Type /XObject /Subtype /Image /Width " + pxW + " /Height " + pxH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %LEN% >>", jpeg);
  obj(5, "<< /Length %LEN% >>", ascii("q " + ptW.toFixed(2) + " 0 0 " + ptH.toFixed(2) + " 0 0 cm /Im0 Do Q"));
  const xref = length;
  let table = "xref\n0 6\n0000000000 65535 f \n";
  for (let n = 1; n <= 5; n++) table += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  push(ascii(table + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n"));
  const all = new Uint8Array(length);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  return new Blob([all], { type: "application/pdf" });
}

/** The printed fragment as an A5 (or any size) PDF. */
export async function htmlToPdf(bodyHtml: string, wMm = 148, hMm = 210): Promise<Blob> {
  const canvas = await renderCanvas(bodyHtml, wMm, hMm);
  const jpegBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/jpeg", 0.93));
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  return jpegToPdf(jpeg, canvas.width, canvas.height, wMm, hMm);
}
//JJQR - END
