import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStickerGridLayout, getResponsiveStickerSize } from '../services/layout.mjs';

test('mobile sticker grid uses small stickers and keeps all stickers inside viewport width', () => {
  const layout = calculateStickerGridLayout(16, 390);

  assert.equal(layout.columns, 3);
  assert.equal(layout.stickerSize, 92);

  for (const sticker of layout.positions) {
    const left = 390 / 2 + sticker.x;
    const right = left + layout.stickerSize;
    assert.ok(left >= layout.safeMargin, `left ${left} should stay inside margin`);
    assert.ok(right <= 390 - layout.safeMargin, `right ${right} should stay inside margin`);
  }
});

test('desktop sticker grid keeps a maximum of five columns', () => {
  const layout = calculateStickerGridLayout(16, 1280);

  assert.equal(layout.columns, 5);
  assert.equal(layout.stickerSize, 128);
});

test('responsive sticker size defaults to mobile-first smaller sizes', () => {
  assert.equal(getResponsiveStickerSize(390), 92);
  assert.equal(getResponsiveStickerSize(768), 112);
  assert.equal(getResponsiveStickerSize(1280), 128);
});
