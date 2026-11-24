//JJQR - AI (Nov 24, 2026) - owner: the buyer said no online booking, so patients can no longer register themselves on the web. This page only explains that.
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { buttonStyles } from "@/components/ui/buttonStyles";

export default function RegisterClosedPage() {
  return (
    <AuthShell
      title="Online registration is closed"
      description="Please register at the clinic's front desk. The staff will register you when you arrive."
      footer={<Link href="/login" className="font-medium text-primary hover:underline">Back to log in</Link>}
    >
      <Link href="/login" className={buttonStyles("primary", "w-full")}>Log in</Link>
    </AuthShell>
  );
}
//JJQR - END
