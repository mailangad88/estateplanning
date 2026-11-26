"use client";
import { usePathname } from "next/navigation";

/** The staff portal (/portal, /admin) has its own app shell, so the marketing header, footer and contact widgets stay off there. */
export const isStaffPath = (path: string | null) => !!path && /^\/(portal|admin)(\/|$)/.test(path);

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  return isStaffPath(usePathname()) ? null : <>{children}</>;
}
