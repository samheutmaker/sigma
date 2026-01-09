/**
 * Ruler and Guide system for the Figma clone
 */

import { Utils } from './utils.ts';
import type { Viewport } from './utils.ts';
import type { Renderer } from './renderer.ts';

export interface Guide {
    id: string;
    position: number;
}

export interface SnapPosition {
    x: number;
    y: number;
}

// Define minimal App interface to avoid circular dependency
export interface AppInterface {
    renderer: Renderer;
    render(): void;
}

export class GuideManager {
    app: AppInterface;
    horizontalGuides: Guide[];
    verticalGuides: Guide[];
    showRulers: boolean;
    showGuides: boolean;
    rulerSize: number;
    snapToGuides: boolean;
    snapThreshold: number;

    hRuler: HTMLElement | null;
    vRuler: HTMLElement | null;
    cornerBox: HTMLElement | null;
    hRulerCanvas: HTMLCanvasElement | null;
    vRulerCanvas: HTMLCanvasElement | null;
    hRulerCtx: CanvasRenderingContext2D | null;
    vRulerCtx: CanvasRenderingContext2D | null;

    constructor(app: AppInterface) {
        this.app = app;
        this.horizontalGuides = [];
        this.verticalGuides = [];
        this.showRulers = true;
        this.showGuides = true;
        this.rulerSize = 20;
        this.snapToGuides = true;
        this.snapThreshold = 5;

        this.hRuler = null;
        this.vRuler = null;
        this.cornerBox = null;
        this.hRulerCanvas = null;
        this.vRulerCanvas = null;
        this.hRulerCtx = null;
        this.vRulerCtx = null;

        this.init();
    }

    init(): void {
        this.createRulerElements();
        this.bindEvents();
    }

    createRulerElements(): void {
        const container = document.getElementById('canvas-container');
        if (!container) return;

        // Horizontal ruler
        this.hRuler = document.createElement('div');
        this.hRuler.className = 'ruler ruler-horizontal';
        this.hRuler.innerHTML = '<canvas class="ruler-canvas"></canvas>';
        container.appendChild(this.hRuler);

        // Vertical ruler
        this.vRuler = document.createElement('div');
        this.vRuler.className = 'ruler ruler-vertical';
        this.vRuler.innerHTML = '<canvas class="ruler-canvas"></canvas>';
        container.appendChild(this.vRuler);

        // Corner box
        this.cornerBox = document.createElement('div');
        this.cornerBox.className = 'ruler-corner';
        container.appendChild(this.cornerBox);

        // Get canvas contexts
        this.hRulerCanvas = this.hRuler.querySelector('.ruler-canvas') as HTMLCanvasElement;
        this.vRulerCanvas = this.vRuler.querySelector('.ruler-canvas') as HTMLCanvasElement;
        this.hRulerCtx = this.hRulerCanvas?.getContext('2d') || null;
        this.vRulerCtx = this.vRulerCanvas?.getContext('2d') || null;

        this.resize();
    }

    bindEvents(): void {
        window.addEventListener('resize', () => this.resize());

        // Double-click on ruler to create guide
        this.hRuler?.addEventListener('dblclick', (e: MouseEvent) => {
            const rect = this.hRuler!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const worldX = this.app.renderer.screenToWorld(x, 0).x;
            this.addGuide('vertical', worldX);
        });

        this.vRuler?.addEventListener('dblclick', (e: MouseEvent) => {
            const rect = this.vRuler!.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const worldY = this.app.renderer.screenToWorld(0, y).y;
            this.addGuide('horizontal', worldY);
        });
    }

    resize(): void {
        if (!this.hRulerCanvas || !this.vRulerCanvas || !this.hRulerCtx || !this.vRulerCtx) return;

        const container = document.getElementById('canvas-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Horizontal ruler
        this.hRulerCanvas.width = rect.width * dpr;
        this.hRulerCanvas.height = this.rulerSize * dpr;
        this.hRulerCanvas.style.width = rect.width + 'px';
        this.hRulerCanvas.style.height = this.rulerSize + 'px';
        this.hRulerCtx.scale(dpr, dpr);

        // Vertical ruler
        this.vRulerCanvas.width = this.rulerSize * dpr;
        this.vRulerCanvas.height = rect.height * dpr;
        this.vRulerCanvas.style.width = this.rulerSize + 'px';
        this.vRulerCanvas.style.height = rect.height + 'px';
        this.vRulerCtx.scale(dpr, dpr);

        this.render();
    }

    render(): void {
        if (!this.showRulers) {
            if (this.hRuler) this.hRuler.style.display = 'none';
            if (this.vRuler) this.vRuler.style.display = 'none';
            if (this.cornerBox) this.cornerBox.style.display = 'none';
            return;
        }

        if (this.hRuler) this.hRuler.style.display = 'block';
        if (this.vRuler) this.vRuler.style.display = 'block';
        if (this.cornerBox) this.cornerBox.style.display = 'block';

        this.renderHorizontalRuler();
        this.renderVerticalRuler();
    }

    renderHorizontalRuler(): void {
        const ctx = this.hRulerCtx;
        const canvas = this.hRulerCanvas;
        if (!ctx || !canvas) return;

        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = this.rulerSize;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, width, height);

        const viewport = this.app.renderer.viewport;
        const zoom = viewport.zoom;
        const offsetX = viewport.offsetX;

        // Calculate tick spacing based on zoom
        let tickSpacing = 10;
        while (tickSpacing * zoom < 10) tickSpacing *= 5;
        while (tickSpacing * zoom > 100) tickSpacing /= 5;

        const majorTickSpacing = tickSpacing * 5;

        ctx.strokeStyle = '#666';
        ctx.fillStyle = '#999';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';

        const startX = Math.floor(-offsetX / zoom / tickSpacing) * tickSpacing;
        const endX = Math.ceil((width - offsetX) / zoom / tickSpacing) * tickSpacing;

        for (let x = startX; x <= endX; x += tickSpacing) {
            const screenX = x * zoom + offsetX;
            const isMajor = Math.abs(x % majorTickSpacing) < 0.001;

            ctx.beginPath();
            ctx.moveTo(screenX, isMajor ? 5 : 12);
            ctx.lineTo(screenX, height);
            ctx.stroke();

            if (isMajor) {
                ctx.fillText(Math.round(x).toString(), screenX, 12);
            }
        }

        // Draw guide markers
        this.verticalGuides.forEach(guide => {
            const screenX = guide.position * zoom + offsetX;
            ctx.fillStyle = '#0d99ff';
            ctx.beginPath();
            ctx.moveTo(screenX - 4, height);
            ctx.lineTo(screenX + 4, height);
            ctx.lineTo(screenX, height - 6);
            ctx.closePath();
            ctx.fill();
        });
    }

    renderVerticalRuler(): void {
        const ctx = this.vRulerCtx;
        const canvas = this.vRulerCanvas;
        if (!ctx || !canvas) return;

        const width = this.rulerSize;
        const height = canvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, width, height);

        const viewport = this.app.renderer.viewport;
        const zoom = viewport.zoom;
        const offsetY = viewport.offsetY;

        let tickSpacing = 10;
        while (tickSpacing * zoom < 10) tickSpacing *= 5;
        while (tickSpacing * zoom > 100) tickSpacing /= 5;

        const majorTickSpacing = tickSpacing * 5;

        ctx.strokeStyle = '#666';
        ctx.fillStyle = '#999';
        ctx.font = '9px sans-serif';

        const startY = Math.floor(-offsetY / zoom / tickSpacing) * tickSpacing;
        const endY = Math.ceil((height - offsetY) / zoom / tickSpacing) * tickSpacing;

        for (let y = startY; y <= endY; y += tickSpacing) {
            const screenY = y * zoom + offsetY;
            const isMajor = Math.abs(y % majorTickSpacing) < 0.001;

            ctx.beginPath();
            ctx.moveTo(isMajor ? 5 : 12, screenY);
            ctx.lineTo(width, screenY);
            ctx.stroke();

            if (isMajor) {
                ctx.save();
                ctx.translate(10, screenY);
                ctx.rotate(-Math.PI / 2);
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(y).toString(), 0, 0);
                ctx.restore();
            }
        }

        // Draw guide markers
        this.horizontalGuides.forEach(guide => {
            const screenY = guide.position * zoom + offsetY;
            ctx.fillStyle = '#0d99ff';
            ctx.beginPath();
            ctx.moveTo(width, screenY - 4);
            ctx.lineTo(width, screenY + 4);
            ctx.lineTo(width - 6, screenY);
            ctx.closePath();
            ctx.fill();
        });
    }

    addGuide(orientation: 'horizontal' | 'vertical', position: number): Guide {
        const guide: Guide = { id: Utils.generateId(), position };

        if (orientation === 'horizontal') {
            this.horizontalGuides.push(guide);
        } else {
            this.verticalGuides.push(guide);
        }

        this.render();
        this.app.render();
        return guide;
    }

    removeGuide(id: string): void {
        this.horizontalGuides = this.horizontalGuides.filter(g => g.id !== id);
        this.verticalGuides = this.verticalGuides.filter(g => g.id !== id);
        this.render();
        this.app.render();
    }

    clearGuides(): void {
        this.horizontalGuides = [];
        this.verticalGuides = [];
        this.render();
        this.app.render();
    }

    // Render guides on the main canvas
    renderGuides(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
        if (!this.showGuides) return;

        const zoom = viewport.zoom;
        const offsetX = viewport.offsetX;
        const offsetY = viewport.offsetY;

        ctx.strokeStyle = '#0d99ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        // Horizontal guides
        this.horizontalGuides.forEach(guide => {
            const screenY = guide.position * zoom + offsetY;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(ctx.canvas.width / (window.devicePixelRatio || 1), screenY);
            ctx.stroke();
        });

        // Vertical guides
        this.verticalGuides.forEach(guide => {
            const screenX = guide.position * zoom + offsetX;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, ctx.canvas.height / (window.devicePixelRatio || 1));
            ctx.stroke();
        });

        ctx.setLineDash([]);
    }

    // Check if a position should snap to a guide
    getSnapPosition(x: number, y: number, width: number = 0, height: number = 0): SnapPosition {
        if (!this.snapToGuides) return { x, y };

        const threshold = this.snapThreshold / this.app.renderer.viewport.zoom;
        let snappedX = x;
        let snappedY = y;

        // Check vertical guides (snap x position)
        for (const guide of this.verticalGuides) {
            // Left edge
            if (Math.abs(x - guide.position) < threshold) {
                snappedX = guide.position;
                break;
            }
            // Right edge
            if (Math.abs(x + width - guide.position) < threshold) {
                snappedX = guide.position - width;
                break;
            }
            // Center
            if (Math.abs(x + width / 2 - guide.position) < threshold) {
                snappedX = guide.position - width / 2;
                break;
            }
        }

        // Check horizontal guides (snap y position)
        for (const guide of this.horizontalGuides) {
            // Top edge
            if (Math.abs(y - guide.position) < threshold) {
                snappedY = guide.position;
                break;
            }
            // Bottom edge
            if (Math.abs(y + height - guide.position) < threshold) {
                snappedY = guide.position - height;
                break;
            }
            // Center
            if (Math.abs(y + height / 2 - guide.position) < threshold) {
                snappedY = guide.position - height / 2;
                break;
            }
        }

        return { x: snappedX, y: snappedY };
    }

    toggleRulers(): void {
        this.showRulers = !this.showRulers;
        this.render();
    }

    toggleGuides(): void {
        this.showGuides = !this.showGuides;
        this.app.render();
    }
}

export default GuideManager;
