/**
 * Centralised env access. We read lazily so the app can boot in dev with
 * sensible defaults and only hard-fail on genuinely required secrets in prod.
 */
function bool(v: string | undefined, def = false): boolean {
  if (v == null) return def;
  return /^(1|true|yes|on)$/i.test(v);
}

function int(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export const env = {
  appUrl: process.env.APP_URL || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV || "development",
  get isProd() {
    return this.nodeEnv === "production";
  },
  sessionSecret:
    process.env.SESSION_SECRET || "dev-only-insecure-change-me-0000000000000000",
  adminEmails: (process.env.ADMIN_EMAILS || "anthony@profullstack.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  tursoUrl: process.env.TURSO_DATABASE_URL || "file:./local.db",
  tursoToken: process.env.TURSO_AUTH_TOKEN || undefined,

  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "AIorNot.vote <hello@aiornot.vote>",
  verificationTtlMinutes: int(process.env.EMAIL_VERIFICATION_TTL_MINUTES, 30),

  storageProvider: process.env.STORAGE_PROVIDER || "r2",
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET || "",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || "",
  },
  maxImageUploadMb: int(process.env.MAX_IMAGE_UPLOAD_MB, 12),
  maxVideoUploadMb: int(process.env.MAX_VIDEO_UPLOAD_MB, 75),
  maxVideoDurationSeconds: int(process.env.MAX_VIDEO_DURATION_SECONDS, 30),

  rssCacheSeconds: int(process.env.RSS_CACHE_SECONDS, 300),
  voteSalt: process.env.VOTE_SALT || "dev-vote-salt",
  submissionSalt: process.env.SUBMISSION_SALT || "dev-submission-salt",
  rateLimitSalt: process.env.RATE_LIMIT_SALT || "dev-rate-limit-salt",

  posthogKey: process.env.POSTHOG_KEY || "",
  posthogHost: process.env.POSTHOG_HOST || "",

  coinpay: {
    apiKey: process.env.COINPAY_API_KEY || "",
    businessId: process.env.COINPAY_BUSINESS_ID || "",
    baseUrl: process.env.COINPAY_BASE_URL || "https://coinpayportal.com/api",
    webhookSecret: process.env.COINPAY_WEBHOOK_SECRET || "",
  },
  get coinpayConfigured() {
    return !!(this.coinpay.apiKey && this.coinpay.businessId);
  },
  priceApiAccessUsd: Number(process.env.PRICE_API_ACCESS_USD || 1),
  priceLifetimeUsd: Number(process.env.PRICE_LIFETIME_USD || 2),
  cronSecret: process.env.CRON_SECRET || "",

  hasResend: bool(process.env.RESEND_API_KEY ? "1" : "0"),
};

export function isAdminEmail(email: string): boolean {
  return env.adminEmails.includes(email.trim().toLowerCase());
}
