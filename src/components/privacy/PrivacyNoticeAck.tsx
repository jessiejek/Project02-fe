"use client";

//JJQR - AI (Nov 23, 2026) - Data Privacy Act (PH): when the front desk registers a patient, the clinic's privacy notice must be shown to them first. This box carries the notice wording and the required tick
// ("I have shown the patient the privacy notice"). The tick is recorded in the audit log by the server (recordPrivacyNoticeShown); it is never the patient's own consent, which they give in the patient portal.
import { hintStyles } from "@/components/ui/fieldStyles";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  className?: string;
}

export function PrivacyNoticeAck({ checked, onChange, id = "privacy-notice-shown", className }: Props) {
  return (
    <div className={`rounded-lg border border-status-info-border bg-status-info-surface p-md ${className ?? ""}`}>
      <p className="text-label-md font-medium text-on-surface">Privacy notice (Data Privacy Act)</p>
      <p className="mt-xs text-body-md text-on-surface-variant">
        Before registering, show the patient the clinic&apos;s privacy notice: what personal and health information is collected, why, who can see it, and their rights to access, correct and object.
        The patient gives their own consent in the patient portal.
      </p>
      <label htmlFor={id} className="mt-sm flex min-h-11 items-start gap-sm text-body-md text-on-surface">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 accent-primary" />
        <span>
          I have shown the patient the privacy notice <span aria-hidden="true">*</span>
          <span className={`block ${hintStyles}`}>
            Required. This is recorded in the audit log.{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Read the notice</a>
          </span>
        </span>
      </label>
    </div>
  );
}
//JJQR - END
