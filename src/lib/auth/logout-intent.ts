//JJQR Nov 20, 2026 - one-click logout: survive a page reload that cancels the /logout navigation
// (in `next dev` the first hit of /logout compiles the route and Fast Refresh does a full reload of
// the current page, which cancels the in-flight navigation in Safari — the user had to click twice).
export const LOGOUT_PENDING_KEY = "clinic-logout-pending";
const MAX_AGE_MS = 20_000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function markLogoutPending(store: Store, now = Date.now()): void {
  try {
    store.setItem(LOGOUT_PENDING_KEY, String(now));
  } catch {
    // storage unavailable — the normal navigation still runs
  }
}

/** True when a logout was clicked in the last 20s but this page loaded anyway (the navigation was cancelled). */
export function isLogoutPending(store: Store, now = Date.now()): boolean {
  try {
    const raw = store.getItem(LOGOUT_PENDING_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || now - at > MAX_AGE_MS || now < at) {
      store.removeItem(LOGOUT_PENDING_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearLogoutPending(store: Store): void {
  try {
    store.removeItem(LOGOUT_PENDING_KEY);
  } catch {
    // ignore
  }
}
//JJQR - END
