//JJQR - AI (Nov 19, 2026) - new file: browser Back guard for the templates side panel.
// While the panel has unsaved edits we keep one extra "sentinel" history entry on top. Back pops the sentinel (the page does not
// change), the panel re-arms it and shows the discard prompt. Closing the panel pops the sentinel again BEFORE the URL is replaced,
// so a normal save/cancel leaves no stray history entry behind.
let armed = false;
let releasing = false;

export const isGuardArmed = () => armed;
export const isReleasingGuard = () => releasing;

/** Push the sentinel (same URL) once. Safe to call repeatedly. */
export function armHistoryGuard(): void {
  if (armed || typeof window === "undefined") return;
  window.history.pushState({ ...(window.history.state ?? {}), tplGuard: true }, "", window.location.href);
  armed = true;
}

/** The user pressed Back: the browser already popped the sentinel. */
export function markGuardConsumed(): void {
  armed = false;
}

/** Run `then` once the sentinel (if any) is gone. With no sentinel it runs immediately. */
export function releaseHistoryGuard(then: () => void): void {
  if (!armed || typeof window === "undefined") {
    then();
    return;
  }
  armed = false;
  releasing = true;
  const done = () => {
    window.removeEventListener("popstate", done);
    releasing = false;
    then();
  };
  window.addEventListener("popstate", done);
  window.history.go(-1);
}
//JJQR - END
