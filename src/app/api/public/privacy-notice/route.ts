// JJQR - AI (Nov 20, 2026) - PV-11: the privacy notice as a plain, public HTML page. It lives under /api so the sign-in gate in proxy.ts
// (which skips /api) never redirects a logged-out visitor away from it. ?lang=fil for Filipino.
import { NOTICE, noticeLang, type NoticeSection } from "@/lib/privacy-notice";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function section(s: NoticeSection) {
  return `<section><h2>${esc(s.heading)}</h2>${(s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join("")}${
    s.bullets ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""
  }</section>`;
}

export async function GET(request: Request) {
  const lang = noticeLang(new URL(request.url).searchParams.get("lang"));
  const t = NOTICE[lang];
  const other = lang === "en" ? "fil" : "en";
  const html = `<!doctype html><html lang="${lang === "fil" ? "fil" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.title)} — Dr. Grace Gavino Medical Clinic</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:1.5rem;color:#1a1c1e}h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:1.6rem}a{color:#00506b}.note{background:#fff4d6;padding:.5rem .75rem;border-radius:.5rem}li{margin:.25rem 0}</style></head>
<body><main><p><a href="?lang=${other}" lang="${other === "fil" ? "fil" : "en"}">${esc(t.switchLabel)}</a></p><h1>${esc(t.title)}</h1><p class="note">${esc(t.draftNote)}</p><p>${esc(t.updated)}</p><p>${esc(t.intro)}</p>${t.sections.map(section).join("")}</main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
