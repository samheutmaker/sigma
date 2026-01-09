/**
 * Canvas Renderer with WebGL acceleration
 */

import { Utils, type Point, type Rect } from './utils.ts';
import type {
    DesignObject,
    Rectangle,
    Ellipse,
    Line,
    TextObject,
    Frame,
    Path,
    Group,
    Component,
    ComponentInstance,
    ImageObject,
    Gradient,
    PathPoint
} from './objects.ts';

export interface Viewport {
    offsetX: number;
    offsetY: number;
    zoom: number;
}

export interface HandleInfo {
    type: string;
    object: DesignObject;
}

export interface PathPointInfo {
    type: 'anchor' | 'handleIn' | 'handleOut';
    index: number;
    point: PathPoint;
}

export class Renderer {
    canvas: HTMLCanvasElement;
    overlayCanvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    overlayCtx: CanvasRenderingContext2D;
    viewport: Viewport;
    selectedObjects: DesignObject[];
    selectionRect: Rect | null;
    hoveredHandle: HandleInfo | null;
    showGrid: boolean;
    gridSize: number;
    needsRender: boolean;
    animationId: number | null;
    objects: DesignObject[];
    width: number;
    height: number;
    dpr: number;
    private _initialized: boolean;
    editingPath: Path | null;
    selectedPointIndex: number;

    constructor(canvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.overlayCanvas = overlayCanvas;
        this.ctx = canvas.getContext('2d', { alpha: false })!;
        this.overlayCtx = overlayCanvas.getContext('2d')!;

        this.viewport = {
            offsetX: 0,
            offsetY: 0,
            zoom: 1
        };

        this.selectedObjects = [];
        this.selectionRect = null;
        this.hoveredHandle = null;
        this.showGrid = true;
        this.gridSize = 10;
        this.needsRender = true;
        this.animationId = null;
        this.objects = [];
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this._initialized = false;
        this.editingPath = null;
        this.selectedPointIndex = -1;

        this.init();
    }

    init(): void {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.startRenderLoop();
    }

    resize(): void {
        const container = this.canvas.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.overlayCanvas.style.width = rect.width + 'px';
        this.overlayCanvas.style.height = rect.height + 'px';

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.overlayCanvas.width = rect.width * dpr;
        this.overlayCanvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);
        this.overlayCtx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;
        this.dpr = dpr;

        if (!this._initialized) {
            this.viewport.offsetX = this.width / 2;
            this.viewport.offsetY = this.height / 2;
            this._initialized = true;
        }

        this.needsRender = true;
    }

    startRenderLoop(): void {
        const render = () => {
            if (this.needsRender && this.objects) {
                this.render(this.objects);
                this.renderOverlay();
                this.needsRender = false;
            }
            this.animationId = requestAnimationFrame(render);
        };
        render();
    }

    stopRenderLoop(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    requestRender(): void {
        this.needsRender = true;
    }

    setObjects(objects: DesignObject[]): void {
        this.objects = objects;
        this.requestRender();
    }

    setSelection(selectedObjects: DesignObject[]): void {
        this.selectedObjects = selectedObjects;
        this.requestRender();
    }

    setSelectionRect(rect: Rect | null): void {
        this.selectionRect = rect;
        this.requestRender();
    }

    setViewport(viewport: Partial<Viewport>): void {
        this.viewport = { ...this.viewport, ...viewport };
        this.requestRender();
    }

    worldToScreen(x: number, y: number): Point {
        return {
            x: x * this.viewport.zoom + this.viewport.offsetX,
            y: y * this.viewport.zoom + this.viewport.offsetY
        };
    }

    screenToWorld(x: number, y: number): Point {
        return {
            x: (x - this.viewport.offsetX) / this.viewport.zoom,
            y: (y - this.viewport.offsetY) / this.viewport.zoom
        };
    }

    render(objects: DesignObject[]): void {
        const ctx = this.ctx;
        const zoom = this.viewport.zoom;
        const offsetX = this.viewport.offsetX;
        const offsetY = this.viewport.offsetY;

        ctx.fillStyle = '#191919';
        ctx.fillRect(0, 0, this.width, this.height);

        if (this.showGrid && zoom > 0.3) {
            this.drawGrid(ctx);
        }

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(zoom, zoom);

        objects.forEach(obj => {
            if (obj.visible) {
                this.renderObject(ctx, obj);
            }
        });

        ctx.restore();
    }

    drawGrid(ctx: CanvasRenderingContext2D): void {
        const zoom = this.viewport.zoom;
        const offsetX = this.viewport.offsetX;
        const offsetY = this.viewport.offsetY;

        let gridSize = this.gridSize;

        while (gridSize * zoom < 10) gridSize *= 5;
        while (gridSize * zoom > 50) gridSize /= 5;

        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;

        const startX = Math.floor(-offsetX / zoom / gridSize) * gridSize;
        const endX = Math.ceil((this.width - offsetX) / zoom / gridSize) * gridSize;
        const startY = Math.floor(-offsetY / zoom / gridSize) * gridSize;
        const endY = Math.ceil((this.height - offsetY) / zoom / gridSize) * gridSize;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = x * zoom + offsetX;
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.height);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            const screenY = y * zoom + offsetY;
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.width, screenY);
        }
        ctx.stroke();

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(offsetX, 0);
        ctx.lineTo(offsetX, this.height);
        ctx.moveTo(0, offsetY);
        ctx.lineTo(this.width, offsetY);
        ctx.stroke();
    }

    renderObject(ctx: CanvasRenderingContext2D, obj: DesignObject): void {
        ctx.save();

        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;

        if (obj.rotation) {
            ctx.translate(cx, cy);
            ctx.rotate(obj.rotation * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        ctx.globalAlpha = obj.opacity;
        ctx.globalCompositeOperation = obj.blendMode as GlobalCompositeOperation;

        if (obj.blur > 0) {
            ctx.filter = `blur(${obj.blur}px)`;
        }

        if (obj.shadows && obj.shadows.length > 0) {
            const shadow = obj.shadows.find(s => s.visible && s.type === 'drop');
            if (shadow) {
                ctx.shadowColor = shadow.color;
                ctx.shadowBlur = shadow.blur;
                ctx.shadowOffsetX = shadow.offsetX;
                ctx.shadowOffsetY = shadow.offsetY;
            }
        }

        switch (obj.type) {
            case 'rectangle':
                this.renderRectangle(ctx, obj as Rectangle);
                break;
            case 'ellipse':
                this.renderEllipse(ctx, obj as Ellipse);
                break;
            case 'line':
                this.renderLine(ctx, obj as Line);
                break;
            case 'text':
                this.renderText(ctx, obj as TextObject);
                break;
            case 'frame':
                this.renderFrame(ctx, obj as Frame);
                break;
            case 'path':
                this.renderPath(ctx, obj as Path);
                break;
            case 'group':
                this.renderGroup(ctx, obj as Group);
                break;
            case 'image':
                this.renderImage(ctx, obj as ImageObject);
                break;
            case 'component':
                this.renderComponent(ctx, obj as Component);
                break;
            case 'componentInstance':
                this.renderComponentInstance(ctx, obj as ComponentInstance);
                break;
        }

        ctx.filter = 'none';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.restore();
    }

    createGradient(ctx: CanvasRenderingContext2D, gradient: Gradient, x: number, y: number, width: number, height: number): CanvasGradient | null {
        if (!gradient) return null;

        let grad: CanvasGradient | undefined;
        if (gradient.type === 'linear') {
            const angleRad = (gradient.angle - 90) * Math.PI / 180;
            const cx = x + width / 2;
            const cy = y + height / 2;
            const len = Math.sqrt(width * width + height * height) / 2;

            const x1 = cx - Math.cos(angleRad) * len;
            const y1 = cy - Math.sin(angleRad) * len;
            const x2 = cx + Math.cos(angleRad) * len;
            const y2 = cy + Math.sin(angleRad) * len;

            grad = ctx.createLinearGradient(x1, y1, x2, y2);
        } else if (gradient.type === 'radial') {
            const cx = x + width * gradient.centerX;
            const cy = y + height * gradient.centerY;
            const rx = width * gradient.radiusX;
            const ry = height * gradient.radiusY;
            const r = Math.max(rx, ry);

            grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        }

        if (grad) {
            gradient.stops.forEach(stop => {
                grad!.addColorStop(stop.offset, stop.color);
            });
        }

        return grad || null;
    }

    getFillStyle(ctx: CanvasRenderingContext2D, obj: DesignObject): string | CanvasGradient | null {
        if (obj.gradient) {
            return this.createGradient(ctx, obj.gradient, obj.x, obj.y, obj.width, obj.height);
        }
        return obj.fill;
    }

    renderRectangle(ctx: CanvasRenderingContext2D, obj: Rectangle): void {
        const { x, y, width, height, cornerRadius, fill, fillOpacity, stroke, strokeWidth, strokeOpacity } = obj;

        ctx.beginPath();
        if (cornerRadius > 0) {
            const r = Math.min(cornerRadius, width / 2, height / 2);
            ctx.roundRect(x, y, width, height, r);
        } else {
            ctx.rect(x, y, width, height);
        }

        const fillStyle = this.getFillStyle(ctx, obj);
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.globalAlpha = obj.opacity * fillOpacity;
            ctx.fill();
        }

        if (stroke && strokeWidth > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.globalAlpha = obj.opacity * strokeOpacity;
            ctx.stroke();
        }
    }

    renderEllipse(ctx: CanvasRenderingContext2D, obj: Ellipse): void {
        const { x, y, width, height, fillOpacity, stroke, strokeWidth, strokeOpacity } = obj;
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rx = width / 2;
        const ry = height / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

        const fillStyle = this.getFillStyle(ctx, obj);
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.globalAlpha = obj.opacity * fillOpacity;
            ctx.fill();
        }

        if (stroke && strokeWidth > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.globalAlpha = obj.opacity * strokeOpacity;
            ctx.stroke();
        }
    }

    renderLine(ctx: CanvasRenderingContext2D, obj: Line): void {
        const { x1, y1, x2, y2, stroke, strokeWidth, strokeOpacity } = obj;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        if (stroke && strokeWidth > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.globalAlpha = obj.opacity * strokeOpacity;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    renderText(ctx: CanvasRenderingContext2D, obj: TextObject): void {
        const { x, y, width, text, fontFamily, fontSize, fontWeight, fill, fillOpacity, textAlign } = obj;

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = textAlign as CanvasTextAlign;

        if (fill) {
            ctx.fillStyle = fill;
            ctx.globalAlpha = obj.opacity * fillOpacity;
        }

        const lines = this.wrapText(ctx, text, width);
        const lineHeight = fontSize * obj.lineHeight;

        let textX = x;
        if (textAlign === 'center') textX = x + width / 2;
        else if (textAlign === 'right') textX = x + width;

        lines.forEach((line, i) => {
            ctx.fillText(line, textX, y + i * lineHeight);
        });
    }

    wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length > 0 ? lines : [text];
    }

    renderFrame(ctx: CanvasRenderingContext2D, obj: Frame): void {
        const { x, y, width, height, cornerRadius, fill, fillOpacity, stroke, strokeWidth, clipContent, children } = obj;

        ctx.beginPath();
        if (cornerRadius > 0) {
            const r = Math.min(cornerRadius, width / 2, height / 2);
            ctx.roundRect(x, y, width, height, r);
        } else {
            ctx.rect(x, y, width, height);
        }

        if (fill) {
            ctx.fillStyle = fill;
            ctx.globalAlpha = obj.opacity * fillOpacity;
            ctx.fill();
        }

        if (clipContent) {
            ctx.save();
            ctx.clip();
        }

        children.forEach(child => {
            if (child.visible) {
                this.renderObject(ctx, child);
            }
        });

        if (clipContent) {
            ctx.restore();
        }

        if (stroke && strokeWidth > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.globalAlpha = obj.opacity;
            ctx.stroke();
        }
    }

    renderPath(ctx: CanvasRenderingContext2D, obj: Path): void {
        const { points, closed, fill, fillOpacity, stroke, strokeWidth, strokeOpacity } = obj;

        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0]!.x, points[0]!.y);

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1]!;
            const curr = points[i]!;

            if (prev.handleOut && curr.handleIn) {
                ctx.bezierCurveTo(
                    prev.handleOut.x, prev.handleOut.y,
                    curr.handleIn.x, curr.handleIn.y,
                    curr.x, curr.y
                );
            } else if (prev.handleOut) {
                ctx.quadraticCurveTo(prev.handleOut.x, prev.handleOut.y, curr.x, curr.y);
            } else if (curr.handleIn) {
                ctx.quadraticCurveTo(curr.handleIn.x, curr.handleIn.y, curr.x, curr.y);
            } else {
                ctx.lineTo(curr.x, curr.y);
            }
        }

        if (closed && points.length > 2) {
            const last = points[points.length - 1]!;
            const first = points[0]!;

            if (last.handleOut && first.handleIn) {
                ctx.bezierCurveTo(
                    last.handleOut.x, last.handleOut.y,
                    first.handleIn.x, first.handleIn.y,
                    first.x, first.y
                );
            } else {
                ctx.closePath();
            }
        }

        if (fill && closed) {
            ctx.fillStyle = fill;
            ctx.globalAlpha = obj.opacity * fillOpacity;
            ctx.fill();
        }

        if (stroke && strokeWidth > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.globalAlpha = obj.opacity * strokeOpacity;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    }

    renderGroup(ctx: CanvasRenderingContext2D, obj: Group): void {
        obj.children.forEach(child => {
            if (child.visible) {
                this.renderObject(ctx, child);
            }
        });
    }

    renderComponent(ctx: CanvasRenderingContext2D, obj: Component): void {
        const { x, y, width, height, cornerRadius, fill, fillOpacity, strokeWidth, clipContent, children } = obj;

        ctx.beginPath();
        if (cornerRadius > 0) {
            const r = Math.min(cornerRadius, width / 2, height / 2);
            ctx.roundRect(x, y, width, height, r);
        } else {
            ctx.rect(x, y, width, height);
        }

        if (fill) {
            ctx.fillStyle = fill;
            ctx.globalAlpha = obj.opacity * fillOpacity;
            ctx.fill();
        }

        if (clipContent) {
            ctx.save();
            ctx.clip();
        }

        children.forEach(child => {
            if (child.visible) {
                this.renderObject(ctx, child);
            }
        });

        if (clipContent) {
            ctx.restore();
        }

        ctx.strokeStyle = '#9747FF';
        ctx.lineWidth = strokeWidth > 0 ? strokeWidth : 2;
        ctx.globalAlpha = obj.opacity;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#9747FF';
        ctx.font = 'bold 10px Inter';
        ctx.fillText('◇', x + 4, y + 12);
    }

    renderComponentInstance(ctx: CanvasRenderingContext2D, obj: ComponentInstance): void {
        const master = obj.masterComponent;
        if (!master) {
            ctx.fillStyle = '#333';
            ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
            ctx.strokeStyle = '#9747FF';
            ctx.lineWidth = 2;
            ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
            return;
        }

        const scaleX = obj.width / master.width;
        const scaleY = obj.height / master.height;
        const offsetX = obj.x - master.x * scaleX;
        const offsetY = obj.y - master.y * scaleY;

        ctx.save();

        ctx.beginPath();
        if (obj.cornerRadius > 0) {
            const r = Math.min(obj.cornerRadius, obj.width / 2, obj.height / 2);
            ctx.roundRect(obj.x, obj.y, obj.width, obj.height, r);
        } else {
            ctx.rect(obj.x, obj.y, obj.width, obj.height);
        }
        ctx.clip();

        const fillStyle = obj.overrides.fill ? obj.fill : master.fill;
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.globalAlpha = obj.opacity * obj.fillOpacity;
            ctx.fill();
        }

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scaleX, scaleY);

        master.children.forEach(child => {
            if (child.visible) {
                this.renderObject(ctx, child);
            }
        });

        ctx.restore();
        ctx.restore();

        ctx.strokeStyle = '#9747FF';
        ctx.lineWidth = 1;
        ctx.globalAlpha = obj.opacity;
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

        ctx.fillStyle = '#9747FF';
        ctx.font = 'bold 10px Inter';
        ctx.fillText('◆', obj.x + 4, obj.y + 12);
    }

    renderImage(ctx: CanvasRenderingContext2D, obj: ImageObject): void {
        const { x, y, width, height, cornerRadius, stroke, strokeWidth, strokeOpacity, fit } = obj;

        if (!obj.image || !obj.image.complete) {
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, width, height);

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + width, y + height);
            ctx.moveTo(x + width, y);
            ctx.lineTo(x, y + height);
            ctx.stroke();
            return;
        }

        ctx.save();

        if (cornerRadius > 0) {
            ctx.beginPath();
            const r = Math.min(cornerRadius, width / 2, height / 2);
            ctx.roundRect(x, y, width, height, r);
            ctx.clip();
        }

        const img = obj.image;
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;

        let drawX = x, drawY = y, drawW = width, drawH = height;

        if (fit === 'cover') {
            const scale = Math.max(width / imgW, height / imgH);
            drawW = imgW * scale;
            drawH = imgH * scale;
            drawX = x + (width - drawW) / 2;
            drawY = y + (height - drawH) / 2;
        } else if (fit === 'contain') {
            const scale = Math.min(width / imgW, height / imgH);
            drawW = imgW * scale;
            drawH = imgH * scale;
            drawX = x + (width - drawW) / 2;
            drawY = y + (height - drawH) / 2;
        } else if (fit === 'none') {
            drawW = imgW;
            drawH = imgH;
            drawX = x + (width - drawW) / 2;
            drawY = y + (height - drawH) / 2;
        }

        ctx.globalAlpha = obj.opacity * obj.fillOpacity;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        ctx.restore();

        if (stroke && strokeWidth > 0) {
            ctx.beginPath();
            if (cornerRadius > 0) {
                const r = Math.min(cornerRadius, width / 2, height / 2);
                ctx.roundRect(x, y, width, height, r);
            } else {
                ctx.rect(x, y, width, height);
            }
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.globalAlpha = obj.opacity * strokeOpacity;
            ctx.stroke();
        }
    }

    renderOverlay(): void {
        const ctx = this.overlayCtx;
        const zoom = this.viewport.zoom;
        const offsetX = this.viewport.offsetX;
        const offsetY = this.viewport.offsetY;

        ctx.clearRect(0, 0, this.width, this.height);

        if (this.selectionRect) {
            ctx.strokeStyle = '#0d99ff';
            ctx.fillStyle = 'rgba(13, 153, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);

            const { x, y, width, height } = this.selectionRect;
            const screenX = x * zoom + offsetX;
            const screenY = y * zoom + offsetY;
            const screenW = width * zoom;
            const screenH = height * zoom;

            ctx.fillRect(screenX, screenY, screenW, screenH);
            ctx.strokeRect(screenX, screenY, screenW, screenH);
            ctx.setLineDash([]);
        }

        this.selectedObjects.forEach(obj => {
            this.drawSelectionBox(ctx, obj);
        });
    }

    drawSelectionBox(ctx: CanvasRenderingContext2D, obj: DesignObject): void {
        const zoom = this.viewport.zoom;
        const offsetX = this.viewport.offsetX;
        const offsetY = this.viewport.offsetY;

        if (obj.type === 'path' && this.editingPath === obj) {
            this.drawPathHandles(ctx, obj as Path);
            return;
        }

        const bounds = obj.bounds;
        const cx = (bounds.x + bounds.width / 2) * zoom + offsetX;
        const cy = (bounds.y + bounds.height / 2) * zoom + offsetY;
        const w = bounds.width * zoom;
        const h = bounds.height * zoom;

        ctx.save();

        if (obj.rotation) {
            ctx.translate(cx, cy);
            ctx.rotate(obj.rotation * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        ctx.strokeStyle = '#0d99ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

        const handleSize = 8;
        const handles = [
            { x: cx - w / 2, y: cy - h / 2, cursor: 'nwse' },
            { x: cx + w / 2, y: cy - h / 2, cursor: 'nesw' },
            { x: cx + w / 2, y: cy + h / 2, cursor: 'nwse' },
            { x: cx - w / 2, y: cy + h / 2, cursor: 'nesw' },
            { x: cx, y: cy - h / 2, cursor: 'ns' },
            { x: cx + w / 2, y: cy, cursor: 'ew' },
            { x: cx, y: cy + h / 2, cursor: 'ns' },
            { x: cx - w / 2, y: cy, cursor: 'ew' }
        ];

        handles.forEach(handle => {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#0d99ff';
            ctx.lineWidth = 1.5;
            ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
            ctx.strokeRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });

        const rotHandleY = cy - h / 2 - 25;
        ctx.beginPath();
        ctx.moveTo(cx, cy - h / 2);
        ctx.lineTo(cx, rotHandleY);
        ctx.strokeStyle = '#0d99ff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, rotHandleY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#0d99ff';
        ctx.stroke();

        ctx.restore();
    }

    getHandleAtPoint(x: number, y: number, selectedObjects: DesignObject[]): HandleInfo | null {
        const zoom = this.viewport.zoom;
        const offsetX = this.viewport.offsetX;
        const offsetY = this.viewport.offsetY;
        const handleSize = 12;

        for (const obj of selectedObjects) {
            const bounds = obj.bounds;
            const cx = (bounds.x + bounds.width / 2) * zoom + offsetX;
            const cy = (bounds.y + bounds.height / 2) * zoom + offsetY;
            const w = bounds.width * zoom;
            const h = bounds.height * zoom;

            const rotHandleY = cy - h / 2 - 25;
            if (Utils.distance(x, y, cx, rotHandleY) < handleSize) {
                return { type: 'rotate', object: obj };
            }

            const handles = [
                { x: cx - w / 2, y: cy - h / 2, type: 'nw' },
                { x: cx + w / 2, y: cy - h / 2, type: 'ne' },
                { x: cx + w / 2, y: cy + h / 2, type: 'se' },
                { x: cx - w / 2, y: cy + h / 2, type: 'sw' },
                { x: cx, y: cy - h / 2, type: 'n' },
                { x: cx + w / 2, y: cy, type: 'e' },
                { x: cx, y: cy + h / 2, type: 's' },
                { x: cx - w / 2, y: cy, type: 'w' }
            ];

            if (obj.rotation) {
                const rad = obj.rotation * Math.PI / 180;
                handles.forEach(h => {
                    const dx = h.x - cx;
                    const dy = h.y - cy;
                    h.x = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
                    h.y = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
                });
            }

            for (const handle of handles) {
                if (Utils.distance(x, y, handle.x, handle.y) < handleSize) {
                    return { type: handle.type, object: obj };
                }
            }
        }

        return null;
    }

    setEditingPath(path: Path | null): void {
        this.editingPath = path;
        this.requestRender();
    }

    drawPathHandles(ctx: CanvasRenderingContext2D, path: Path): void {
        const zoom = this.viewport.zoom;
        const offsetX = this.viewport.offsetX;
        const offsetY = this.viewport.offsetY;

        if (!path.points || path.points.length === 0) return;

        ctx.strokeStyle = '#0d99ff';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        path.points.forEach((point) => {
            const screenX = point.x * zoom + offsetX;
            const screenY = point.y * zoom + offsetY;

            if (point.handleIn) {
                const handleInX = point.handleIn.x * zoom + offsetX;
                const handleInY = point.handleIn.y * zoom + offsetY;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(handleInX, handleInY);
                ctx.stroke();
            }

            if (point.handleOut) {
                const handleOutX = point.handleOut.x * zoom + offsetX;
                const handleOutY = point.handleOut.y * zoom + offsetY;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(handleOutX, handleOutY);
                ctx.stroke();
            }
        });

        ctx.setLineDash([]);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0d99ff';
        ctx.lineWidth = 1.5;

        path.points.forEach((point) => {
            if (point.handleIn) {
                const handleInX = point.handleIn.x * zoom + offsetX;
                const handleInY = point.handleIn.y * zoom + offsetY;
                ctx.beginPath();
                ctx.arc(handleInX, handleInY, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }

            if (point.handleOut) {
                const handleOutX = point.handleOut.x * zoom + offsetX;
                const handleOutY = point.handleOut.y * zoom + offsetY;
                ctx.beginPath();
                ctx.arc(handleOutX, handleOutY, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        });

        const anchorSize = 8;
        path.points.forEach((point, i) => {
            const screenX = point.x * zoom + offsetX;
            const screenY = point.y * zoom + offsetY;

            ctx.fillStyle = this.selectedPointIndex === i ? '#0d99ff' : '#ffffff';
            ctx.strokeStyle = '#0d99ff';
            ctx.lineWidth = 1.5;

            ctx.fillRect(
                screenX - anchorSize / 2,
                screenY - anchorSize / 2,
                anchorSize,
                anchorSize
            );
            ctx.strokeRect(
                screenX - anchorSize / 2,
                screenY - anchorSize / 2,
                anchorSize,
                anchorSize
            );
        });

        ctx.strokeStyle = '#0d99ff';
        ctx.lineWidth = 1;
        const bounds = path.bounds;
        ctx.strokeRect(
            bounds.x * zoom + offsetX,
            bounds.y * zoom + offsetY,
            bounds.width * zoom,
            bounds.height * zoom
        );
    }

    getPathPointAtPosition(path: Path, screenX: number, screenY: number): PathPointInfo | null {
        const zoom = this.viewport.zoom;
        const offsetX = this.viewport.offsetX;
        const offsetY = this.viewport.offsetY;
        const hitRadius = 10;

        for (let i = 0; i < path.points.length; i++) {
            const point = path.points[i]!;
            const px = point.x * zoom + offsetX;
            const py = point.y * zoom + offsetY;

            if (Utils.distance(screenX, screenY, px, py) < hitRadius) {
                return { type: 'anchor', index: i, point };
            }

            if (point.handleIn) {
                const hx = point.handleIn.x * zoom + offsetX;
                const hy = point.handleIn.y * zoom + offsetY;
                if (Utils.distance(screenX, screenY, hx, hy) < hitRadius) {
                    return { type: 'handleIn', index: i, point };
                }
            }

            if (point.handleOut) {
                const hx = point.handleOut.x * zoom + offsetX;
                const hy = point.handleOut.y * zoom + offsetY;
                if (Utils.distance(screenX, screenY, hx, hy) < hitRadius) {
                    return { type: 'handleOut', index: i, point };
                }
            }
        }

        return null;
    }
}

export default Renderer;
