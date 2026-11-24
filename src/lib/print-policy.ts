//JJQR - AI (Nov 24, 2026) - owner: the web must print exactly like the desktop. The Admin's clinic-wide Printing settings (api/print-config) are read here once and kept in memory,
// so printing (which must open its window straight from the click) can read them without waiting: lab tests, background pictures, a document switched off, printing switched off.
import { api, API_BASE_URL, getAccessToken } from "@/lib/api/client";

export type PrintKind = "prescription" | "lab_request" | "medical_certificate" | "queue_slip" | "receipt";

interface ConfigDto {
  mode?: string;
  backgrounds?: { kind: string; version: number; contentType: string }[];
  disabled?: string[];
  labTests?: string[] | null;
}

export interface PrintPolicy {
  mode: string; // computer | pdf | native | off
  disabled: string[];
  labTests: string[] | null;
  backgrounds: { [kind: string]: string }; // kind -> data: URI
}

const EMPTY: PrintPolicy = { mode: "computer", disabled: [], labTests: null, backgrounds: {} };
let current: PrintPolicy = EMPTY;
const bgCache: { [key: string]: string } = {}; // "kind:version" -> data URI
let inflight: Promise<void> | null = null;
let loadedAt = 0;

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Fetch the clinic's settings. Best effort: any error (signed out, a patient, offline) keeps what we have. */
export function loadPrintPolicy(force = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (inflight) return inflight;
  if (!force && loadedAt && Date.now() - loadedAt < 60_000) return Promise.resolve();
  inflight = (async () => {
    try {
      const dto = await api.get<ConfigDto>("/api/print-config");
      const backgrounds: { [kind: string]: string } = {};
      const token = await getAccessToken();
      for (const b of dto.backgrounds ?? []) {
        const key = b.kind + ":" + b.version;
        if (!bgCache[key]) {
          const res = await fetch(API_BASE_URL + "/api/print-config/backgrounds/" + b.kind, {
            headers: token ? { Authorization: "Bearer " + token } : {},
          });
          if (!res.ok) continue;
          bgCache[key] = await blobToDataUri(await res.blob());
        }
        backgrounds[b.kind] = bgCache[key];
      }
      current = {
        mode: dto.mode ?? "computer",
        disabled: dto.disabled ?? [],
        labTests: dto.labTests && dto.labTests.length ? dto.labTests : null,
        backgrounds,
      };
      loadedAt = Date.now();
    } catch {
      /* keep the last known settings */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function getPrintPolicy(): PrintPolicy {
  return current;
}

/** The message to show when the Admin has switched this document (or all printing) off; null = go ahead. */
export function printBlockedMessage(kind: PrintKind, label: string): string | null {
  if (current.mode === "off") return "Printing is turned off by the clinic.";
  if (current.disabled.indexOf(kind) >= 0) return label + " printing is turned off by the clinic.";
  return null;
}

/** Puts the clinic's background picture on the form sheet (same rule as the desktop's PrintBackground). */
export function withBackground(kind: PrintKind, html: string): string {
  const uri = current.backgrounds[kind];
  if (!uri) return html;
  const style =
    "<style>.form{background:#fff url(" + uri + ") no-repeat 0 0 / 100% 100% !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    ".write-lbl{background:transparent !important}</style>";
  return style + html;
}

// start loading as soon as a page that can print is open, so the settings are ready by the time of the first click
if (typeof window !== "undefined") void loadPrintPolicy();
//JJQR - END
