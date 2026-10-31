"use client";

import { Suspense, use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

//JJQR - AI (Oct 31, 2026)
// Canonical consult UI is consultation2. Keep this route as a redirect for deep links.
function ConsultationRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    router.replace(`/doctor/consultation2/${bookingId}${q ? `?${q}` : ""}`);
  }, [bookingId, router, search]);
  return null;
}

export default function ConsultationRedirectPage({ params }: { params: Promise<{ bookingId: string }> }) {
  return (
    <Suspense>
      <ConsultationRedirect params={params} />
    </Suspense>
  );
}
//JJQR - END
