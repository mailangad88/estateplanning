/**
 * Staff notifications (SLA alerts, paging). Messages must never contain client
 * names or case facts: a subject, a short generic text and a portal link path.
 */
import { emailTransportFromEnv, sendModeFromEnv, type EmailTransport } from "@/server/notify/transports";
export interface NotifyTarget {
  userId: string;
  email?: string;
  phone?: string;
}

export interface NotifyMessage {
  subject: string;
  text: string;
  /** Portal path, for example /portal/queue */
  link: string;
}

export interface Notifier {
  send(to: NotifyTarget, message: NotifyMessage): Promise<void>;
}

/** Development notifier: prints to the server log. */
export class ConsoleNotifier implements Notifier {
  async send(to: NotifyTarget, message: NotifyMessage): Promise<void> {
    console.log(`[notify] to=${to.userId} subject="${message.subject}" text="${message.text}" link=${message.link}`);
  }
}

/** Emails staff through the configured transport. The body is the generic alert text plus a portal link. */
export class EmailNotifier implements Notifier {
  constructor(private readonly email: EmailTransport, private readonly baseUrl: string) {}
  async send(to: NotifyTarget, message: NotifyMessage): Promise<void> {
    if (!to.email) return;
    const link = `${this.baseUrl.replace(/\/$/, "")}${message.link}`;
    await this.email.send({ to: to.email, subject: message.subject, text: `${message.text}\n\nOpen the portal: ${link}`, stream: "transactional", tag: "staff-alert" });
  }
}

/**
 * Staff alerts go by email once sending is live (OUTBOUND_SEND_MODE=live with a
 * configured transport). Until then they are logged; production refuses to log
 * only unless NOTIFY_ALLOW_CONSOLE=true. A Slack webhook adapter can slot in here.
 */
export function notifierFromEnv(env: Record<string, string | undefined> = process.env): Notifier {
  if (sendModeFromEnv(env) === "live") return new EmailNotifier(emailTransportFromEnv(env), env.APP_URL ?? "http://localhost:3000");
  if (env.NODE_ENV === "production" && env.NOTIFY_ALLOW_CONSOLE !== "true") {
    throw new Error("No production notifier is configured. Set OUTBOUND_SEND_MODE=live with an email transport, or NOTIFY_ALLOW_CONSOLE=true to log alerts only.");
  }
  return new ConsoleNotifier();
}
