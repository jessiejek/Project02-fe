import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_MODE } from "@/lib/auth/mode";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { decodeJwt, isExpired } from "@/lib/auth/jwt";
import { dotnetAuth } from "@/lib/auth/dotnet";

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

/** Redirect helper: enforce that the first path segment matches the user's role. */
function gate(request: NextRequest, role: string | undefined, response: NextResponse): NextResponse {
  const { pathname } = request.nextUrl;
  const ownSegment = role ? ROLE_TO_SEGMENT[role] : undefined;

  if (!ownSegment) {
    if (isPublicPath(pathname)) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const firstSegment = pathname.split("/")[1];
  if (ROLE_SEGMENTS.has(firstSegment) && firstSegment !== ownSegment) {
    return NextResponse.redirect(new URL(`/${ownSegment}/dashboard`, request.url));
  }
  if (pathname === "/login") {
    return NextResponse.redirect(new URL(`/${ownSegment}/dashboard`, request.url));
  }
  return response;
}

export async function proxy(request: NextRequest) {
  return AUTH_MODE === "dotnet" ? proxyDotnet(request) : proxySupabase(request);
}

// ── AUTH_MODE=dotnet ─────────────────────────────────────────────────────────
async function proxyDotnet(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  let token = request.cookies.get(ACCESS_COOKIE)?.value;
  let claims = token ? decodeJwt(token) : null;

  // Silent refresh when the access token is missing/expired but a refresh token exists.
  if ((!claims || isExpired(claims)) && request.cookies.get(REFRESH_COOKIE)?.value) {
    const refreshed = await dotnetAuth.refresh(request.cookies.get(REFRESH_COOKIE)!.value);
    if (refreshed.ok) {
      token = refreshed.data.accessToken;
      claims = decodeJwt(token);
      response.cookies.set(ACCESS_COOKIE, refreshed.data.accessToken, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60,
      });
      response.cookies.set(REFRESH_COOKIE, refreshed.data.refreshToken, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7,
      });
    } else {
      claims = null;
    }
  }

  const role = claims && !isExpired(claims) ? (claims.role as string | undefined) : undefined;
  return gate(request, role, response);
}

// ── AUTH_MODE=supabase (unchanged) ───────────────────────────────────────────
async function proxySupabase(request: NextRequest): Promise<NextResponse> {
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
    return NextResponse.redirect(new URL("/login", request.url));
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
    // Exclude Next internals, static assets, and route handlers under /api
    // (e.g. /api/session/* — those authenticate the request themselves).
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
