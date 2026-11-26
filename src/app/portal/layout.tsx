import StaffShell from "@/components/portal/StaffShell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
