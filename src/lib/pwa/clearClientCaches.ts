//JJQR - AI (Nov 14, 2026)
export async function clearClientCaches(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Swallow: logout must still proceed if Cache Storage is unavailable.
  }
}
//JJQR - END
