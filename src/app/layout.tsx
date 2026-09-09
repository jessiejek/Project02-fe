import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { getServerSession } from "@/lib/auth/session";

// Icons were originally Material Symbols, loaded via a runtime <link> to
// Google Fonts — that CDN request silently fails in network-sandboxed
// environments, which rendered every icon in the app as raw ligature text
// (e.g. the literal word "warning") instead of a glyph. Font Awesome ships as
// bundled SVG with the app's own JS (see components/ui/Icon.tsx), so it has
// no runtime network dependency.
config.autoAddCss = false;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Dr. Grace Gavino Medical Clinic",
  description: "Patient, staff, doctor, and admin portals for Dr. Grace Gavino Medical Clinic.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // AUTH_MODE=dotnet: resolved from the .NET JWT cookie. AUTH_MODE=supabase: null
  // (the client SessionProvider loads it itself, unchanged).
  const initialSession = await getServerSession();

  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <SessionProvider initialSession={initialSession}>{children}</SessionProvider>
      </body>
    </html>
  );
}
