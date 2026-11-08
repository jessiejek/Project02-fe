"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function Error({ unstable_retry }: {
  error: Error & { digest?: string }; unstable_retry: () => void;
}) {
  return <div className="mx-auto max-w-[40rem] p-lg"><ErrorState title="This page could not be loaded" message="Please try again. If the problem continues, come back later." onRetry={unstable_retry} /></div>;
}
