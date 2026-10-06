/**
 * Outbound email and text transports for nurture sends, sign-in links and staff
 * alerts. Nothing leaves the building unless OUTBOUND_SEND_MODE=live AND a real
 * transport is fully configured; every other combination logs what would have
 * been sent (dry run). Production refuses "live" with a half-configured
 * transport rather than silently falling back to the log.
 *
 * Adapters call the providers' HTTP APIs with fetch, so no SDK is needed:
 *   email: Postmark (EMAIL_TRANSPORT=postmark)
 *   text:  Twilio   (SMS_TRANSPORT=twilio)
 * Verify request shapes against the providers' current docs before going live.
 */
export type SendMode = "log" | "live";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Postmark message stream: "outbound" (transactional) or "broadcast" (marketing) */
  stream?: "transactional" | "marketing";
  headers?: Record<string, string>;
  /** Template key or purpose, for logs. Never the body. */
  tag?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
  tag?: string;
}

export interface SendResult {
  providerId: string;
  dryRun: boolean;
}

export interface EmailTransport {
  readonly name: string;
  readonly dryRun: boolean;
  send(msg: EmailMessage): Promise<SendResult>;
}

export interface SmsTransport {
  readonly name: string;
  readonly dryRun: boolean;
  send(msg: SmsMessage): Promise<SendResult>;
}

export class TransportConfigError extends Error {}

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

export function sendModeFromEnv(env: Env = process.env): SendMode {
  return env.OUTBOUND_SEND_MODE === "live" ? "live" : "log";
}

/** Addresses in logs are masked: enough to debug, not enough to identify anyone. */
export function maskAddress(addr: string): string {
  const at = addr.indexOf("@");
  if (at > 0) return `${addr[0]}***${addr.slice(at)}`;
  const digits = addr.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-2)}` : "***";
}

let logSeq = 0;
const logId = (kind: string) => `log-${kind}-${Date.now().toString(36)}-${(logSeq++).toString(36)}`;

export class LogEmailTransport implements EmailTransport {
  readonly name = "log";
  readonly dryRun = true;
  readonly sent: EmailMessage[] = [];
  constructor(private readonly quiet = false) {}
  async send(msg: EmailMessage): Promise<SendResult> {
    this.sent.push(msg);
    if (!this.quiet) console.log(`[email dry-run] to=${maskAddress(msg.to)} tag=${msg.tag ?? "-"} subject="${msg.subject}"`);
    return { providerId: logId("email"), dryRun: true };
  }
}

export class LogSmsTransport implements SmsTransport {
  readonly name = "log";
  readonly dryRun = true;
  readonly sent: SmsMessage[] = [];
  constructor(private readonly quiet = false) {}
  async send(msg: SmsMessage): Promise<SendResult> {
    this.sent.push(msg);
    if (!this.quiet) console.log(`[sms dry-run] to=${maskAddress(msg.to)} tag=${msg.tag ?? "-"} chars=${msg.body.length}`);
    return { providerId: logId("sms"), dryRun: true };
  }
}

async function failIfNotOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  // Provider error bodies can echo the recipient; keep only the status in the message.
  throw new Error(`${provider} responded ${res.status}`);
}

export class PostmarkEmailTransport implements EmailTransport {
  readonly name = "postmark";
  readonly dryRun = false;
  constructor(
    private readonly opts: { serverToken: string; from: string; marketingStream?: string },
    private readonly fetchImpl: Fetch = fetch,
  ) {}
  async send(msg: EmailMessage): Promise<SendResult> {
    const res = await this.fetchImpl("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "X-Postmark-Server-Token": this.opts.serverToken },
      body: JSON.stringify({
        From: this.opts.from,
        To: msg.to,
        Subject: msg.subject,
        TextBody: msg.text,
        HtmlBody: msg.html,
        Tag: msg.tag,
        MessageStream: msg.stream === "marketing" ? (this.opts.marketingStream ?? "broadcast") : "outbound",
        Headers: Object.entries(msg.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    await failIfNotOk(res, "Postmark");
    const json = (await res.json().catch(() => ({}))) as { MessageID?: string };
    return { providerId: json.MessageID ?? "postmark", dryRun: false };
  }
}

export class TwilioSmsTransport implements SmsTransport {
  readonly name = "twilio";
  readonly dryRun = false;
  constructor(
    private readonly opts: { accountSid: string; authToken: string; messagingServiceSid?: string; from?: string; statusCallback?: string },
    private readonly fetchImpl: Fetch = fetch,
  ) {
    if (!opts.messagingServiceSid && !opts.from) throw new TransportConfigError("Twilio needs TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM");
  }
  async send(msg: SmsMessage): Promise<SendResult> {
    const form = new URLSearchParams({ To: msg.to, Body: msg.body });
    if (this.opts.messagingServiceSid) form.set("MessagingServiceSid", this.opts.messagingServiceSid);
    else form.set("From", this.opts.from!);
    if (this.opts.statusCallback) form.set("StatusCallback", this.opts.statusCallback);
    const auth = Buffer.from(`${this.opts.accountSid}:${this.opts.authToken}`).toString("base64");
    const res = await this.fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.opts.accountSid)}/Messages.json`, {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    await failIfNotOk(res, "Twilio");
    const json = (await res.json().catch(() => ({}))) as { sid?: string };
    return { providerId: json.sid ?? "twilio", dryRun: false };
  }
}

/**
 * The email transport for this process. Log mode always logs. Live mode needs
 * EMAIL_TRANSPORT=postmark, POSTMARK_SERVER_TOKEN and EMAIL_FROM, or it throws.
 */
export function emailTransportFromEnv(env: Env = process.env, fetchImpl: Fetch = fetch): EmailTransport {
  if (sendModeFromEnv(env) !== "live") return new LogEmailTransport();
  if (env.EMAIL_TRANSPORT === "postmark" && env.POSTMARK_SERVER_TOKEN && env.EMAIL_FROM) {
    return new PostmarkEmailTransport({ serverToken: env.POSTMARK_SERVER_TOKEN, from: env.EMAIL_FROM, marketingStream: env.POSTMARK_MARKETING_STREAM }, fetchImpl);
  }
  throw new TransportConfigError("OUTBOUND_SEND_MODE=live needs EMAIL_TRANSPORT=postmark, POSTMARK_SERVER_TOKEN and EMAIL_FROM");
}

/**
 * The text transport for this process. Live mode needs SMS_TRANSPORT=twilio,
 * TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and a sender (messaging service or
 * number); texts also need 10DLC registration before carriers deliver them.
 */
export function smsTransportFromEnv(env: Env = process.env, fetchImpl: Fetch = fetch): SmsTransport {
  if (sendModeFromEnv(env) !== "live") return new LogSmsTransport();
  if (env.SMS_TRANSPORT === "twilio" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM)) {
    return new TwilioSmsTransport(
      {
        accountSid: env.TWILIO_ACCOUNT_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
        from: env.TWILIO_FROM,
        statusCallback: env.TWILIO_STATUS_CALLBACK_URL,
      },
      fetchImpl,
    );
  }
  throw new TransportConfigError("OUTBOUND_SEND_MODE=live needs SMS_TRANSPORT=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM");
}
