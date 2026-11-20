//JJQR - AI (Nov 14, 2026)
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dr. Grace Gavino Medical Clinic",
    short_name: "Gavino Clinic",
    description: "Patient, staff, doctor, and admin portals for Dr. Grace Gavino Medical Clinic.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f9ff",
    theme_color: "#00685f",
    // Icons are PLACEHOLDERS, replace with the real clinic logo.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
//JJQR - END
