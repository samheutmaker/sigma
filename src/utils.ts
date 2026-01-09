/**
 * Utility functions for the Figma clone
 */

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Viewport {
    offsetX: number;
    offsetY: number;
    zoom: number;
}

export interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}

export const Utils = {
    /**
     * Generate a unique ID
     */
    generateId(): string {
        return 'obj_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

    /**
     * Clamp a value between min and max
     */
    clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * Linear interpolation
     */
    lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    },

    /**
     * Distance between two points
     */
    distance(x1: number, y1: number, x2: number, y2: number): number {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    /**
     * Check if a point is inside a rectangle
     */
    pointInRect(px: number, py: number, rect: Rect): boolean {
        return px >= rect.x && px <= rect.x + rect.width &&
               py >= rect.y && py <= rect.y + rect.height;
    },

    /**
     * Check if a point is inside a rotated rectangle
     */
    pointInRotatedRect(px: number, py: number, rect: Rect, rotation: number): boolean {
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;

        const rad = -rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const dx = px - cx;
        const dy = py - cy;

        const rotatedX = dx * cos - dy * sin + cx;
        const rotatedY = dx * sin + dy * cos + cy;

        return this.pointInRect(rotatedX, rotatedY, rect);
    },

    /**
     * Check if a point is inside an ellipse
     */
    pointInEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number, rotation: number = 0): boolean {
        let dx = px - cx;
        let dy = py - cy;

        if (rotation !== 0) {
            const rad = -rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const newDx = dx * cos - dy * sin;
            const newDy = dx * sin + dy * cos;
            dx = newDx;
            dy = newDy;
        }

        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
    },

    /**
     * Get bounding box of rotated rectangle
     */
    getRotatedBounds(rect: Rect, rotation: number): Rect {
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const corners: Point[] = [
            { x: rect.x, y: rect.y },
            { x: rect.x + rect.width, y: rect.y },
            { x: rect.x + rect.width, y: rect.y + rect.height },
            { x: rect.x, y: rect.y + rect.height }
        ];

        const rotatedCorners = corners.map(corner => {
            const dx = corner.x - cx;
            const dy = corner.y - cy;
            return {
                x: cx + dx * cos - dy * sin,
                y: cy + dx * sin + dy * cos
            };
        });

        const xs = rotatedCorners.map(c => c.x);
        const ys = rotatedCorners.map(c => c.y);

        return {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    },

    /**
     * Check if two rectangles intersect
     */
    rectsIntersect(r1: Rect, r2: Rect): boolean {
        return !(r2.x > r1.x + r1.width ||
                 r2.x + r2.width < r1.x ||
                 r2.y > r1.y + r1.height ||
                 r2.y + r2.height < r1.y);
    },

    /**
     * Get intersection of two rectangles
     */
    getIntersection(r1: Rect, r2: Rect): Rect | null {
        const x = Math.max(r1.x, r2.x);
        const y = Math.max(r1.y, r2.y);
        const width = Math.min(r1.x + r1.width, r2.x + r2.width) - x;
        const height = Math.min(r1.y + r1.height, r2.y + r2.height) - y;

        if (width <= 0 || height <= 0) return null;
        return { x, y, width, height };
    },

    /**
     * Transform a point from screen to canvas coordinates
     */
    screenToCanvas(x: number, y: number, viewport: Viewport): Point {
        return {
            x: (x - viewport.offsetX) / viewport.zoom,
            y: (y - viewport.offsetY) / viewport.zoom
        };
    },

    /**
     * Transform a point from canvas to screen coordinates
     */
    canvasToScreen(x: number, y: number, viewport: Viewport): Point {
        return {
            x: x * viewport.zoom + viewport.offsetX,
            y: y * viewport.zoom + viewport.offsetY
        };
    },

    /**
     * Deep clone an object
     */
    deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj) as unknown as T;
        if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as unknown as T;
        if (obj instanceof Object) {
            const copy: Record<string, unknown> = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    copy[key] = this.deepClone((obj as Record<string, unknown>)[key]);
                }
            }
            return copy as T;
        }
        return obj;
    },

    /**
     * Debounce a function
     */
    debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        return function executedFunction(...args: Parameters<T>) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle a function
     */
    throttle<T extends (...args: unknown[]) => void>(func: T, limit: number): (...args: Parameters<T>) => void {
        let inThrottle = false;
        return function(this: unknown, ...args: Parameters<T>) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Convert degrees to radians
     */
    degToRad(degrees: number): number {
        return degrees * Math.PI / 180;
    },

    /**
     * Convert radians to degrees
     */
    radToDeg(radians: number): number {
        return radians * 180 / Math.PI;
    },

    /**
     * Snap value to grid
     */
    snapToGrid(value: number, gridSize: number): number {
        return Math.round(value / gridSize) * gridSize;
    },

    /**
     * Get angle between two points
     */
    getAngle(x1: number, y1: number, x2: number, y2: number): number {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    /**
     * Rotate a point around a center
     */
    rotatePoint(px: number, py: number, cx: number, cy: number, angle: number): Point {
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = px - cx;
        const dy = py - cy;
        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos
        };
    },

    /**
     * Get the corners of a rotated rectangle
     */
    getRotatedCorners(rect: Rect, rotation: number): Point[] {
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;

        const corners: Point[] = [
            { x: rect.x, y: rect.y },
            { x: rect.x + rect.width, y: rect.y },
            { x: rect.x + rect.width, y: rect.y + rect.height },
            { x: rect.x, y: rect.y + rect.height }
        ];

        return corners.map(corner => this.rotatePoint(corner.x, corner.y, cx, cy, rotation));
    },

    /**
     * Calculate bezier point at t
     */
    bezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        return {
            x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
            y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
        };
    },

    /**
     * Format a number for display
     */
    formatNumber(num: number, decimals: number = 1): number {
        return Number(num.toFixed(decimals));
    },

    /**
     * Parse CSS color to RGBA
     */
    parseColor(color: string | null | undefined): RGBA {
        if (!color) return { r: 0, g: 0, b: 0, a: 1 };

        // Handle hex
        if (color.startsWith('#')) {
            let hex = color.slice(1);
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
            return { r, g, b, a };
        }

        // Handle rgb/rgba
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return {
                r: parseInt(match[1]!),
                g: parseInt(match[2]!),
                b: parseInt(match[3]!),
                a: match[4] ? parseFloat(match[4]) : 1
            };
        }

        return { r: 0, g: 0, b: 0, a: 1 };
    },

    /**
     * Convert RGBA to hex
     */
    rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
        const toHex = (n: number): string => {
            const hex = Math.round(n).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return '#' + toHex(r) + toHex(g) + toHex(b) + (a < 1 ? toHex(a * 255) : '');
    },

    /**
     * Convert RGBA to CSS string
     */
    rgbaToString(r: number, g: number, b: number, a: number = 1): string {
        if (a === 1) {
            return `rgb(${r}, ${g}, ${b})`;
        }
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
};

export default Utils;
