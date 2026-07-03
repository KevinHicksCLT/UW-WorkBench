// Pure crypto helpers for tenant API keys ("tbk_…") and inbound webhook HMAC
// verification. No Prisma here — lookup/storage lives in middleware/apiKeyAuth
// and routes/users/apiKeys. Raw keys are shown once at mint time; only the
// sha256 hex hash is persisted (ApiKey.keyHash).
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type GeneratedApiKey = {
  /** The full secret, e.g. "tbk_dGhpcy1pcy1yYW5kb20…" — shown to the admin exactly once. */
  raw: string;
  /** First 12 chars ("tbk_" + 8) — stored for display and O(1) lookup. */
  prefix: string;
  /** sha256(raw) hex — the only form ever persisted. */
  hash: string;
};

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
  const raw = `tbk_${randomBytes(32).toString('base64url')}`;
  return { raw, prefix: raw.slice(0, 12), hash: hashApiKey(raw) };
}

/** Shared secret for signing inbound IAM webhook payloads (HMAC-SHA256). */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Constant-time check of an inbound webhook signature. The header carries the
 * hex HMAC-SHA256 of the raw request body, optionally prefixed "sha256="
 * (GitHub-style). Length is guarded before timingSafeEqual (which throws on
 * unequal lengths).
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  secret: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
