import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Role segments match the URL prefix exactly (/patient, /staff, /doctor,
// /admin) — profiles.role in the database is the PascalCase user_role enum
// ('Patient'/'Staff'/'Doctor'/'Admin'), so every check below maps between
// the two rather than assuming they're interchangeable.
const ROLE_TO_SEGMENT: Record<string, string> = {
  Patient: "patient",
  Staff: "staff",
  Doctor: "doctor",
  Admin: "admin",
};
const ROLE_SEGMENTS = new Set(Object.values(ROLE_TO_SEGMENT));

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/booking")
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Never remove this call. It refreshes the session cookie on every
  // request — without it, sessions silently expire mid-use even though
  // client-side code still thinks it's signed in.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublicPath(pathname)) return response;
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const firstSegment = pathname.split("/")[1];
  if (ROLE_SEGMENTS.has(firstSegment)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const ownSegment = profile ? ROLE_TO_SEGMENT[profile.role] : undefined;
    if (!ownSegment || ownSegment !== firstSegment) {
      const redirectTo = ownSegment ? `/${ownSegment}/dashboard` : "/login";
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  } else if (pathname === "/login") {
    // Already signed in — no reason to show the login form again.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const ownSegment = profile ? ROLE_TO_SEGMENT[profile.role] : undefined;
    if (ownSegment) return NextResponse.redirect(new URL(`/${ownSegment}/dashboard`, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
