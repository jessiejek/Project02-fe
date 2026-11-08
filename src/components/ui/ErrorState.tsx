"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function ErrorState({ title, message, onRetry, retrying = false }: {
  title: string; message: string; onRetry: () => void; retrying?: boolean;
}) {
  return (
    <section role="alert" className="space-y-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg">
      <Icon name="error" className="text-status-danger" />
      <h2 className="text-headline-md text-on-surface">{title}</h2>
      <p className="text-body-md text-on-surface-variant">{message}</p>
      <Button variant="secondary" onClick={onRetry} loading={retrying}>Try again</Button>
    </section>
  );
}
