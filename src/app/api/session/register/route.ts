import { NextResponse } from "next/server";

//JJQR - AI (Nov 24, 2026) - owner: the buyer said no online booking, so patient self-registration is closed (the server refuses it too).
export async function POST() {
  return NextResponse.json({ error: "Online patient registration is closed. Please register at the clinic's front desk." }, { status: 403 });
}
//JJQR - END
