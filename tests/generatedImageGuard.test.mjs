import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHATGPT_GENERATION_FAILURE_MESSAGE,
  DEFAULT_MAX_GENERATED_IMAGE_BYTES,
  getDataUrlByteSize,
  shouldRejectGeneratedImage,
  validateGeneratedImageMetadata
} from '../services/generatedImageGuard.mjs';

test('rejects 1024 square images as suspicious generated output', () => {
  assert.equal(
    shouldRejectGeneratedImage({ width: 1024, height: 1024, byteSize: 1_500_000 }),
    true
  );
});

test('rejects returned images larger than 2MB', () => {
  assert.equal(
    shouldRejectGeneratedImage({
      width: 1254,
      height: 1254,
      byteSize: DEFAULT_MAX_GENERATED_IMAGE_BYTES + 1
    }),
    true
  );
});

test('accepts expected 1254 square sticker sheets under 2MB', () => {
  assert.equal(
    shouldRejectGeneratedImage({ width: 1254, height: 1254, byteSize: 1_800_000 }),
    false
  );
});

test('throws the user-facing retry message for rejected image metadata', () => {
  assert.throws(
    () => validateGeneratedImageMetadata({ width: 1024, height: 1024, byteSize: 1_500_000 }),
    new RegExp(CHATGPT_GENERATION_FAILURE_MESSAGE)
  );
});

test('calculates byte size for base64 data URLs without decoding in memory', () => {
  assert.equal(getDataUrlByteSize('data:image/png;base64,SGVsbG8='), 5);
  assert.equal(getDataUrlByteSize('data:image/png;base64,SGVsbG8'), 5);
});
