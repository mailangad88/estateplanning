/**
 * Staff notifications (SLA alerts, paging). Messages must never contain client
 * names or case facts: a subject, a short generic text and a portal link path.
 */
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

/**
 * TODO: Postmark adapter (email), Twilio adapter (SMS to on-call phones) and a
 * Slack webhook adapter, selected by NOTIFY_PROVIDER. Until one is wired, only
 * the console notifier exists.
 */
export function notifierFromEnv(): Notifier {
  if (process.env.NODE_ENV === "production" && process.env.NOTIFY_ALLOW_CONSOLE !== "true") {
    throw new Error("No production notifier is configured. Add a Postmark, Twilio or Slack adapter, or set NOTIFY_ALLOW_CONSOLE=true to log alerts only.");
  }
  return new ConsoleNotifier();
}
