import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`CURRENT_TIMESTAMP`;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    emailNormalized: text("email_normalized").notNull().unique(),
    emailVerifiedAt: text("email_verified_at"),
    passwordHash: text("password_hash"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    status: text("status").notNull().default("pending_email_verification"),
    role: text("role").notNull().default("user"),
    isLifetimeMember: integer("is_lifetime_member").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
    lastLoginAt: text("last_login_at"),
  },
  (t) => [index("idx_users_email_verified").on(t.emailVerifiedAt)],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    purpose: text("purpose").notNull(),
    amountUsd: real("amount_usd").notNull(),
    blockchain: text("blockchain"),
    coinpayPaymentId: text("coinpay_payment_id"),
    paymentAddress: text("payment_address"),
    cryptoAmount: text("crypto_amount"),
    status: text("status").notNull().default("pending"),
    grantedAt: text("granted_at"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    index("idx_payments_user").on(t.userId),
    index("idx_payments_coinpay").on(t.coinpayPaymentId),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    label: text("label"),
    isActive: integer("is_active").notNull().default(1),
    requestCount: integer("request_count").notNull().default(0),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("idx_api_keys_user").on(t.userId)],
);

export const emailVerificationTokens = sqliteTable("email_verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  createdAt: text("created_at").notNull().default(now),
});

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("idx_password_reset_user").on(t.userId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    sessionTokenHash: text("session_token_hash").notNull().unique(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(now),
    lastSeenAt: text("last_seen_at"),
  },
  (t) => [
    index("idx_sessions_user_id").on(t.userId),
    index("idx_sessions_expires_at").on(t.expiresAt),
  ],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    mediaType: text("media_type").notNull().default("image"),
    title: text("title").notNull(),
    description: text("description"),
    originalUrl: text("original_url"),
    storageKey: text("storage_key"),
    mediaUrl: text("media_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    posterUrl: text("poster_url"),
    sourceUrl: text("source_url"),
    sourceDomain: text("source_domain"),
    sourceProvider: text("source_provider"),
    seedSource: text("seed_source"),
    sourceParentMediaId: text("source_parent_media_id"),
    submitterUserId: text("submitter_user_id"),
    submitterClaim: text("submitter_claim"),
    truthLabel: text("truth_label").notNull().default("unknown"),
    truthConfidence: text("truth_confidence").notNull().default("unverified"),
    revealStatus: text("reveal_status").notNull().default("revealed"),
    status: text("status").notNull().default("pending"),
    isFeatured: integer("is_featured").notNull().default(0),
    isScoreEligible: integer("is_score_eligible").notNull().default(1),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: real("duration_seconds"),
    mimeType: text("mime_type"),
    fileSizeBytes: integer("file_size_bytes"),
    fileHash: text("file_hash"),
    perceptualHash: text("perceptual_hash"),
    aiPromptSummary: text("ai_prompt_summary"),
    aiModel: text("ai_model"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
    approvedAt: text("approved_at"),
    lockedAt: text("locked_at"),
  },
  (t) => [
    index("idx_media_status_created_at").on(t.status, t.createdAt),
    index("idx_media_featured_created_at").on(t.isFeatured, t.createdAt),
    index("idx_media_type_status_created_at").on(t.mediaType, t.status, t.createdAt),
    index("idx_media_truth_label").on(t.truthLabel),
    index("idx_media_source_domain").on(t.sourceDomain),
    index("idx_media_file_hash").on(t.fileHash),
    index("idx_media_perceptual_hash").on(t.perceptualHash),
  ],
);

export const unsplashPhotos = sqliteTable("unsplash_photos", {
  mediaId: text("media_id").primaryKey(),
  unsplashId: text("unsplash_id").notNull().unique(),
  photographerName: text("photographer_name"),
  photographerUsername: text("photographer_username"),
  photographerUrl: text("photographer_url"),
  unsplashHtmlUrl: text("unsplash_html_url"),
  unsplashDownloadLocation: text("unsplash_download_location"),
  blurHash: text("blur_hash"),
  color: text("color"),
  importedAt: text("imported_at").notNull().default(now),
  rawJson: text("raw_json"),
});

export const seedBatches = sqliteTable("seed_batches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull(),
  category: text("category"),
  status: text("status").notNull().default("pending"),
  totalRequested: integer("total_requested").notNull().default(0),
  totalImported: integer("total_imported").notNull().default(0),
  totalGenerated: integer("total_generated").notNull().default(0),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default(now),
  completedAt: text("completed_at"),
});

export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: integer("is_default").notNull().default(0),
    isVisible: integer("is_visible").notNull().default(1),
    isAnswerSpoiler: integer("is_answer_spoiler").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("idx_tags_slug").on(t.slug)],
);

export const mediaTags = sqliteTable(
  "media_tags",
  {
    mediaId: text("media_id").notNull(),
    tagId: text("tag_id").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.tagId] }),
    index("idx_media_tags_tag_id").on(t.tagId),
  ],
);

export const guesses = sqliteTable(
  "guesses",
  {
    id: text("id").primaryKey(),
    mediaId: text("media_id").notNull(),
    userId: text("user_id").notNull(),
    guess: text("guess").notNull(),
    isCorrect: integer("is_correct"),
    isScored: integer("is_scored").notNull().default(0),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("uq_guesses_media_user").on(t.mediaId, t.userId),
    index("idx_guesses_media_id").on(t.mediaId),
    index("idx_guesses_user_id_created_at").on(t.userId, t.createdAt),
    index("idx_guesses_user_scored").on(t.userId, t.isScored, t.isCorrect),
  ],
);

export const mediaStats = sqliteTable(
  "media_stats",
  {
    mediaId: text("media_id").primaryKey(),
    aiGuesses: integer("ai_guesses").notNull().default(0),
    notAiGuesses: integer("not_ai_guesses").notNull().default(0),
    totalGuesses: integer("total_guesses").notNull().default(0),
    correctGuesses: integer("correct_guesses").notNull().default(0),
    incorrectGuesses: integer("incorrect_guesses").notNull().default(0),
    crowdAccuracy: real("crowd_accuracy").notNull().default(0),
    scoreAi: real("score_ai").notNull().default(0),
    scoreNotAi: real("score_not_ai").notNull().default(0),
    trendingScore: real("trending_score").notNull().default(0),
    difficultyScore: real("difficulty_score").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("idx_media_stats_trending").on(t.trendingScore)],
);

export const userStats = sqliteTable(
  "user_stats",
  {
    userId: text("user_id").primaryKey(),
    totalGuesses: integer("total_guesses").notNull().default(0),
    scoredGuesses: integer("scored_guesses").notNull().default(0),
    correctGuesses: integer("correct_guesses").notNull().default(0),
    incorrectGuesses: integer("incorrect_guesses").notNull().default(0),
    accuracy: real("accuracy").notNull().default(0),
    currentStreak: integer("current_streak").notNull().default(0),
    bestStreak: integer("best_streak").notNull().default(0),
    lastGuessAt: text("last_guess_at"),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("idx_user_stats_correct").on(t.correctGuesses, t.accuracy)],
);

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  mediaType: text("media_type").notNull(),
  originalUrl: text("original_url"),
  storageKey: text("storage_key"),
  title: text("title"),
  sourceUrl: text("source_url"),
  suggestedTags: text("suggested_tags"),
  submitterClaim: text("submitter_claim"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: text("created_at").notNull().default(now),
  reviewedAt: text("reviewed_at"),
});

export const prizes = sqliteTable(
  "prizes",
  {
    id: text("id").primaryKey(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    rank: integer("rank").notNull(),
    rewardKind: text("reward_kind").notNull(),
    rewardLabel: text("reward_label").notNull(),
    userId: text("user_id"),
    status: text("status").notNull().default("unclaimed"),
    claimDeadline: text("claim_deadline").notNull(),
    claimedAt: text("claimed_at"),
    fulfilledAt: text("fulfilled_at"),
    notifiedAt: text("notified_at"),
    carriedOver: integer("carried_over").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    index("idx_prizes_user_status").on(t.userId, t.status),
    index("idx_prizes_period").on(t.periodStart),
  ],
);

export const userPowerups = sqliteTable("user_powerups", {
  userId: text("user_id").primaryKey(),
  hints: integer("hints").notNull().default(0),
  aiScans: integer("ai_scans").notNull().default(0),
  aiVerdicts: integer("ai_verdicts").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(now),
});

export const aiAnalyses = sqliteTable(
  "ai_analyses",
  {
    mediaId: text("media_id").notNull(),
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.kind] })],
);

export const powerupUses = sqliteTable(
  "powerup_uses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    mediaId: text("media_id").notNull(),
    kind: text("kind").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("uq_powerup_uses").on(t.userId, t.mediaId, t.kind),
    index("idx_powerup_uses_user").on(t.userId),
  ],
);

export const tips = sqliteTable("tips", {
  id: text("id").primaryKey(),
  text: text("text").notNull().unique(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull().default(now),
});

export const prizeSponsorships = sqliteTable(
  "prize_sponsorships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    sponsorName: text("sponsor_name").notNull(),
    sponsorUrl: text("sponsor_url"),
    prizeLabel: text("prize_label").notNull(),
    message: text("message"),
    amountUsd: real("amount_usd").notNull(),
    blockchain: text("blockchain"),
    coinpayPaymentId: text("coinpay_payment_id"),
    paymentAddress: text("payment_address"),
    cryptoAmount: text("crypto_amount"),
    status: text("status").notNull().default("pending"),
    periodStart: text("period_start").notNull(),
    createdAt: text("created_at").notNull().default(now),
    paidAt: text("paid_at"),
  },
  (t) => [index("idx_sponsorships_period").on(t.periodStart, t.status)],
);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default(now),
});

export type User = typeof users.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Guess = typeof guesses.$inferSelect;
export type MediaStats = typeof mediaStats.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SeedBatch = typeof seedBatches.$inferSelect;
