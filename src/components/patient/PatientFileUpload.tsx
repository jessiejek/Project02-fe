"use client";

import type { ReactNode, RefObject } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FormAlert } from "@/components/ui/FormAlert";
import { inputStyles, labelStyles, hintStyles } from "@/components/ui/fieldStyles";
import { cn } from "@/lib/cn";

export interface BookingChoice { id: string; label: string }

/**
 * Upload form shared by Documents and Lab results: one visible file target,
 * the required booking link, one optional text field, and a single CTA.
 */
export function PatientFileUpload({
  heading, file, fileInputRef, onFile, bookings, bookingId, onBooking, textLabel, textValue, onText,
  uploading, onSubmit, error, success, submitLabel,
}: {
  heading: string; file: File | null; fileInputRef: RefObject<HTMLInputElement | null>; onFile: (f: File | null) => void;
  bookings: BookingChoice[]; bookingId: string; onBooking: (id: string) => void;
  textLabel: string; textValue: string; onText: (v: string) => void;
  uploading: boolean; onSubmit: () => void; error: string; success: string; submitLabel: ReactNode;
}) {
  return (
    <Card>
      <form className="space-y-md" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
        <h2 className="text-headline-sm text-on-surface">{heading}</h2>
        {error && <FormAlert>{error}</FormAlert>}
        {success && <FormAlert tone="success">{success}</FormAlert>}
        <label
          className={cn(
            "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-xs rounded-lg border border-dashed p-lg text-center transition-colors",
            "focus-within:ring-2 focus-within:ring-primary/20 hover:bg-surface-container-low",
            file ? "border-primary bg-surface-container-low" : "border-outline-variant",
          )}
        >
          <Icon name={file ? "description" : "upload_file"} className="text-[22px] text-primary" />
          <span className="break-all text-body-md font-medium text-on-surface">{file ? file.name : "Choose a file"}</span>
          <span className={hintStyles}>{file ? "Tap to pick a different file" : "PDF, image or Word document, up to 10 MB"}</span>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,application/pdf,image/*"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="space-y-xs">
            <label htmlFor="uploadBooking" className={labelStyles}>Visit it belongs to</label>
            <select id="uploadBooking" value={bookingId} onChange={(e) => onBooking(e.target.value)} className={inputStyles()}>
              <option value="">Select a visit</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            {bookings.length === 0 && <p className={hintStyles}>You need a booking before you can upload.</p>}
          </div>
          <div className="space-y-xs">
            <label htmlFor="uploadText" className={labelStyles}>{textLabel} <span className="font-normal text-on-surface-variant">(optional)</span></label>
            <input id="uploadText" value={textValue} onChange={(e) => onText(e.target.value)} className={inputStyles()} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={uploading} disabled={!bookingId || !file}>
            {uploading ? "Uploading…" : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** One uploaded file row: name, meta line, and an explicit Open action. */
export function PatientFileRow({ icon, title, meta, onOpen }: { icon: string; title: string; meta: ReactNode; onOpen: () => void }) {
  return (
    <li className="flex items-center gap-md px-lg py-md">
      <Icon name={icon} className="shrink-0 text-[18px] text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-md font-medium text-on-surface">{title}</p>
        <p className="text-label-md text-on-surface-variant">{meta}</p>
      </div>
      <Button variant="ghost" className="!min-h-11 !px-md" onClick={onOpen} aria-label={`Open ${title}`}>
        <Icon name="download" className="text-[14px]" />
        Open
      </Button>
    </li>
  );
}
