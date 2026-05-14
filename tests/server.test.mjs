import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBaseUrl,
  resolveOpenAIUrl,
  parseDataUrl,
  extractOpenAIImageData,
  createSessionToken,
  verifySessionToken,
  sanitizeProviderError,
} from '../server.mjs';

test('normalizeBaseUrl trims whitespace and trailing slashes', () => {
  assert.equal(normalizeBaseUrl(' https://api.example.com/v1/// '), 'https://api.example.com/v1');
  assert.equal(normalizeBaseUrl('', 'https://fallback.example.com/'), 'https://fallback.example.com');
});

test('resolveOpenAIUrl appends endpoint to a /v1 base URL', () => {
  assert.equal(
    resolveOpenAIUrl('https://api.example.com/v1/', '/images/edits'),
    'https://api.example.com/v1/images/edits'
  );
  assert.equal(
    resolveOpenAIUrl('https://api.example.com/openai/v1', 'chat/completions'),
    'https://api.example.com/openai/v1/chat/completions'
  );
});

test('parseDataUrl returns mime type, base64, and bytes', () => {
  const parsed = parseDataUrl('data:image/png;base64,aGVsbG8=');
  assert.equal(parsed.mimeType, 'image/png');
  assert.equal(parsed.base64, 'aGVsbG8=');
  assert.equal(parsed.buffer.toString('utf8'), 'hello');
});

test('extractOpenAIImageData supports b64_json and data URL responses', () => {
  assert.equal(
    extractOpenAIImageData({ data: [{ b64_json: 'abc123' }] }),
    'data:image/png;base64,abc123'
  );
  assert.equal(
    extractOpenAIImageData({ data: [{ url: 'data:image/webp;base64,zzz' }] }),
    'data:image/webp;base64,zzz'
  );
});

test('signed session token verifies and rejects tampering or expiry', () => {
  const secret = 'unit-test-secret';
  const now = 1_700_000_000_000;
  const token = createSessionToken(secret, now);

  assert.equal(verifySessionToken(token, secret, 60_000, now + 1_000), true);
  assert.equal(verifySessionToken(`${token}x`, secret, 60_000, now + 1_000), false);
  assert.equal(verifySessionToken(token, secret, 60_000, now + 120_000), false);
});

test('sanitizeProviderError caps output and redacts API keys', () => {
  const raw = `failure key sk-test-secret ${'x'.repeat(2000)}`;
  const sanitized = sanitizeProviderError(raw, 'sk-test-secret');

  assert.equal(sanitized.includes('sk-test-secret'), false);
  assert.ok(sanitized.length < 1300);
});
