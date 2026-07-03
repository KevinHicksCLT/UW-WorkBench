// lib/apiKeys — key generation shape, hash round-trip, and constant-time
// webhook signature verification (prefix tolerance + length-mismatch safety).
import { describe, expect, it } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  verifyWebhookSignature,
} from '../../src/lib/apiKeys.js';

describe('generateApiKey', () => {
  it('produces a tbk_-prefixed raw key with a 12-char prefix and sha256 hex hash', () => {
    const { raw, prefix, hash } = generateApiKey();
    expect(raw.startsWith('tbk_')).toBe(true);
    // 32 random bytes base64url ≈ 43 chars + the 4-char prefix.
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(prefix).toBe(raw.slice(0, 12));
    expect(prefix).toHaveLength(12);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(raw).digest('hex'));
  });

  it('round-trips through hashApiKey and is unique per call', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(hashApiKey(a.raw)).toBe(a.hash);
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('generateWebhookSecret', () => {
  it('produces a non-trivial unique secret', () => {
    const a = generateWebhookSecret();
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(generateWebhookSecret()).not.toBe(a);
  });
});

describe('verifyWebhookSignature', () => {
  const secret = generateWebhookSecret();
  const body = Buffer.from(JSON.stringify({ eventId: 'evt_1', eventType: 'user.created' }));
  const goodSig = createHmac('sha256', secret).update(body).digest('hex');

  it('accepts the correct hex HMAC', () => {
    expect(verifyWebhookSignature(body, secret, goodSig)).toBe(true);
  });

  it('accepts the "sha256=" prefixed form', () => {
    expect(verifyWebhookSignature(body, secret, `sha256=${goodSig}`)).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const wrongSecret = generateWebhookSecret();
    const wrong = createHmac('sha256', wrongSecret).update(body).digest('hex');
    expect(verifyWebhookSignature(body, secret, wrong)).toBe(false);
  });

  it('rejects a signature over a different body', () => {
    const other = createHmac('sha256', secret).update(Buffer.from('{}')).digest('hex');
    expect(verifyWebhookSignature(body, secret, other)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyWebhookSignature(body, secret, undefined)).toBe(false);
  });

  it('handles a length-mismatched header safely (no throw from timingSafeEqual)', () => {
    expect(verifyWebhookSignature(body, secret, 'deadbeef')).toBe(false);
    expect(verifyWebhookSignature(body, secret, '')).toBe(false);
    expect(verifyWebhookSignature(body, secret, `sha256=${goodSig}00`)).toBe(false);
  });
});
