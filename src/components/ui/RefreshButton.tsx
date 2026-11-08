"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button variant="secondary" loading={pending} onClick={() => startTransition(() => router.refresh())}>Reload clinic details</Button>;
}
