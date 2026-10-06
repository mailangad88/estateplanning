/**
 * Pluggable sign-in. The first provider is an emailed single-use link; SSO
 * (Google Workspace, Microsoft 365) plugs in behind the same interface later.
 * The link only proves control of the mailbox. The portal still requires the
 * second factor (see flow.ts) before a full session exists.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { emailTransportFromEnv, sendModeFromEnv } from "@/server/notify/transports";

export interface IdentityProvider {
  /** Always resolves {delivered: true} so callers cannot learn whether an address has an account. */
  startSignIn(email: string, now?: Date): Promise<{ delivered: boolean }>;
  /** Returns the user id the token proves, or null when invalid, expired or already used. */
  completeSignIn(token: string, now?: Date): Promise<string | null>;
}

/**
 * TODO(sso): OIDC provider for Google Workspace / Microsoft 365. Shape only:
 *  - startSignIn(email) is replaced by an authorization redirect (`authorizeUrl(state, nonce)`)
 *  - completeSignIn(token) receives the authorization code, exchanges it at the token endpoint,
 *    verifies the id_token signature, issuer, audience, nonce and `email_verified`, then maps the
 *    verified email (and hosted domain `hd` / tenant `tid`) to an active User.
 *  - SSO sign-in must still be followed by our TOTP step unless the IdP asserts MFA (`amr`).
 */
export interface OidcProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedDomains?: string[];
}
export interface OidcProvider extends IdentityProvider {
  authorizeUrl(state: string, nonce: string): string;
}

export type SendEmail = (to: string, subject: string, text: string) => Promise<void>;

export const consoleSendEmail: SendEmail = async (to, subject, text) => {
  if (sendModeFromEnv() === "live") {
    await emailTransportFromEnv().send({ to, subject, text, stream: "transactional", tag: "sign-in" });
    return;
  }
  // Printing sign-in links is fine on a laptop and unsafe anywhere else.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Sign-in emails need OUTBOUND_SEND_MODE=live with an email transport (see src/server/notify/transports.ts)");
  }
  console.log(`[email mock] to=${to} subject=${subject}\n${text}`);
};

/** Sliding-window limiter, in memory. Swap for a shared store when running more than one instance. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(readonly max: number, readonly windowMs: number) {}
  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.set(key, list);
    return list;
  }
  isBlocked(key: string, now = Date.now()): boolean {
    return this.recent(key, now).length >= this.max;
  }
  record(key: string, now = Date.now()): void {
    this.recent(key, now).push(now);
  }
  reset(key: string): void {
    this.hits.delete(key);
  }
}

export const LINK_TTL_S = 15 * 60;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ characters)");
  return "development-only-session-secret-change-me";
}

/** HMAC-signed token with a purpose label so tokens of one kind cannot be used as another. */
export function signToken(purpose: string, payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", `${purpose}:${secret()}`).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function readToken<T>(purpose: string, token: string | undefined): T | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const want = Buffer.from(createHmac("sha256", `${purpose}:${secret()}`).update(data).digest("base64url"));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

export interface EmailLinkOptions {
  findUserId: (email: string) => Promise<string | null>;
  sendEmail?: SendEmail;
  baseUrl?: string;
  /** shared across requests: used link ids */
  usedIds?: Set<string>;
  sendLimiter?: RateLimiter;
}

interface LinkPayload {
  uid: string;
  jti: string;
  exp: number;
}

export class EmailLinkProvider implements IdentityProvider {
  private used: Set<string>;
  private limiter: RateLimiter;
  private send: SendEmail;
  constructor(private opts: EmailLinkOptions) {
    this.used = opts.usedIds ?? new Set();
    this.limiter = opts.sendLimiter ?? new RateLimiter(5, 3600_000);
    this.send = opts.sendEmail ?? consoleSendEmail;
  }

  async startSignIn(email: string, now = new Date()): Promise<{ delivered: boolean }> {
    const addr = email.trim().toLowerCase();
    if (!addr || addr.length > 254) return { delivered: true };
    if (this.limiter.isBlocked(addr, now.getTime())) return { delivered: true };
    this.limiter.record(addr, now.getTime());
    const uid = await this.opts.findUserId(addr);
    if (!uid) return { delivered: true };
    const exp = Math.floor(now.getTime() / 1000) + LINK_TTL_S;
    const token = signToken("link", { uid, jti: randomUUID(), exp } satisfies LinkPayload);
    const base = this.opts.baseUrl ?? process.env.APP_URL ?? "http://localhost:3000";
    try {
      await this.send(
        addr,
        "Your sign-in link",
        `Use this link to continue signing in. It works once and expires in 15 minutes.\n\n${base}/api/auth/link?token=${token}\n\nIf you did not ask for this, ignore this email.`,
      );
    } catch (e) {
      console.error("sign-in email failed", e instanceof Error ? e.message : "unknown error");
    }
    return { delivered: true };
  }

  async completeSignIn(token: string, now = new Date()): Promise<string | null> {
    const p = readToken<LinkPayload>("link", token);
    if (!p || typeof p.uid !== "string" || typeof p.jti !== "string") return null;
    if (Math.floor(now.getTime() / 1000) >= p.exp) return null;
    if (this.used.has(p.jti)) return null;
    this.used.add(p.jti);
    return p.uid;
  }
}

// ---- second-factor storage -------------------------------------------------

export interface MfaRecord {
  totpSecret: string;
  lastUsedStep: number;
  recoveryCodeHashes: string[];
  /** null until the first valid code confirms the authenticator */
  enrolledAt: string | null;
}

export interface MfaStore {
  get(userId: string): Promise<MfaRecord | null>;
  put(userId: string, record: MfaRecord): Promise<void>;
}

function encKey(): Buffer {
  const k = process.env.MFA_ENCRYPTION_KEY;
  if (k && k.length >= 32) return createHash("sha256").update(k).digest();
  if (process.env.NODE_ENV === "production") throw new Error("MFA_ENCRYPTION_KEY must be set (32+ characters)");
  return createHash("sha256").update("development-only-mfa-encryption-key").digest();
}

/** AES-256-GCM, output `iv.tag.ciphertext` in base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, ct] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export class MemoryMfaStore implements MfaStore {
  /** Exposed so tests can assert the secret is not stored in the clear. */
  readonly raw = new Map<string, Omit<MfaRecord, "totpSecret"> & { totpSecretEnc: string }>();
  async get(userId: string): Promise<MfaRecord | null> {
    const r = this.raw.get(userId);
    if (!r) return null;
    const { totpSecretEnc, ...rest } = r;
    return { ...rest, recoveryCodeHashes: [...rest.recoveryCodeHashes], totpSecret: decryptSecret(totpSecretEnc) };
  }
  async put(userId: string, record: MfaRecord): Promise<void> {
    const { totpSecret, ...rest } = record;
    this.raw.set(userId, { ...rest, recoveryCodeHashes: [...rest.recoveryCodeHashes], totpSecretEnc: encryptSecret(totpSecret) });
  }
}
