import StaffShell from "@/components/portal/StaffShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
