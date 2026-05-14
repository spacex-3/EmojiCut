export interface Rect {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

/**
 * Checks if a pixel is effectively "white" or transparent.
 */
export const isBackground = (r: number, g: number, b: number, a: number): boolean => {
    if (a < 20) return true; // Transparent
    // High brightness is considered background (white paper)
    return r > 240 && g > 240 && b > 240;
};

/**
 * Merges bounding boxes that are spatially close to each other.
 */
export const mergeRects = (rects: Rect[], distanceThreshold: number): Rect[] => {
    let merged = [...rects];
    let changed = true;

    while (changed) {
        changed = false;
        const newMerged: Rect[] = [];
        const visited = new Set<number>();

        for (let i = 0; i < merged.length; i++) {
            if (visited.has(i)) continue;

            let current = { ...merged[i] };
            visited.add(i);

            for (let j = i + 1; j < merged.length; j++) {
                if (visited.has(j)) continue;

                const other = merged[j];

                const xDist = Math.max(0, current.minX - other.maxX, other.minX - current.maxX);
                const yDist = Math.max(0, current.minY - other.maxY, other.minY - current.maxY);

                if (xDist < distanceThreshold && yDist < distanceThreshold) {
                    current.minX = Math.min(current.minX, other.minX);
                    current.minY = Math.min(current.minY, other.minY);
                    current.maxX = Math.max(current.maxX, other.maxX);
                    current.maxY = Math.max(current.maxY, other.maxY);
                    visited.add(j);
                    changed = true;
                }
            }
            newMerged.push(current);
        }
        merged = newMerged;
    }
    return merged;
};
