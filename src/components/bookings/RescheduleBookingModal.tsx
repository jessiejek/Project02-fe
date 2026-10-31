"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DatePicker } from "@/components/ui/DatePicker";
import { todayManila } from "@/lib/clock";

//JJQR - AI (Oct 31, 2026)
export function RescheduleBookingModal({
  isOpen,
  onClose,
  onConfirm,
  submitting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (appointmentDate: string, reason: string) => void | Promise<void>;
  submitting?: boolean;
  error?: string;
}) {
  const [appointmentDate, setAppointmentDate] = useState(todayManila());
  const [reason, setReason] = useState("");

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (submitting) return;
        onClose();
        setReason("");
      }}
      title="Reschedule Booking"
      footer={
        <>
          <Button variant="secondary" disabled={submitting} onClick={() => { onClose(); setReason(""); }}>
            Back
          </Button>
          <Button
            disabled={submitting || !appointmentDate}
            onClick={() => void onConfirm(appointmentDate, reason.trim())}
          >
            {submitting ? "Saving…" : "Confirm Reschedule"}
          </Button>
        </>
      }
    >
      <div className="space-y-md">
        <div className="space-y-xs">
          <label className="text-label-md text-on-surface-variant">New appointment date</label>
          <DatePicker value={appointmentDate} onChange={setAppointmentDate} />
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="w-full rounded-lg border border-outline-variant p-md text-body-md"
          rows={3}
        />
        {error && (
          <p className="rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{error}</p>
        )}
      </div>
    </Modal>
  );
}
//JJQR - END
