import { AppShell } from "@/components/shell/AppShell";
import { DoctorForm } from "@/components/admin/DoctorForm";

export default function NewDoctorPage() {
  return (
    <AppShell role="admin">
      <DoctorForm mode="create" />
    </AppShell>
  );
}
