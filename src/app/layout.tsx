//JJQR - AI (Nov 14, 2026)
import type { Metadata, Viewport } from "next";
//JJQR - END
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { getServerSession } from "@/lib/auth/session";
//JJQR - AI (Nov 14, 2026)
import { SerwistProvider } from "@serwist/turbopack/react";
import { NetworkStatusBanner } from "@/components/pwa/NetworkStatusBanner";
//JJQR - END

// Icons were originally Material Symbols, loaded via a runtime <link> to
// Google Fonts — that CDN request silently fails in network-sandboxed
// environments, which rendered every icon in the app as raw ligature text
// (e.g. the literal word "warning") instead of a glyph. Font Awesome ships as
// bundled SVG with the app's own JS (see components/ui/Icon.tsx), so it has
// no runtime network dependency.
config.autoAddCss = false;


export const metadata: Metadata = {
  title: "Dr. Grace Gavino Medical Clinic",
  description: "Patient, staff, doctor, and admin portals for Dr. Grace Gavino Medical Clinic.",
  //JJQR - AI (Nov 14, 2026)
  applicationName: "Dr. Grace Gavino Medical Clinic",
  appleWebApp: { capable: true, title: "Gavino Clinic", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  //JJQR - END
};

//JJQR - AI (Nov 14, 2026)
export const viewport: Viewport = { themeColor: "#00685f" };

const swDisabled =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_SW_DEV !== "1";
//JJQR - END

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // AUTH_MODE=dotnet: resolved from the .NET JWT cookie. AUTH_MODE=supabase: null
  // (the client SessionProvider loads it itself, unchanged).
  const initialSession = await getServerSession();

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full font-sans antialiased">
        {/* JJQR - AI (Nov 14, 2026) */}
        <NetworkStatusBanner />
        <SerwistProvider swUrl="/sw.js" disable={swDisabled} cacheOnNavigation={false} reloadOnOnline={false}>
          <SessionProvider initialSession={initialSession}>{children}</SessionProvider>
        </SerwistProvider>
        {/* JJQR - END */}
      </body>
    </html>
  );
}
