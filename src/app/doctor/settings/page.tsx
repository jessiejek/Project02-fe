import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DoctorPageHeader } from "@/components/doctor/DoctorPageHeader";
import { Icon } from "@/components/ui/Icon";

const SETTINGS = [
  { href: "/doctor/profile", icon: "account_circle", title: "Profile & prescribing details", text: "Update your name, specialization, professional numbers and password." },
  { href: "/doctor/schedule", icon: "schedule", title: "Clinic availability", text: "Manage weekly hours, daily patient limits and dates you are away." },
  { href: "/doctor/templates", icon: "description", title: "Consultation templates", text: "Manage reusable SOAP notes, diagnoses and certificate text." },
];
export default function DoctorSettingsPage() {
  return <AppShell role="doctor"><div className="space-y-xl"><DoctorPageHeader title="Practice settings" description="Choose what you need to update. Your consultation tools stay in one place." /><div className="grid gap-lg lg:grid-cols-3">{SETTINGS.map(item => <Link key={item.href} href={item.href} className="group flex flex-col gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg transition-colors hover:border-primary motion-reduce:transition-none"><Icon name={item.icon} className="h-6 w-6 text-primary" /><h2 className="text-headline-sm font-semibold text-on-surface">{item.title}</h2><p className="flex-1 text-body-md text-on-surface-variant">{item.text}</p><span className="flex items-center gap-sm text-label-md font-medium text-primary">Open settings<Icon name="arrow_forward" className="h-4 w-4" /></span></Link>)}</div></div></AppShell>;
}
