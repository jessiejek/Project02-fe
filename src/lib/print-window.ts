//JJQR - AI (2026-11-25) - owner (iPad): Safari only lets a page open a new window straight from a tap. Every print first waited for the server
// (6–9 s on the live host) and only then opened its window, so Safari blocked it. Now the window opens IN the tap with a "Preparing…" page,
// the data loads, and the print is written into that same window. Nothing to print = the window closes (the caller shows its own message).
// Blocked anyway = a clear "allow pop-ups" message. The desktop app (NEXT_PUBLIC_LOCAL_NODE=1) prints in a hidden frame and is unchanged.
// Plain module (no imports) so node:test can check it (print-window.test.mjs).

export const POPUP_BLOCKED_MESSAGE =
  "The print window was blocked. Allow pop-ups for this site (iPad: Settings → Safari → turn off Block Pop-ups), then try again.";

const PREPARING_HTML =
  '<!doctype html><title>Preparing…</title><body style="font-family:-apple-system,Segoe UI,sans-serif;padding:24px;color:#333">Preparing the print…</body>';

interface PrintWin { document: { write(html: string): void; close(): void }; close(): void }
interface Opener { open(url: string, target: string, features?: string): PrintWin | null; alert(message: string): void }

let reserved: { win: PrintWin; taken: boolean } | null = null;

/** The window opened by printAfterLoading for the print running now (once), or null. Used by printHtml / printForm instead of window.open. */
export function takeReservedPrintWindow<W = Window>(): W | null {
  if (!reserved || reserved.taken) return null;
  reserved.taken = true;
  return reserved.win as unknown as W;
}

/**
 * Call it straight from the tap, before any await: opens the print window now, then runs `job` (load data + print).
 * Returns the job's result; returns true (handled) when the browser blocked the window, after telling the user to allow pop-ups.
 */
export async function printAfterLoading(job: () => Promise<boolean>, opener?: Opener): Promise<boolean> {
  const w = opener ?? (typeof window === "undefined" ? undefined : (window as unknown as Opener));
  if (!w || process.env.NEXT_PUBLIC_LOCAL_NODE === "1") return job();
  const win = w.open("", "_blank", "width=800,height=900");
  if (!win) {
    w.alert(POPUP_BLOCKED_MESSAGE);
    return true;
  }
  try {
    win.document.write(PREPARING_HTML);
    win.document.close();
  } catch {
    // the window still works for the print itself
  }
  const slot = { win, taken: false };
  reserved = slot;
  try {
    return await job();
  } finally {
    if (reserved === slot) reserved = null;
    if (!slot.taken) {
      try { win.close(); } catch { /* already closed */ }
    }
  }
}
//JJQR - END
