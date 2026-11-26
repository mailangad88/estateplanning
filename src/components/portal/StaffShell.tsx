import { currentActor, getDb } from "@/server/runtime";
import { ROLE_LABEL, staffNav } from "@/server/portal/staffNav";
import ShellFrame from "./ShellFrame";

/** The staff app shell: grouped sidebar by role, a slim top bar with who is signed in, and the page. */
export default async function StaffShell({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  if (!actor || actor.role === "client") return <div className="staff-app staff-app--bare">{children}</div>;
  const user = await (await getDb()).users.get(actor.userId);
  return (
    <ShellFrame groups={staffNav(actor)} userName={user?.name ?? "Signed in"} roleLabel={ROLE_LABEL[actor.role]}>
      {children}
    </ShellFrame>
  );
}
