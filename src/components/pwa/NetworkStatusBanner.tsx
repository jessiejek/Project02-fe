//JJQR - AI (Nov 14, 2026)
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function NetworkStatusBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [wasOnline, setWasOnline] = useState(true);
  const [showBackOnline, setShowBackOnline] = useState(false);

  if (online !== wasOnline) {
    setWasOnline(online);
    setShowBackOnline(online);
  }

  useEffect(() => {
    if (!showBackOnline) return;
    const timeoutId = window.setTimeout(() => setShowBackOnline(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [showBackOnline]);

  if (online && !showBackOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        online
          ? "fixed inset-x-0 top-0 z-[100] px-md py-sm text-center text-label-md bg-primary text-on-primary"
          : "fixed inset-x-0 top-0 z-[100] px-md py-sm text-center text-label-md bg-inverse-surface text-inverse-on-surface"
      }
    >
      {online ? "Back online" : "You're offline. Changes can't be saved until your connection is back."}
    </div>
  );
}
//JJQR - END
