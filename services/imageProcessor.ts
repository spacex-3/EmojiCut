import { StickerSegment } from '../types';
import { Rect, isBackground } from './shared';
export type { Rect };

/**
 * Loads an image from a File object.
 */
export const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Extracts a specific region from an image/canvas, removes background, and adds a white stroke.
 */
export const extractStickerFromRect = (
  source: HTMLImageElement | HTMLCanvasElement,
  rect: Rect,
  defaultName: string = 'sticker'
): StickerSegment | null => {
  const padding = 2;
  const strokeWidth = 6; // Width of the white border

  const width = source.width;
  const height = source.height;

  // 1. Calculate dimensions for the raw cutout
  const finalX = Math.max(0, rect.minX - padding);
  const finalY = Math.max(0, rect.minY - padding);
  const finalW = Math.min(width - finalX, (rect.maxX - rect.minX) + padding * 2);
  const finalH = Math.min(height - finalY, (rect.maxY - rect.minY) + padding * 2);

  if (finalW <= 0 || finalH <= 0) return null;

  // 2. Create the raw cutout with background removed
  const segCanvas = document.createElement('canvas');
  segCanvas.width = finalW;
  segCanvas.height = finalH;
  const segCtx = segCanvas.getContext('2d');
  if (!segCtx) return null;

  segCtx.drawImage(
    source,
    finalX, finalY, finalW, finalH,
    0, 0, finalW, finalH
  );

  const segImageData = segCtx.getImageData(0, 0, finalW, finalH);
  const segPixels = segImageData.data;

  // Flood Fill Algorithm to remove background
  // We assume the top-left corner (0,0) is background.
  // We find all connected pixels that match the background criteria and set them to transparent.

  const queue: [number, number][] = [[0, 0], [finalW - 1, 0], [0, finalH - 1], [finalW - 1, finalH - 1]]; // Start from 4 corners
  // const visited = new Set<string>(); // Removed unused Set

  // Helper to get index
  const getIdx = (x: number, y: number) => (y * finalW + x) * 4;

  // Add corners to start
  for (const [sx, sy] of queue) {
    const idx = getIdx(sx, sy);
    // Only start if the corner itself is "background-ish"
    if (isBackground(segPixels[idx], segPixels[idx + 1], segPixels[idx + 2], segPixels[idx + 3])) {
      // It's valid background start
    } else {
      // Corner is not white? Strange but possible.
    }
  }

  // Use a TypedArray for visited to improve performance over Set<String>
  // 0 = unvisited, 1 = visited/background
  const visitedArr = new Uint8Array(finalW * finalH);

  // Initialize queue with valid corners
  const activeQueue: number[] = []; // Store indices

  // Check corners
  const corners = [[0, 0], [finalW - 1, 0], [0, finalH - 1], [finalW - 1, finalH - 1]];
  for (const [cx, cy] of corners) {
    const idx = getIdx(cx, cy);
    if (isBackground(segPixels[idx], segPixels[idx + 1], segPixels[idx + 2], segPixels[idx + 3])) {
      const pIdx = cy * finalW + cx;
      if (visitedArr[pIdx] === 0) {
        visitedArr[pIdx] = 1;
        activeQueue.push(cx, cy);
        // Set transparent immediately
        segPixels[idx + 3] = 0;
      }
    }
  }

  let head = 0;
  while (head < activeQueue.length) {
    const x = activeQueue[head++];
    const y = activeQueue[head++];

    // Neighbors (4-way)
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < finalW && ny >= 0 && ny < finalH) {
        const nIdx = ny * finalW + nx;
        if (visitedArr[nIdx] === 0) {
          const pIdx = getIdx(nx, ny);
          // Check if neighbor is background
          if (isBackground(segPixels[pIdx], segPixels[pIdx + 1], segPixels[pIdx + 2], segPixels[pIdx + 3])) {
            visitedArr[nIdx] = 1;
            activeQueue.push(nx, ny);
            segPixels[pIdx + 3] = 0; // Make transparent
          }
        }
      }
    }
  }

  // --------------------------------------------------------
  // EROSION STEP: Remove "hairy" edges
  // --------------------------------------------------------
  // We identify pixels that are opaque but touch a transparent pixel (the edge).
  // We remove them to smooth out compression artifacts.

  const width2 = finalW; // explicit local var for clarity
  const height2 = finalH;
  const pixelsToRemove: number[] = [];

  for (let y = 0; y < height2; y++) {
    for (let x = 0; x < width2; x++) {
      const idx = (y * width2 + x) * 4;

      // If pixel is opaque (part of sticker)
      if (segPixels[idx + 3] > 0) {
        // Check neighbors (4-way)
        let isEdge = false;
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;

          // If neighbor is out of bounds, it's not "transparent background", usually ignored
          if (nx >= 0 && nx < width2 && ny >= 0 && ny < height2) {
            const nIdx = (ny * width2 + nx) * 4;
            // If neighbor is transparent (erased by flood fill)
            if (segPixels[nIdx + 3] === 0) {
              isEdge = true;
              break;
            }
          } else {
            // If touching canvas boundary, could be considered edge, but let's effectively ignore to keep rect bounds
          }
        }

        if (isEdge) {
          pixelsToRemove.push(idx);
        }
      }
    }
  }

  // Apply erosion
  for (const idx of pixelsToRemove) {
    segPixels[idx + 3] = 0;
  }

  segCtx.putImageData(segImageData, 0, 0);

  // 3. Create a silhouette for the stroke
  const silhouetteCanvas = document.createElement('canvas');
  silhouetteCanvas.width = finalW;
  silhouetteCanvas.height = finalH;
  const sCtx = silhouetteCanvas.getContext('2d');
  if (!sCtx) return null;

  sCtx.drawImage(segCanvas, 0, 0);
  sCtx.globalCompositeOperation = 'source-in';
  sCtx.fillStyle = '#FFFFFF';
  sCtx.fillRect(0, 0, finalW, finalH);

  // 4. Create Final Canvas with extra space for the stroke
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalW + (strokeWidth * 2);
  finalCanvas.height = finalH + (strokeWidth * 2);
  const fCtx = finalCanvas.getContext('2d');
  if (!fCtx) return null;

  // Enable smoothing for better stroke edges
  fCtx.imageSmoothingEnabled = true;
  fCtx.imageSmoothingQuality = 'high';

  // Draw the silhouette multiple times in a circle to create the stroke
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const ox = strokeWidth + Math.cos(angle) * strokeWidth;
    const oy = strokeWidth + Math.sin(angle) * strokeWidth;
    fCtx.drawImage(silhouetteCanvas, ox, oy);
  }

  // Fill the center of the stroke to ensure no gaps between stroke and image
  // (This also helps fill in small internal holes that were removed by background keying)
  fCtx.drawImage(silhouetteCanvas, strokeWidth, strokeWidth);

  // 5. Draw the original colored image on top
  fCtx.globalCompositeOperation = 'source-over';
  fCtx.drawImage(segCanvas, strokeWidth, strokeWidth);

  return {
    id: crypto.randomUUID(),
    dataUrl: finalCanvas.toDataURL('image/png'),
    originalX: finalX,
    originalY: finalY,
    width: finalCanvas.width,
    height: finalCanvas.height,
    name: defaultName,
    isNaming: false
  };
};

/**
 * Main function to process the sticker sheet using a specific Worker.
 */
export const processStickerSheet = async (
  image: HTMLImageElement,
  onProgress: (msg: string) => void,
  threshold: number = 15
): Promise<StickerSegment[]> => {
  return new Promise((resolve, reject) => {
    // Retrieve canvas data to send to worker
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Initialize Worker
    const worker = new Worker(new URL('./sticker.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e) => {
      const { type } = e.data;

      if (type === 'PROGRESS') {
        onProgress(e.data.message);
      } else if (type === 'COMPLETE') {
        const rects: Rect[] = e.data.rects;

        onProgress(`Identified ${rects.length} stickers. Extracting...`);

        // Extraction still happens on main thread for now (requires canvas access)
        // But the heavy scanning is done
        const finalSegments: StickerSegment[] = [];

        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          const segment = extractStickerFromRect(canvas, rect, `sticker_${i + 1}`);
          if (segment) {
            finalSegments.push(segment);
          }
        }

        worker.terminate();
        resolve(finalSegments);

      } else if (type === 'ERROR') {
        worker.terminate();
        reject(new Error(e.data.error));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    // Start Worker
    worker.postMessage({ type: 'PROCESS', imageData, threshold });
  });
};