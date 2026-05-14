import { Rect, isBackground, mergeRects } from './shared';

// Define message types
export type WorkerMessage =
    | { type: 'PROCESS', imageData: ImageData, threshold: number }
    | { type: 'ABORT' };

export type WorkerResponse =
    | { type: 'PROGRESS', message: string }
    | { type: 'COMPLETE', rects: Rect[] }
    | { type: 'ERROR', error: string };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { type } = e.data;

    if (type === 'PROCESS') {
        try {
            const { imageData, threshold } = e.data;
            processImage(imageData, threshold);
        } catch (error) {
            self.postMessage({ type: 'ERROR', error: (error as Error).message });
        }
    }
};

const processImage = (imageData: ImageData, threshold: number) => {
    const { width, height, data } = imageData;

    self.postMessage({ type: 'PROGRESS', message: "Processing in background..." });

    const visited = new Uint8Array(width * height);
    const rawRects: Rect[] = [];
    const getIdx = (x: number, y: number) => (y * width + x) * 4;

    // Scan Logic
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const visitIdx = y * width + x;

            if (visited[visitIdx]) continue;

            const idx = getIdx(x, y);
            if (!isBackground(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
                let minX = x, maxX = x, minY = y, maxY = y;
                let count = 0;

                const stack = [[x, y]];
                visited[visitIdx] = 1;

                while (stack.length > 0) {
                    const [cx, cy] = stack.pop()!;
                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;
                    count++;

                    const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];

                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nVisitIdx = ny * width + nx;
                            if (visited[nVisitIdx] === 0) {
                                const nIdx = getIdx(nx, ny);
                                if (!isBackground(data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3])) {
                                    visited[nVisitIdx] = 1;
                                    stack.push([nx, ny]);
                                }
                            }
                        }
                    }
                }

                const w = maxX - minX;
                const h = maxY - minY;
                if (count > 50 && w > 5 && h > 5) {
                    rawRects.push({ minX, maxX, minY, maxY });
                }
            }
        }
    }

    self.postMessage({ type: 'PROGRESS', message: `Detected ${rawRects.length} components. Merging...` });

    const mergedRects = mergeRects(rawRects, threshold);

    self.postMessage({ type: 'COMPLETE', rects: mergedRects });
};
