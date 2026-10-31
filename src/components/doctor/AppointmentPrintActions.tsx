"use client";

//JJQR - AI (Oct 31, 2026)
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  loadBookingPrintAvailability,
  printLabOrdersForBooking,
  printPrescriptionForBooking,
} from "@/lib/consult-print";

interface AppointmentPrintActionsProps {
  bookingId: string;
  /** Shorter labels for prior-consultation list rows */
  compact?: boolean;
  className?: string;
}

export function AppointmentPrintActions({ bookingId, compact, className }: AppointmentPrintActionsProps) {
  const [hasRx, setHasRx] = useState(false);
  const [hasLabs, setHasLabs] = useState(false);
  const [ready, setReady] = useState(false);
  const [printing, setPrinting] = useState<"rx" | "labs" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadBookingPrintAvailability(bookingId).then(({ hasRx: rx, hasLabs: labs }) => {
      if (cancelled) return;
      setHasRx(rx);
      setHasLabs(labs);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (!ready || (!hasRx && !hasLabs)) return null;

  const rxLabel = compact ? "Print Rx" : "Print Prescription";
  const labLabel = compact ? "Print Labs" : "Print Lab Orders";

  return (
    <div
      className={className ?? "flex flex-wrap gap-sm"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {hasRx && (
        <Button
          type="button"
          variant="secondary"
          loading={printing === "rx"}
          className={compact ? "text-label-sm" : undefined}
          onClick={() => {
            setPrinting("rx");
            void printPrescriptionForBooking(bookingId).finally(() => setPrinting(null));
          }}
        >
          <Icon name="print" className="text-[16px]" />
          {rxLabel}
        </Button>
      )}
      {hasLabs && (
        <Button
          type="button"
          variant="secondary"
          loading={printing === "labs"}
          className={compact ? "text-label-sm" : undefined}
          onClick={() => {
            setPrinting("labs");
            void printLabOrdersForBooking(bookingId).finally(() => setPrinting(null));
          }}
        >
          <Icon name="print" className="text-[16px]" />
          {labLabel}
        </Button>
      )}
    </div>
  );
}
//JJQR - END
