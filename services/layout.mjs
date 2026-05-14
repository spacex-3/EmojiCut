export function getResponsiveStickerSize(viewportWidth) {
  if (viewportWidth <= 430) return 92;
  if (viewportWidth <= 820) return 112;
  return 128;
}

export function calculateStickerGridLayout(count, viewportWidth, options = {}) {
  const safeMargin = options.safeMargin ?? (viewportWidth <= 430 ? 28 : 24);
  const maxColumns = options.maxColumns ?? 5;
  const stickerSize = options.stickerSize ?? getResponsiveStickerSize(viewportWidth);
  const gap = options.gap ?? (viewportWidth <= 430 ? 8 : 12);
  const verticalOffset = options.verticalOffset ?? (viewportWidth <= 430 ? -110 : 80);
  const availableWidth = Math.max(stickerSize, viewportWidth - safeMargin * 2);
  const columns = Math.max(
    1,
    Math.min(maxColumns, count, Math.floor((availableWidth + gap) / (stickerSize + gap)))
  );
  const rows = Math.ceil(count / columns);
  const gridWidth = columns * stickerSize + (columns - 1) * gap;
  const gridHeight = rows * stickerSize + (rows - 1) * gap;
  const startX = -gridWidth / 2;
  const startY = -gridHeight / 2 + verticalOffset;

  const positions = Array.from({ length: count }, (_, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: startX + col * (stickerSize + gap),
      y: startY + row * (stickerSize + gap),
    };
  });

  return {
    columns,
    rows,
    stickerSize,
    gap,
    safeMargin,
    gridWidth,
    gridHeight,
    positions,
  };
}
