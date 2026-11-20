//JJQR - AI (Nov 14, 2026)
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Only same-origin document navigations are intercepted, and then only with
// NetworkOnly (no page HTML is cached — every page is per-user because the
// root layout reads the session). Requests to /api/session/*, /api/auth/*,
// /logout, RSC fetches, and any cross-origin request (the .NET API) are not
// matched, so they go straight to the network and a Clear-Site-Data header
// on /logout is honored. Do not use defaultCache.

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) =>
        url.origin === self.location.origin &&
        request.mode === "navigate" &&
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/logout") &&
        !url.pathname.startsWith("/serwist") &&
        !url.pathname.startsWith("/~offline"),
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
//JJQR - END
