# API

All API routes run on the Node.js runtime. JSON in / JSON out unless noted.

## Auth
| Method | Route | Notes |
| --- | --- | --- |
| POST | `/api/auth/signup` | `{email,password,displayName?}` → creates user (pending), sets session, emails verification. Rate-limited per IP. |
| POST | `/api/auth/login` | `{email,password}` → sets session. |
| POST | `/api/auth/logout` | Clears session. |
| POST | `/api/auth/resend-verification` | Resends verification (uses logged-in email if present). |
| GET | `/api/auth/verify-email?token=` | Programmatic verify (the `/verify-email` page is the human one). |

Passwords are Argon2id. Session + verification tokens are stored **hashed**
(HMAC-SHA256). Verification tokens expire in `EMAIL_VERIFICATION_TTL_MINUTES`.

## Guessing / submission
| Method | Route | Notes |
| --- | --- | --- |
| POST | `/api/guess` | `{mediaId,guess:'ai'\|'not_ai'}`. Requires verified user. One guess per media/user (upsert); changeable until `reveal_status='locked'`. Returns crowd stats + correctness. |
| POST | `/api/submit` | multipart: `title`, `mediaUrl` or `file`, `sourceUrl?`, `tags?`, `claim?`. External URLs pass an SSRF guard; files go to R2 (SigV4). Creates a submission + pending media. |
| GET | `/api/play/queue` | Batch of approved, scoreable media the user hasn't guessed. |

## Admin (role `admin` or `ADMIN_EMAILS`)
| Method | Route |
| --- | --- |
| PATCH | `/api/admin/media/:id` (title/description/source) |
| POST | `/api/admin/media/:id/:action` — `approve`, `reject`, `hide`, `feature`, `unfeature`, `lock`, `exclude-from-scoring`, `include-in-scoring`, `set-truth-label` (re-scores existing guesses) |
| POST/PATCH/DELETE | `/api/admin/tags`, `/api/admin/tags/:slug`, `/api/admin/tags/merge` |
| PATCH | `/api/admin/users/:id` (role/status) |
| POST | `/api/admin/seed/unsplash`, `/api/admin/seed/generate-ai-variants` |

Every admin mutation writes to `audit_log`.
