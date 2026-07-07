import "server-only";
import { createHash, createHmac } from "node:crypto";
import { env } from "./env";

export function storageConfigured(): boolean {
  const r = env.r2;
  return !!(r.accountId && r.accessKeyId && r.secretAccessKey && r.bucket);
}

function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

/**
 * Upload a buffer to an S3-compatible bucket (Cloudflare R2) using SigV4.
 * Returns the public URL derived from R2_PUBLIC_BASE_URL.
 */
export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ publicUrl: string; storageKey: string }> {
  if (!storageConfigured()) {
    throw new Error("Object storage is not configured (set R2_* env vars).");
  }
  const r = env.r2;
  const region = "auto";
  const service = "s3";
  const host = `${r.accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${r.bucket}/${key}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    `/${r.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${r.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${r.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Content-Type": contentType,
      host,
    },
    body: new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const base = r.publicBaseUrl.replace(/\/$/, "");
  const publicUrl = base ? `${base}/${key}` : endpoint;
  return { publicUrl, storageKey: key };
}
