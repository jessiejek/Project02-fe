"use client";

import { use, useEffect, useState } from "react";
import { useRouter, notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormAlert } from "@/components/ui/FormAlert";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { inputStyles, labelStyles } from "@/components/ui/fieldStyles";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import { cn } from "@/lib/cn";
import { useSession } from "@/components/providers/SessionProvider";
import { queryReviews, createReview } from "@/lib/data/patientFiles";
import { queryBookingById } from "@/lib/data/bookings";

interface ReviewBooking {
  id: string;
  doctorId: string;
  doctorName: string;
}

// Stitch screen_15_leave_a_review. Per Patient.md §14: only for Completed
// bookings, one review per booking/doctor pair — reviews.booking_id is
// unique in the real schema, so this checks for an existing review first
// and disables the form instead of letting a raw constraint-violation
// surface on a second submit (Implementation-Phases/06-booking-flow.md §6d).
export default function LeaveReviewPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const router = useRouter();
  const { session } = useSession();
  const [booking, setBooking] = useState<ReviewBooking | null | undefined>(undefined);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // Wait for session so we can enforce that this booking belongs to the
    // signed-in patient before showing the form (truthDare Phase 1.2).
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      let b, reviewRows;
      try {
        [b, reviewRows] = await Promise.all([
          queryBookingById(null as never, bookingId),
          queryReviews(null as never, { bookingId }),
        ]);
        setLoadError(false);
      } catch {
        setLoadError(true);
        return;
      }
      if (!b || b.patient_id !== patientId) {
        setBooking(null);
        return;
      }
      setBooking({
        id: b.booking_id,
        doctorId: b.doctor_id,
        doctorName: b.doctors?.staff_accounts?.full_name ?? "",
      });
      setAlreadyReviewed(reviewRows.length > 0);
    }
    load();
  }, [bookingId, session?.patientId, retryKey]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="patient">
        <div className="mx-auto max-w-[28rem]">
          {loadError ? (
            <ErrorState title="This review page didn’t load" message="Check your connection, then try again." onRetry={() => setRetryKey((k) => k + 1)} />
          ) : (
            <SkeletonCard lines={3} />
          )}
        </div>
      </AppShell>
    );
  }

  async function handleSubmit() {
    if (!booking || !session?.patientId || rating === 0) return;
    const patientId = session.patientId;
    setSubmitError("");
    setSubmitting(true);
    // Re-check ownership at submit time so a stale UI cannot insert a review
    // for someone else's booking if the session changed mid-page.
    let owned;
    try {
      owned = await queryBookingById(null as never, booking.id);
    } catch {
      setSubmitting(false);
      setSubmitError("Could not submit your review. Please try again.");
      return;
    }
    if (!owned || owned.patient_id !== patientId) {
      setSubmitting(false);
      setSubmitError("You can only review your own appointments.");
      return;
    }
    try {
      await createReview(null as never, {
        booking_id: booking.id,
        doctor_id: booking.doctorId,
        patient_id: patientId,
        rating,
        comment: comment || null,
      });
    } catch {
      setSubmitting(false);
      setSubmitError("Could not submit your review. Please try again.");
      return;
    }
    setSubmitting(false);
    router.push(`/patient/bookings/${booking.id}`);
  }

  const ratingWords = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  return (
    <AppShell role="patient">
      <div className="mx-auto max-w-[28rem] space-y-lg">
        <Link href={`/patient/bookings/${booking.id}`} className="inline-flex min-h-11 items-center gap-xs text-label-md font-medium text-primary hover:underline">
          <Icon name="chevron_left" className="text-[14px]" />
          Back to booking
        </Link>
        <Card className="space-y-lg">
          <header className="space-y-xs">
            <h1 className="text-balance text-headline-lg-mobile text-on-surface">Rate your visit with {booking.doctorName || "your doctor"}</h1>
            <p className="text-body-md text-on-surface-variant">Your rating helps other patients choose a doctor.</p>
          </header>

          {alreadyReviewed ? (
            <div className="space-y-md">
              <FormAlert tone="info">You&apos;ve already reviewed this visit. Thank you.</FormAlert>
              <Link href={`/patient/bookings/${booking.id}`} className={buttonStyles("secondary")}>Back to booking</Link>
            </div>
          ) : (
            <form className="space-y-lg" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              {submitError && <FormAlert>{submitError}</FormAlert>}
              <fieldset className="min-w-0 space-y-sm">
                <legend className={labelStyles}>Rating</legend>
                <div role="radiogroup" aria-label="Rating" className="flex gap-xs">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      onClick={() => setRating(star)}
                      aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg transition-transform duration-150 active:scale-90 motion-reduce:active:scale-100"
                    >
                      <FontAwesomeIcon
                        icon={star <= rating ? faStar : faStarOutline}
                        className={cn("text-[28px]", star <= rating ? "text-tertiary" : "text-outline")}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-label-md text-on-surface-variant" aria-live="polite">{rating ? ratingWords[rating] : "Tap a star"}</p>
              </fieldset>
              <div className="space-y-xs">
                <label htmlFor="comment" className={labelStyles}>Comment <span className="font-normal text-on-surface-variant">(optional)</span></label>
                <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className={inputStyles("py-md")} />
              </div>
              <Button type="submit" disabled={rating === 0} loading={submitting} className="w-full">
                {submitting ? "Sending…" : "Send review"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
