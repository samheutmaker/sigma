/**
 * Design Objects for the Figma clone
 */

import { Utils, type Point, type Rect } from './utils.ts';

// Forward declarations for circular references
export type DesignObjectType =
    | 'rectangle'
    | 'ellipse'
    | 'line'
    | 'text'
    | 'frame'
    | 'path'
    | 'group'
    | 'image'
    | 'component'
    | 'componentInstance';

export interface GradientStop {
    offset: number;
    color: string;
}

export interface GradientData {
    type: 'linear' | 'radial';
    angle: number;
    stops: GradientStop[];
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
}

export interface ShadowData {
    type: 'drop' | 'inner';
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    visible: boolean;
}

export interface PathPoint {
    x: number;
    y: number;
    handleIn: Point | null;
    handleOut: Point | null;
}

export interface ConstraintsData {
    horizontal: 'left' | 'right' | 'center' | 'scale' | 'left-right';
    vertical: 'top' | 'bottom' | 'center' | 'scale' | 'top-bottom';
    originalX?: number;
    originalY?: number;
    originalWidth?: number;
    originalHeight?: number;
    originalParentWidth?: number;
    originalParentHeight?: number;
}

export interface AutoLayoutData {
    direction: 'horizontal' | 'vertical';
    primaryAxisAlign: 'start' | 'center' | 'end' | 'space-between';
    counterAxisAlign: 'start' | 'center' | 'end' | 'stretch';
    spacing: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    primaryAxisSizing: 'fixed' | 'hug';
    counterAxisSizing: 'fixed' | 'hug';
}

// Gradient class for linear and radial gradients
export class Gradient {
    type: 'linear' | 'radial';
    angle: number;
    stops: GradientStop[];
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;

    constructor(options: Partial<GradientData> = {}) {
        this.type = options.type || 'linear';
        this.angle = options.angle || 0;
        this.stops = options.stops || [
            { offset: 0, color: '#5B5BFF' },
            { offset: 1, color: '#FF5B5B' }
        ];
        this.centerX = options.centerX || 0.5;
        this.centerY = options.centerY || 0.5;
        this.radiusX = options.radiusX || 0.5;
        this.radiusY = options.radiusY || 0.5;
    }

    addStop(offset: number, color: string): void {
        this.stops.push({ offset, color });
        this.stops.sort((a, b) => a.offset - b.offset);
    }

    serialize(): GradientData {
        return {
            type: this.type,
            angle: this.angle,
            stops: this.stops,
            centerX: this.centerX,
            centerY: this.centerY,
            radiusX: this.radiusX,
            radiusY: this.radiusY
        };
    }

    static deserialize(data: GradientData | null): Gradient | null {
        if (!data) return null;
        return new Gradient(data);
    }
}

// Shadow/Effect class
export class Shadow {
    type: 'drop' | 'inner';
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    visible: boolean;

    constructor(options: Partial<ShadowData> = {}) {
        this.type = options.type || 'drop';
        this.color = options.color || 'rgba(0,0,0,0.25)';
        this.offsetX = options.offsetX || 0;
        this.offsetY = options.offsetY || 4;
        this.blur = options.blur || 8;
        this.spread = options.spread || 0;
        this.visible = options.visible !== undefined ? options.visible : true;
    }

    serialize(): ShadowData {
        return {
            type: this.type,
            color: this.color,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            blur: this.blur,
            spread: this.spread,
            visible: this.visible
        };
    }

    static deserialize(data: ShadowData | null): Shadow | null {
        if (!data) return null;
        return new Shadow(data);
    }
}

// Constraints class (forward reference - will be imported from autolayout)
export class Constraints {
    horizontal: 'left' | 'right' | 'center' | 'scale' | 'left-right';
    vertical: 'top' | 'bottom' | 'center' | 'scale' | 'top-bottom';
    originalX: number;
    originalY: number;
    originalWidth: number;
    originalHeight: number;
    originalParentWidth: number;
    originalParentHeight: number;

    constructor(options: Partial<ConstraintsData> = {}) {
        this.horizontal = options.horizontal || 'left';
        this.vertical = options.vertical || 'top';
        this.originalX = options.originalX || 0;
        this.originalY = options.originalY || 0;
        this.originalWidth = options.originalWidth || 0;
        this.originalHeight = options.originalHeight || 0;
        this.originalParentWidth = options.originalParentWidth || 0;
        this.originalParentHeight = options.originalParentHeight || 0;
    }

    initialize(child: DesignObject, parent: DesignObject): void {
        this.originalX = child.x - parent.x;
        this.originalY = child.y - parent.y;
        this.originalWidth = child.width;
        this.originalHeight = child.height;
        this.originalParentWidth = parent.width;
        this.originalParentHeight = parent.height;
    }

    apply(child: DesignObject, parent: DesignObject): void {
        const parentDeltaW = parent.width - this.originalParentWidth;
        const parentDeltaH = parent.height - this.originalParentHeight;

        switch (this.horizontal) {
            case 'left':
                child.x = parent.x + this.originalX;
                break;
            case 'right':
                child.x = parent.x + this.originalX + parentDeltaW;
                break;
            case 'center':
                child.x = parent.x + this.originalX + parentDeltaW / 2;
                break;
            case 'scale':
                const scaleX = parent.width / this.originalParentWidth;
                child.x = parent.x + this.originalX * scaleX;
                child.width = this.originalWidth * scaleX;
                break;
            case 'left-right':
                child.x = parent.x + this.originalX;
                child.width = this.originalWidth + parentDeltaW;
                break;
        }

        switch (this.vertical) {
            case 'top':
                child.y = parent.y + this.originalY;
                break;
            case 'bottom':
                child.y = parent.y + this.originalY + parentDeltaH;
                break;
            case 'center':
                child.y = parent.y + this.originalY + parentDeltaH / 2;
                break;
            case 'scale':
                const scaleY = parent.height / this.originalParentHeight;
                child.y = parent.y + this.originalY * scaleY;
                child.height = this.originalHeight * scaleY;
                break;
            case 'top-bottom':
                child.y = parent.y + this.originalY;
                child.height = this.originalHeight + parentDeltaH;
                break;
        }
    }

    serialize(): ConstraintsData {
        return {
            horizontal: this.horizontal,
            vertical: this.vertical,
            originalX: this.originalX,
            originalY: this.originalY,
            originalWidth: this.originalWidth,
            originalHeight: this.originalHeight,
            originalParentWidth: this.originalParentWidth,
            originalParentHeight: this.originalParentHeight
        };
    }

    static deserialize(data: ConstraintsData | null): Constraints | null {
        if (!data) return null;
        return new Constraints(data);
    }
}

// AutoLayout class
export class AutoLayout {
    direction: 'horizontal' | 'vertical';
    primaryAxisAlign: 'start' | 'center' | 'end' | 'space-between';
    counterAxisAlign: 'start' | 'center' | 'end' | 'stretch';
    spacing: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    primaryAxisSizing: 'fixed' | 'hug';
    counterAxisSizing: 'fixed' | 'hug';

    constructor(options: Partial<AutoLayoutData> = {}) {
        this.direction = options.direction || 'horizontal';
        this.primaryAxisAlign = options.primaryAxisAlign || 'start';
        this.counterAxisAlign = options.counterAxisAlign || 'start';
        this.spacing = options.spacing || 10;
        this.paddingTop = options.paddingTop || 0;
        this.paddingRight = options.paddingRight || 0;
        this.paddingBottom = options.paddingBottom || 0;
        this.paddingLeft = options.paddingLeft || 0;
        this.primaryAxisSizing = options.primaryAxisSizing || 'hug';
        this.counterAxisSizing = options.counterAxisSizing || 'hug';
    }

    apply(frame: Frame): void {
        const children = frame.children;
        if (children.length === 0) return;

        const isHorizontal = this.direction === 'horizontal';
        let currentPos = isHorizontal
            ? frame.x + this.paddingLeft
            : frame.y + this.paddingTop;

        let totalSize = 0;
        let maxCrossSize = 0;

        children.forEach(child => {
            if (isHorizontal) {
                totalSize += child.width;
                maxCrossSize = Math.max(maxCrossSize, child.height);
            } else {
                totalSize += child.height;
                maxCrossSize = Math.max(maxCrossSize, child.width);
            }
        });

        totalSize += this.spacing * (children.length - 1);

        children.forEach((child, index) => {
            if (isHorizontal) {
                child.x = currentPos;
                currentPos += child.width + this.spacing;

                switch (this.counterAxisAlign) {
                    case 'start':
                        child.y = frame.y + this.paddingTop;
                        break;
                    case 'center':
                        child.y = frame.y + this.paddingTop + (maxCrossSize - child.height) / 2;
                        break;
                    case 'end':
                        child.y = frame.y + this.paddingTop + maxCrossSize - child.height;
                        break;
                    case 'stretch':
                        child.y = frame.y + this.paddingTop;
                        child.height = maxCrossSize;
                        break;
                }
            } else {
                child.y = currentPos;
                currentPos += child.height + this.spacing;

                switch (this.counterAxisAlign) {
                    case 'start':
                        child.x = frame.x + this.paddingLeft;
                        break;
                    case 'center':
                        child.x = frame.x + this.paddingLeft + (maxCrossSize - child.width) / 2;
                        break;
                    case 'end':
                        child.x = frame.x + this.paddingLeft + maxCrossSize - child.width;
                        break;
                    case 'stretch':
                        child.x = frame.x + this.paddingLeft;
                        child.width = maxCrossSize;
                        break;
                }
            }
        });

        if (this.primaryAxisSizing === 'hug') {
            if (isHorizontal) {
                frame.width = totalSize + this.paddingLeft + this.paddingRight;
            } else {
                frame.height = totalSize + this.paddingTop + this.paddingBottom;
            }
        }

        if (this.counterAxisSizing === 'hug') {
            if (isHorizontal) {
                frame.height = maxCrossSize + this.paddingTop + this.paddingBottom;
            } else {
                frame.width = maxCrossSize + this.paddingLeft + this.paddingRight;
            }
        }
    }

    serialize(): AutoLayoutData {
        return {
            direction: this.direction,
            primaryAxisAlign: this.primaryAxisAlign,
            counterAxisAlign: this.counterAxisAlign,
            spacing: this.spacing,
            paddingTop: this.paddingTop,
            paddingRight: this.paddingRight,
            paddingBottom: this.paddingBottom,
            paddingLeft: this.paddingLeft,
            primaryAxisSizing: this.primaryAxisSizing,
            counterAxisSizing: this.counterAxisSizing
        };
    }

    static deserialize(data: AutoLayoutData | null): AutoLayout | null {
        if (!data) return null;
        return new AutoLayout(data);
    }
}

export interface DesignObjectData {
    id?: string;
    type: DesignObjectType;
    name?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    fill?: string | null;
    fillOpacity?: number;
    stroke?: string | null;
    strokeWidth?: number;
    strokeOpacity?: number;
    visible?: boolean;
    locked?: boolean;
    opacity?: number;
    blendMode?: string;
    gradient?: GradientData | null;
    shadows?: ShadowData[];
    blur?: number;
    constraints?: ConstraintsData | null;
    [key: string]: unknown;
}

// Base class for all design objects
export class DesignObject {
    id: string;
    type: DesignObjectType;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    fill: string | null;
    fillOpacity: number;
    stroke: string | null;
    strokeWidth: number;
    strokeOpacity: number;
    visible: boolean;
    locked: boolean;
    opacity: number;
    blendMode: string;
    parent: DesignObject | null;
    gradient: Gradient | null;
    shadows: Shadow[];
    blur: number;
    constraints: Constraints | null;

    constructor(type: DesignObjectType, options: Partial<DesignObjectData> = {}) {
        this.id = options.id || Utils.generateId();
        this.type = type;
        this.name = options.name || type.charAt(0).toUpperCase() + type.slice(1);
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 100;
        this.height = options.height || 100;
        this.rotation = options.rotation || 0;
        this.fill = options.fill !== undefined ? options.fill : '#5B5BFF';
        this.fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 1;
        this.stroke = options.stroke || null;
        this.strokeWidth = options.strokeWidth || 0;
        this.strokeOpacity = options.strokeOpacity !== undefined ? options.strokeOpacity : 1;
        this.visible = options.visible !== undefined ? options.visible : true;
        this.locked = options.locked || false;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.blendMode = options.blendMode || 'normal';
        this.parent = null;

        this.gradient = options.gradient ? Gradient.deserialize(options.gradient) : null;

        this.shadows = [];
        if (options.shadows) {
            options.shadows.forEach(s => {
                const shadow = Shadow.deserialize(s);
                if (shadow) this.shadows.push(shadow);
            });
        }

        this.blur = options.blur || 0;
        this.constraints = options.constraints ? Constraints.deserialize(options.constraints) : null;
    }

    get bounds(): Rect {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    get center(): Point {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    containsPoint(px: number, py: number): boolean {
        if (this.rotation !== 0) {
            return Utils.pointInRotatedRect(px, py, this.bounds, this.rotation);
        }
        return Utils.pointInRect(px, py, this.bounds);
    }

    intersects(rect: Rect): boolean {
        if (this.rotation !== 0) {
            const rotatedBounds = Utils.getRotatedBounds(this.bounds, this.rotation);
            return Utils.rectsIntersect(rotatedBounds, rect);
        }
        return Utils.rectsIntersect(this.bounds, rect);
    }

    clone(): DesignObject {
        const Constructor = this.constructor as new (options: DesignObjectData) => DesignObject;
        const cloned = new Constructor(this.serialize());
        cloned.id = Utils.generateId();
        cloned.name = this.name + ' Copy';
        return cloned;
    }

    serialize(): DesignObjectData {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            fill: this.fill,
            fillOpacity: this.fillOpacity,
            stroke: this.stroke,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            visible: this.visible,
            locked: this.locked,
            opacity: this.opacity,
            blendMode: this.blendMode,
            gradient: this.gradient ? this.gradient.serialize() : null,
            shadows: this.shadows.map(s => s.serialize()),
            blur: this.blur,
            constraints: this.constraints ? this.constraints.serialize() : null
        };
    }

    static deserialize(data: DesignObjectData): DesignObject {
        switch (data.type) {
            case 'rectangle': return new Rectangle(data);
            case 'ellipse': return new Ellipse(data);
            case 'line': return new Line(data as LineData);
            case 'text': return new TextObject(data as TextObjectData);
            case 'frame': return new Frame(data as FrameData);
            case 'path': return new Path(data as PathData);
            case 'group': return new Group(data as GroupData);
            case 'image': return new ImageObject(data as ImageObjectData);
            case 'component': return new Component(data as ComponentData);
            case 'componentInstance': return new ComponentInstance(data as ComponentInstanceData);
            default: return new DesignObject(data.type, data);
        }
    }
}

export interface RectangleData extends DesignObjectData {
    cornerRadius?: number;
}

// Rectangle
export class Rectangle extends DesignObject {
    cornerRadius: number;

    constructor(options: Partial<RectangleData> = {}) {
        super('rectangle', options);
        this.cornerRadius = options.cornerRadius || 0;
    }

    serialize(): RectangleData {
        return {
            ...super.serialize(),
            cornerRadius: this.cornerRadius
        };
    }
}

// Ellipse
export class Ellipse extends DesignObject {
    constructor(options: Partial<DesignObjectData> = {}) {
        super('ellipse', options);
    }

    containsPoint(px: number, py: number): boolean {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const rx = this.width / 2;
        const ry = this.height / 2;
        return Utils.pointInEllipse(px, py, cx, cy, rx, ry, this.rotation);
    }
}

export interface LineData extends DesignObjectData {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
}

// Line
export class Line extends DesignObject {
    x1: number;
    y1: number;
    x2: number;
    y2: number;

    constructor(options: Partial<LineData> = {}) {
        super('line', options);
        this.x1 = options.x1 ?? options.x ?? 0;
        this.y1 = options.y1 ?? options.y ?? 0;
        this.x2 = options.x2 ?? ((options.x ?? 0) + (options.width ?? 100));
        this.y2 = options.y2 ?? ((options.y ?? 0) + (options.height ?? 100));
        this.fill = null;
        this.stroke = options.stroke || '#000000';
        this.strokeWidth = options.strokeWidth || 2;
    }

    get bounds(): Rect {
        const minX = Math.min(this.x1, this.x2);
        const minY = Math.min(this.y1, this.y2);
        const maxX = Math.max(this.x1, this.x2);
        const maxY = Math.max(this.y1, this.y2);
        return {
            x: minX,
            y: minY,
            width: maxX - minX || 1,
            height: maxY - minY || 1
        };
    }

    override get x(): number { return this.bounds.x; }
    override set x(val: number) {
        const dx = val - this.bounds.x;
        this.x1 += dx;
        this.x2 += dx;
    }

    override get y(): number { return this.bounds.y; }
    override set y(val: number) {
        const dy = val - this.bounds.y;
        this.y1 += dy;
        this.y2 += dy;
    }

    override get width(): number { return this.bounds.width; }
    override set width(val: number) {
        const currentWidth = this.bounds.width;
        if (currentWidth === 0) return;
        const ratio = val / currentWidth;
        const minX = Math.min(this.x1, this.x2);
        this.x1 = minX + (this.x1 - minX) * ratio;
        this.x2 = minX + (this.x2 - minX) * ratio;
    }

    override get height(): number { return this.bounds.height; }
    override set height(val: number) {
        const currentHeight = this.bounds.height;
        if (currentHeight === 0) return;
        const ratio = val / currentHeight;
        const minY = Math.min(this.y1, this.y2);
        this.y1 = minY + (this.y1 - minY) * ratio;
        this.y2 = minY + (this.y2 - minY) * ratio;
    }

    containsPoint(px: number, py: number): boolean {
        const threshold = Math.max(this.strokeWidth / 2, 5);
        const d = this.distanceToPoint(px, py);
        return d <= threshold;
    }

    distanceToPoint(px: number, py: number): number {
        const A = px - this.x1;
        const B = py - this.y1;
        const C = this.x2 - this.x1;
        const D = this.y2 - this.y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx: number, yy: number;
        if (param < 0) {
            xx = this.x1;
            yy = this.y1;
        } else if (param > 1) {
            xx = this.x2;
            yy = this.y2;
        } else {
            xx = this.x1 + param * C;
            yy = this.y1 + param * D;
        }

        return Utils.distance(px, py, xx, yy);
    }

    serialize(): LineData {
        return {
            ...super.serialize(),
            x1: this.x1,
            y1: this.y1,
            x2: this.x2,
            y2: this.y2
        };
    }
}

export interface TextObjectData extends DesignObjectData {
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    lineHeight?: number;
    textAlign?: string;
}

// Text
export class TextObject extends DesignObject {
    text: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    lineHeight: number;
    textAlign: string;

    constructor(options: Partial<TextObjectData> = {}) {
        super('text', options);
        this.text = options.text || 'Text';
        this.fontFamily = options.fontFamily || 'Inter';
        this.fontSize = options.fontSize || 16;
        this.fontWeight = options.fontWeight || '400';
        this.lineHeight = options.lineHeight || 1.5;
        this.textAlign = options.textAlign || 'left';
        this.width = options.width || 100;
        this.height = options.height || 24;
    }

    serialize(): TextObjectData {
        return {
            ...super.serialize(),
            text: this.text,
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            lineHeight: this.lineHeight,
            textAlign: this.textAlign
        };
    }
}

export interface FrameData extends DesignObjectData {
    clipContent?: boolean;
    cornerRadius?: number;
    autoLayout?: AutoLayoutData | null;
    children?: DesignObjectData[];
}

// Frame (container)
export class Frame extends DesignObject {
    children: DesignObject[];
    clipContent: boolean;
    cornerRadius: number;
    autoLayout: AutoLayout | null;

    constructor(options: Partial<FrameData> = {}) {
        super('frame', options);
        this.children = [];
        this.clipContent = options.clipContent !== undefined ? options.clipContent : true;
        this.fill = options.fill || '#FFFFFF';
        this.cornerRadius = options.cornerRadius || 0;
        this.autoLayout = options.autoLayout ? AutoLayout.deserialize(options.autoLayout) : null;

        if (options.children) {
            options.children.forEach(childData => {
                const child = DesignObject.deserialize(childData);
                this.addChild(child);
            });
        }
    }

    addChild(object: DesignObject): void {
        object.parent = this;
        this.children.push(object);

        if (this.autoLayout) {
            this.applyAutoLayout();
        }
    }

    removeChild(object: DesignObject): void {
        const index = this.children.indexOf(object);
        if (index !== -1) {
            object.parent = null;
            this.children.splice(index, 1);

            if (this.autoLayout) {
                this.applyAutoLayout();
            }
        }
    }

    enableAutoLayout(options: Partial<AutoLayoutData> = {}): void {
        this.autoLayout = new AutoLayout(options);
        this.applyAutoLayout();
    }

    disableAutoLayout(): void {
        this.autoLayout = null;
    }

    applyAutoLayout(): void {
        if (this.autoLayout) {
            this.autoLayout.apply(this);
        }
    }

    applyConstraints(): void {
        this.children.forEach(child => {
            if (child.constraints) {
                child.constraints.apply(child, this);
            }
        });
    }

    serialize(): FrameData {
        return {
            ...super.serialize(),
            clipContent: this.clipContent,
            cornerRadius: this.cornerRadius,
            autoLayout: this.autoLayout ? this.autoLayout.serialize() : null,
            children: this.children.map(child => child.serialize())
        };
    }
}

export interface PathData extends DesignObjectData {
    points?: PathPoint[];
    closed?: boolean;
}

// Path (vector path with bezier curves)
export class Path extends DesignObject {
    points: PathPoint[];
    closed: boolean;
    private _x: number;
    private _y: number;
    private _width: number;
    private _height: number;

    constructor(options: Partial<PathData> = {}) {
        super('path', options);
        this.points = options.points || [];
        this.closed = options.closed || false;
        this._x = 0;
        this._y = 0;
        this._width = 1;
        this._height = 1;
        this.updateBounds();
    }

    addPoint(point: Partial<PathPoint>): void {
        this.points.push({
            x: point.x || 0,
            y: point.y || 0,
            handleIn: point.handleIn || null,
            handleOut: point.handleOut || null
        });
        this.updateBounds();
    }

    updateBounds(): void {
        if (this.points.length === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });

        this._x = minX;
        this._y = minY;
        this._width = maxX - minX || 1;
        this._height = maxY - minY || 1;
    }

    override get bounds(): Rect {
        return {
            x: this._x || 0,
            y: this._y || 0,
            width: this._width || 1,
            height: this._height || 1
        };
    }

    serialize(): PathData {
        return {
            ...super.serialize(),
            points: this.points,
            closed: this.closed
        };
    }
}

export interface GroupData extends DesignObjectData {
    children?: DesignObjectData[];
}

// Group
export class Group extends DesignObject {
    children: DesignObject[];

    constructor(options: Partial<GroupData> = {}) {
        super('group', options);
        this.children = [];
        this.fill = null;

        if (options.children) {
            options.children.forEach(childData => {
                const child = DesignObject.deserialize(childData);
                this.addChild(child);
            });
        }
    }

    addChild(object: DesignObject): void {
        object.parent = this;
        this.children.push(object);
        this.updateBounds();
    }

    removeChild(object: DesignObject): void {
        const index = this.children.indexOf(object);
        if (index !== -1) {
            object.parent = null;
            this.children.splice(index, 1);
            this.updateBounds();
        }
    }

    updateBounds(): void {
        if (this.children.length === 0) return;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.children.forEach(child => {
            const bounds = child.bounds;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        this.x = minX;
        this.y = minY;
        this.width = maxX - minX;
        this.height = maxY - minY;
    }

    serialize(): GroupData {
        return {
            ...super.serialize(),
            children: this.children.map(child => child.serialize())
        };
    }
}

export interface ComponentData extends DesignObjectData {
    clipContent?: boolean;
    cornerRadius?: number;
    componentId?: string;
    description?: string;
    children?: DesignObjectData[];
}

// Component (master component for reusable elements)
export class Component extends DesignObject {
    children: DesignObject[];
    clipContent: boolean;
    cornerRadius: number;
    componentId: string;
    description: string;
    instances: Set<ComponentInstance>;

    constructor(options: Partial<ComponentData> = {}) {
        super('component', options);
        this.children = [];
        this.clipContent = options.clipContent !== undefined ? options.clipContent : true;
        this.fill = options.fill || '#FFFFFF';
        this.cornerRadius = options.cornerRadius || 0;
        this.componentId = options.componentId || Utils.generateId();
        this.description = options.description || '';
        this.instances = new Set();

        if (options.children) {
            options.children.forEach(childData => {
                const child = DesignObject.deserialize(childData);
                this.addChild(child);
            });
        }
    }

    addChild(object: DesignObject): void {
        object.parent = this;
        this.children.push(object);
    }

    removeChild(object: DesignObject): void {
        const index = this.children.indexOf(object);
        if (index !== -1) {
            object.parent = null;
            this.children.splice(index, 1);
        }
    }

    createInstance(x?: number, y?: number): ComponentInstance {
        const instance = new ComponentInstance({
            x: x !== undefined ? x : this.x,
            y: y !== undefined ? y : this.y,
            width: this.width,
            height: this.height,
            componentId: this.componentId,
            masterComponent: this
        });
        this.instances.add(instance);
        return instance;
    }

    updateInstances(): void {
        this.instances.forEach(instance => {
            instance.syncFromMaster();
        });
    }

    serialize(): ComponentData {
        return {
            ...super.serialize(),
            clipContent: this.clipContent,
            cornerRadius: this.cornerRadius,
            componentId: this.componentId,
            description: this.description,
            children: this.children.map(child => child.serialize())
        };
    }
}

export interface ComponentInstanceData extends DesignObjectData {
    componentId?: string;
    overrides?: Record<string, boolean>;
    cornerRadius?: number;
    masterComponent?: Component;
}

// Component Instance (linked copy of a component)
export class ComponentInstance extends DesignObject {
    componentId: string;
    masterComponent: Component | null;
    overrides: Record<string, boolean>;
    cornerRadius: number;

    constructor(options: Partial<ComponentInstanceData> = {}) {
        super('componentInstance', options);
        this.componentId = options.componentId || '';
        this.masterComponent = options.masterComponent || null;
        this.overrides = options.overrides || {};
        this.cornerRadius = options.cornerRadius || 0;

        if (this.masterComponent) {
            this.syncFromMaster();
        }
    }

    linkToMaster(component: Component): void {
        if (this.masterComponent) {
            this.masterComponent.instances.delete(this);
        }
        this.masterComponent = component;
        this.componentId = component.componentId;
        component.instances.add(this);
        this.syncFromMaster();
    }

    syncFromMaster(): void {
        if (!this.masterComponent) return;

        if (!this.overrides.width) this.width = this.masterComponent.width;
        if (!this.overrides.height) this.height = this.masterComponent.height;
        if (!this.overrides.cornerRadius) this.cornerRadius = this.masterComponent.cornerRadius;
        if (!this.overrides.fill) this.fill = this.masterComponent.fill;
        if (!this.overrides.stroke) this.stroke = this.masterComponent.stroke;
        if (!this.overrides.strokeWidth) this.strokeWidth = this.masterComponent.strokeWidth;
    }

    setOverride(property: string, value: unknown): void {
        this.overrides[property] = true;
        (this as Record<string, unknown>)[property] = value;
    }

    resetOverride(property: string): void {
        delete this.overrides[property];
        this.syncFromMaster();
    }

    resetAllOverrides(): void {
        this.overrides = {};
        this.syncFromMaster();
    }

    detach(): Group | null {
        if (this.masterComponent) {
            this.masterComponent.instances.delete(this);

            const group = new Group({
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
                name: this.name + ' (Detached)'
            });

            this.masterComponent.children.forEach(child => {
                const cloned = child.clone();
                cloned.x = this.x + (child.x - this.masterComponent!.x);
                cloned.y = this.y + (child.y - this.masterComponent!.y);
                group.addChild(cloned);
            });

            this.masterComponent = null;
            return group;
        }
        return null;
    }

    serialize(): ComponentInstanceData {
        return {
            ...super.serialize(),
            componentId: this.componentId,
            overrides: this.overrides,
            cornerRadius: this.cornerRadius
        };
    }
}

export interface ImageObjectData extends DesignObjectData {
    src?: string;
    imageData?: string | null;
    fit?: 'cover' | 'contain' | 'fill' | 'none';
    cornerRadius?: number;
}

// Image object
export class ImageObject extends DesignObject {
    src: string;
    imageData: string | null;
    fit: 'cover' | 'contain' | 'fill' | 'none';
    cornerRadius: number;
    private _image: HTMLImageElement | null;

    constructor(options: Partial<ImageObjectData> = {}) {
        super('image', options);
        this.src = options.src || '';
        this.imageData = options.imageData || null;
        this.fit = options.fit || 'cover';
        this.cornerRadius = options.cornerRadius || 0;
        this._image = null;

        if (this.src || this.imageData) {
            this.loadImage();
        }
    }

    loadImage(): void {
        const src = this.imageData || this.src;
        if (!src) return;

        this._image = new Image();
        this._image.onload = () => {
            if ((window as unknown as { app?: { render: () => void } }).app) {
                (window as unknown as { app: { render: () => void } }).app.render();
            }
        };
        this._image.src = src;
    }

    get image(): HTMLImageElement | null {
        return this._image;
    }

    serialize(): ImageObjectData {
        return {
            ...super.serialize(),
            src: this.src,
            imageData: this.imageData,
            fit: this.fit,
            cornerRadius: this.cornerRadius
        };
    }
}

// Export shorthand alias
export const Text = TextObject;
