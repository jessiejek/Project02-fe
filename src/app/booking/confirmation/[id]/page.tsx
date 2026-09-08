import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Stitch screen_12_booking_confirmation. Uses queue # from the query string
// (mock stand-in for the real POST /api/bookings response per Patient.md §5).
export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string }>;
}) {
  const { queue } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low p-lg">
      <Card className="w-full max-w-[28rem] text-center">
        <Icon name="check_circle" className="mb-md text-[56px] text-primary" />
        <h1 className="mb-sm text-headline-md text-on-surface">Booking Confirmed</h1>
        {queue && <p className="mb-md text-headline-lg text-primary">{queue}</p>}
        <p className="mb-lg text-body-md text-on-surface-variant">
          You&apos;ll receive a confirmation once your booking is verified.
        </p>
        <div className="flex flex-col gap-sm">
          <Link href="/patient/bookings">
            <Button className="w-full">Go to My Bookings</Button>
          </Link>
          <Link href="/patient/dashboard">
            <Button variant="secondary" className="w-full">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
