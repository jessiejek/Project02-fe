import type { ReactNode } from "react";
import "./doctor.css";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <div className="doctor-workspace">{children}</div>;
}
