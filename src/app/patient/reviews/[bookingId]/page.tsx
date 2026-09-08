"use client";

import { use, useEffect, useState } from "react";
import { useRouter, notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { faStar as faStarOutline } from "@fortawesome/free-regular-svg-icons";
import { cn } from "@/lib/cn";
import { useSession } from "@/components/providers/SessionProvider";
import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    // Wait for session so we can enforce that this booking belongs to the
    // signed-in patient before showing the form (truthDare Phase 1.2).
    if (!session?.patientId) return;
    const patientId = session.patientId;
    async function load() {
      const supabase = createClient();
      const [bookingRes, reviewRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("booking_id, doctor_id, patient_id, doctors(staff_accounts(full_name))")
          .eq("booking_id", bookingId)
          .eq("patient_id", patientId)
          .maybeSingle(),
        supabase.from("reviews").select("review_id").eq("booking_id", bookingId).maybeSingle(),
      ]);
      if (!bookingRes.data) {
        setBooking(null);
        return;
      }
      const b = bookingRes.data;
      const doctor = Array.isArray(b.doctors) ? b.doctors[0] : b.doctors;
      const doctorStaff = doctor ? (Array.isArray(doctor.staff_accounts) ? doctor.staff_accounts[0] : doctor.staff_accounts) : undefined;
      setBooking({ id: b.booking_id, doctorId: b.doctor_id, doctorName: doctorStaff?.full_name ?? "" });
      setAlreadyReviewed(!!reviewRes.data);
    }
    load();
  }, [bookingId, session?.patientId]);

  if (booking === null) notFound();
  if (booking === undefined) {
    return (
      <AppShell role="patient">
        <p className="text-body-md text-on-surface-variant">Loading…</p>
      </AppShell>
    );
  }

  async function handleSubmit() {
    if (!booking || !session?.patientId || rating === 0) return;
    const patientId = session.patientId;
    setSubmitError("");
    setSubmitting(true);
    const supabase = createClient();
    // Re-check ownership at submit time so a stale UI cannot insert a review
    // for someone else's booking if the session changed mid-page.
    const { data: owned } = await supabase
      .from("bookings")
      .select("booking_id")
      .eq("booking_id", booking.id)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (!owned) {
      setSubmitting(false);
      setSubmitError("You can only review your own visits.");
      return;
    }
    const { error } = await supabase.from("reviews").insert({
      booking_id: booking.id,
      doctor_id: booking.doctorId,
      patient_id: patientId,
      rating,
      comment: comment || null,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError("Could not submit your review. Please try again.");
      return;
    }
    router.push(`/patient/bookings/${booking.id}`);
  }

  return (
    <AppShell role="patient">
      <Card className="mx-auto max-w-[28rem] text-center">
        <div className="mb-md flex items-center justify-center gap-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high">
            <Icon name="person" className="text-[28px] text-on-surface-variant" />
          </div>
        </div>
        <h2 className="mb-xs text-headline-md text-on-surface">{booking.doctorName}</h2>

        {alreadyReviewed ? (
          <p className="text-body-md text-on-surface-variant">You&apos;ve already submitted a review for this visit.</p>
        ) : (
          <>
            <p className="mb-lg text-body-md text-on-surface-variant">How was your visit?</p>
            {submitError && <p className="mb-md rounded-lg bg-error-container px-md py-sm text-body-sm text-on-error-container">{submitError}</p>}
            <div className="mb-lg flex justify-center gap-xs">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`}>
                  <FontAwesomeIcon
                    icon={star <= rating ? faStar : faStarOutline}
                    className={cn("text-[36px]", star <= rating ? "text-tertiary" : "text-outline-variant")}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional comment"
              rows={4}
              className="mb-lg w-full rounded-lg border border-outline-variant p-md text-body-md"
            />
            <Button disabled={rating === 0 || submitting} className="w-full" onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit Review"}
            </Button>
          </>
        )}
      </Card>
    </AppShell>
  );
}
