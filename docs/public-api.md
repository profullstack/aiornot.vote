# AIorNot.vote Public API (v1)

Submit a photorealistic image and get a **crowd-sourced opinion** on whether it's
AI-generated or real. Each submission creates a public entry that verified users
vote on; you read back the aggregated result.

> **Not a detector.** Results are crowd opinions from verified human voters —
> useful signal, not a scientific AI-detection guarantee.

## Access & pricing

- **API access: $1** (one-time, paid in crypto via [CoinPay](https://coinpayportal.com)).
  Buying issues one API key. The charge exists to keep out spam.
- **Lifetime membership: $2** — includes **free** API key creation (mint as many
  as you need) plus a member badge.

Buy at **`/api`** (access) or **`/membership`** (lifetime). Keys look like
`aion_live_…` and are shown once — store them securely. Manage/revoke keys in
your account.

## Auth

```
Authorization: Bearer aion_live_your_key
```

## Endpoints

### `POST /api/v1/opinions`
Create a crowd-opinion request.

Request:
```json
{
  "image_url": "https://example.com/photo.jpg",
  "title": "Is this real?",
  "tags": ["portrait", "photorealistic"],
  "metadata": { "your_ref": "abc-123" }
}
```

| Field | Required | Notes |
|---|---|---|
| `image_url` | yes | Public http(s) URL. Private/internal hosts are rejected (SSRF guard). |
| `title` | no | Shown on the public page (default: "Is this AI or real?"). |
| `tags` | no | Up to 8 slugs. |
| `metadata` | no | Echoed for your records. |

Response `201`:
```json
{
  "id": "med_…",
  "slug": "is-this-real",
  "url": "https://aiornot.vote/m/is-this-real",
  "results_url": "https://aiornot.vote/api/v1/opinions/med_…",
  "status": "collecting"
}
```

Rate limit: 60 requests/min per key.

### `GET /api/v1/opinions/:id`
Read aggregated results. Public, no auth.

Response:
```json
{
  "id": "med_…",
  "title": "Is this real?",
  "image_url": "https://example.com/photo.jpg",
  "url": "https://aiornot.vote/m/is-this-real",
  "votes": { "ai": 42, "not_ai": 21, "total": 63 },
  "ai_percent": 67,
  "verdict": "likely_ai"
}
```

`verdict` ∈ `likely_ai` (ai ≥ 60%), `likely_not_ai` (ai ≤ 40%), `uncertain`,
or `insufficient_votes` (< 5 votes).

### `GET /api/v1/opinions`
List opinions created with your key (auth required).

## Errors
`401` invalid/missing key · `400` bad input · `402` payment required (create a
key by buying access or becoming a member) · `429` rate limited.

## Payments (how it works)
`POST /api/payments/create-checkout` (session-auth) creates a CoinPay payment for
the chosen purpose (`api_access` / `lifetime_membership`) and coin; the checkout
page polls `GET /api/payments/status?id=…` until CoinPay confirms the on-chain
payment, then grants the entitlement. An optional signed webhook
(`POST /api/payments/coinpay/webhook`, `X-CoinPay-Signature`) speeds this up when
`COINPAY_WEBHOOK_SECRET` is configured.
