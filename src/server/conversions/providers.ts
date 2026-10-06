/**
 * Uploaders: a mock for development and tests, and provider stubs for Google Ads and the Meta
 * Conversions API. The stubs build real requests but only run with credentials, and in production
 * `uploaderFromEnv` refuses (throws) when credentials are missing rather than quietly using the mock.
 * Error messages carry statuses only, never response bodies (they can echo contact details).
 */
import type { GoogleConversionRow, MetaEvent } from "@/server/conversions/format";
import type { ConversionProvider, ConversionType } from "@/server/types";

export interface UploadItem<T> {
  /** Conversions log row id */
  id: string;
  payload: T;
}

export interface UploadResult {
  id: string;
  ok: boolean;
  /** When not ok: true if a later run could succeed (network error, 5xx, 429) */
  retryable?: boolean;
  error?: string;
}

export interface ConversionUploader<T> {
  readonly provider: ConversionProvider;
  /** "api" for a live provider, "mock" otherwise */
  readonly channel: "api" | "mock";
  upload(items: UploadItem<T>[]): Promise<UploadResult[]>;
}

export class ConversionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionConfigError";
  }
}

/** Accepts everything (or fails ids listed in `failIds`) and remembers what it was given. Never touches the network. */
export class MockUploader<T> implements ConversionUploader<T> {
  readonly channel = "mock" as const;
  readonly uploads: UploadItem<T>[] = [];
  constructor(
    readonly provider: ConversionProvider,
    private readonly failIds: ReadonlySet<string> = new Set(),
  ) {}

  async upload(items: UploadItem<T>[]): Promise<UploadResult[]> {
    return items.map((i) => {
      if (this.failIds.has(i.id)) return { id: i.id, ok: false, retryable: true, error: "mock failure" };
      this.uploads.push(i);
      return { id: i.id, ok: true };
    });
  }
}

type FetchLike = typeof fetch;

const failAll = (items: UploadItem<unknown>[], status: number | undefined, error: string): UploadResult[] =>
  items.map((i) => ({ id: i.id, ok: false, retryable: status === undefined || status === 429 || status >= 500, error }));

// ---------- Google Ads ----------

export interface GoogleAdsConfig {
  customerId: string;
  developerToken: string;
  /** OAuth2 access token with the adwords scope (refresh it outside this class) */
  accessToken: string;
  loginCustomerId?: string;
  /** Conversion type to the conversion action resource name, "customers/123/conversionActions/456" */
  conversionActions: Record<ConversionType, string>;
}

/** Verify against the current Google Ads API version before going live. */
export const GOOGLE_ADS_API_VERSION = "v21";

/** Google Ads offline click conversion upload (ConversionUploadService.UploadClickConversions) with enhanced conversions for leads. */
export class GoogleAdsUploader implements ConversionUploader<GoogleConversionRow & { type: ConversionType }> {
  readonly provider = "google_ads" as const;
  readonly channel = "api" as const;
  constructor(
    private readonly cfg: GoogleAdsConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async upload(items: UploadItem<GoogleConversionRow & { type: ConversionType }>[]): Promise<UploadResult[]> {
    const conversions = items.map(({ payload: r }) => ({
      [r.clickIdKind]: r.clickId,
      conversionAction: this.cfg.conversionActions[r.type],
      conversionDateTime: r.conversionTime,
      ...(r.value !== undefined ? { conversionValue: r.value, currencyCode: r.currency } : {}),
      orderId: r.orderId,
      userIdentifiers: [
        ...(r.hashedEmail ? [{ hashedEmail: r.hashedEmail }] : []),
        ...(r.hashedPhone ? [{ hashedPhoneNumber: r.hashedPhone }] : []),
      ],
    }));
    let res: Response;
    try {
      res = await this.fetchImpl(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${this.cfg.customerId}:uploadClickConversions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.cfg.accessToken}`,
          "developer-token": this.cfg.developerToken,
          "content-type": "application/json",
          ...(this.cfg.loginCustomerId ? { "login-customer-id": this.cfg.loginCustomerId } : {}),
        },
        body: JSON.stringify({ conversions, partialFailure: true }),
      });
    } catch {
      return failAll(items, undefined, "network error");
    }
    if (!res.ok) return failAll(items, res.status, `HTTP ${res.status}`);
    // With partialFailure the call returns 200 and lists failed rows by index. Rows not listed succeeded.
    const body = (await res.json().catch(() => ({}))) as { partialFailureError?: { details?: { errors?: { location?: { fieldPathElements?: { fieldName?: string; index?: number }[] } }[] }[] } };
    if (!body.partialFailureError) return items.map((i) => ({ id: i.id, ok: true }));
    const bad = new Set<number>();
    for (const d of body.partialFailureError.details ?? []) {
      for (const e of d.errors ?? []) {
        const idx = e.location?.fieldPathElements?.find((p) => p.fieldName === "conversions")?.index;
        if (idx !== undefined) bad.add(idx);
      }
    }
    // Could not tell which rows failed: treat all as retryable so nothing is lost. The order id makes a resend safe.
    if (bad.size === 0) return failAll(items, 500, "partial failure");
    return items.map((i, n) => (bad.has(n) ? { id: i.id, ok: false, retryable: false, error: "rejected by Google Ads" } : { id: i.id, ok: true }));
  }
}

// ---------- Meta Conversions API ----------

export interface MetaCapiConfig {
  pixelId: string;
  accessToken: string;
  /** Events Manager "Test events" code. Test events do not count toward ad delivery. */
  testEventCode?: string;
}

/** Verify against the current Graph API version before going live. */
export const META_GRAPH_VERSION = "v21.0";

export class MetaCapiUploader implements ConversionUploader<MetaEvent> {
  readonly provider = "meta" as const;
  readonly channel = "api" as const;
  constructor(
    private readonly cfg: MetaCapiConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async upload(items: UploadItem<MetaEvent>[]): Promise<UploadResult[]> {
    let res: Response;
    try {
      res = await this.fetchImpl(`https://graph.facebook.com/${META_GRAPH_VERSION}/${this.cfg.pixelId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: items.map((i) => i.payload),
          access_token: this.cfg.accessToken,
          ...(this.cfg.testEventCode ? { test_event_code: this.cfg.testEventCode } : {}),
        }),
      });
    } catch {
      return failAll(items, undefined, "network error");
    }
    if (!res.ok) return failAll(items, res.status, `HTTP ${res.status}`);
    return items.map((i) => ({ id: i.id, ok: true }));
  }
}

// ---------- Selection from the environment ----------

type Env = Record<string, string | undefined>;

/**
 * Live Google Ads uploader when GOOGLE_ADS_* credentials are set. Without them: the mock outside production,
 * and a ConversionConfigError in production (the sweep then leaves the rows pending and reports the refusal).
 * GOOGLE_ADS_CONVERSION_ACTIONS is JSON: {"qualified_lead":"customers/1/conversionActions/2", ...}.
 */
export function googleUploaderFromEnv(env: Env = process.env, fetchImpl?: FetchLike): ConversionUploader<GoogleConversionRow & { type: ConversionType }> {
  const { GOOGLE_ADS_CUSTOMER_ID: customerId, GOOGLE_ADS_DEVELOPER_TOKEN: developerToken, GOOGLE_ADS_ACCESS_TOKEN: accessToken, GOOGLE_ADS_CONVERSION_ACTIONS: actions } = env;
  if (customerId && developerToken && accessToken && actions) {
    let conversionActions: Record<ConversionType, string>;
    try {
      conversionActions = JSON.parse(actions) as Record<ConversionType, string>;
    } catch {
      throw new ConversionConfigError("GOOGLE_ADS_CONVERSION_ACTIONS is not valid JSON");
    }
    for (const t of ["qualified_lead", "consult_booked", "consult_held", "retainer_signed"] as const) {
      if (!conversionActions[t]) throw new ConversionConfigError(`GOOGLE_ADS_CONVERSION_ACTIONS is missing ${t}`);
    }
    return new GoogleAdsUploader({ customerId, developerToken, accessToken, loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID, conversionActions }, fetchImpl);
  }
  if (env.NODE_ENV === "production") throw new ConversionConfigError("Google Ads conversion upload needs GOOGLE_ADS_* credentials in production");
  return new MockUploader("google_ads");
}

/** Same rule for Meta: META_CAPI_PIXEL_ID and META_CAPI_ACCESS_TOKEN (optional META_CAPI_TEST_EVENT_CODE). */
export function metaUploaderFromEnv(env: Env = process.env, fetchImpl?: FetchLike): ConversionUploader<MetaEvent> {
  const { META_CAPI_PIXEL_ID: pixelId, META_CAPI_ACCESS_TOKEN: accessToken } = env;
  if (pixelId && accessToken) return new MetaCapiUploader({ pixelId, accessToken, testEventCode: env.META_CAPI_TEST_EVENT_CODE }, fetchImpl);
  if (env.NODE_ENV === "production") throw new ConversionConfigError("Meta Conversions API upload needs META_CAPI_PIXEL_ID and META_CAPI_ACCESS_TOKEN in production");
  return new MockUploader("meta");
}
