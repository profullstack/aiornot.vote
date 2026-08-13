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
| `image_url` | yes | Public http(s) URL to an **image** (images only for now; video URLs are rejected). Private/internal hosts are rejected (SSRF guard). |
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

### `POST /api/v1/provenance`
Read what a file **declares** about how it was made. This is the immediate,
deterministic counterpart to an opinion: no humans, no waiting.

> **Also not a detector.** It reports signed and self-declared provenance —
> nothing here inspects pixels. A file with no provenance is not evidence
> either way.

Request:
```json
{ "media_url": "https://example.com/photo.jpg" }
```

Response `200`:
```json
{
  "media_url": "https://example.com/photo.jpg",
  "content_type": "image/jpeg",
  "bytes_inspected": 2097152,
  "provenance": {
    "signals": ["c2pa_manifest", "iptc_digital_source_type"],
    "strength": "signed",
    "declared_ai_generated": true,
    "c2pa": { "present": true, "container": "jpeg", "signature_verified": false },
    "digital_source_type": "trainedAlgorithmicMedia",
    "digital_source_type_label": "Created by a generative model",
    "generators": ["Adobe Firefly"],
    "synthid": { "checked": false, "reason": "…" },
    "notes": ["…"]
  }
}
```

**`strength`** is how much the finding is worth:

| Value | Meaning |
|---|---|
| `signed` | A C2PA manifest is present. Presence only — validating the signature and its certificate chain is a separate step this endpoint does not attempt. |
| `declared` | An IPTC `DigitalSourceType` claim. Editable metadata, not proof. |
| `hint` | A generator name in XMP/EXIF. May mean the tool made the image, or merely that it was opened in it. |
| `none` | Nothing found. Most platforms strip metadata on upload, so this is equally common for real photographs and AI output. |

`declared_ai_generated` is `true`, `false`, or `null` when the file declares
nothing. It is only ever set from `DigitalSourceType` — a generator name alone
is too weak to call.

**SynthID is never checked.** Google's watermarks are verified by its own
detection service, not from a file's bytes, so `synthid.checked` is always
`false` and the response says why rather than staying silent about it.

Only the first 2MB is fetched (via a `Range` request); provenance metadata
lives at the front of every container. Rate limit: 60 requests/min per key.
`502` if the file could not be fetched.

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
