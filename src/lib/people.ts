/** "Riley" from "Riley Morgan" */
export const firstNameOf = (full: string) => full.trim().split(/\s+/)[0] || full;

/** "r•••@example.com": enough to recognise the address without repeating it in full */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return domain ? `${user.slice(0, 1)}•••@${domain}` : "•••";
}
