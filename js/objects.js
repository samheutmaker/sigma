/**
 * Design Objects for the Figma clone
 */

// Gradient class for linear and radial gradients
class Gradient {
    constructor(options = {}) {
        this.type = options.type || 'linear'; // 'linear' or 'radial'
        this.angle = options.angle || 0; // For linear gradients (degrees)
        this.stops = options.stops || [
            { offset: 0, color: '#5B5BFF' },
            { offset: 1, color: '#FF5B5B' }
        ];
        // For radial gradients
        this.centerX = options.centerX || 0.5;
        this.centerY = options.centerY || 0.5;
        this.radiusX = options.radiusX || 0.5;
        this.radiusY = options.radiusY || 0.5;
    }

    addStop(offset, color) {
        this.stops.push({ offset, color });
        this.stops.sort((a, b) => a.offset - b.offset);
    }

    serialize() {
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

    static deserialize(data) {
        if (!data) return null;
        return new Gradient(data);
    }
}

// Shadow/Effect class
class Shadow {
    constructor(options = {}) {
        this.type = options.type || 'drop'; // 'drop' or 'inner'
        this.color = options.color || 'rgba(0,0,0,0.25)';
        this.offsetX = options.offsetX || 0;
        this.offsetY = options.offsetY || 4;
        this.blur = options.blur || 8;
        this.spread = options.spread || 0;
        this.visible = options.visible !== undefined ? options.visible : true;
    }

    serialize() {
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

    static deserialize(data) {
        if (!data) return null;
        return new Shadow(data);
    }
}

// Base class for all design objects
class DesignObject {
    constructor(type, options = {}) {
        this.id = options.id || Utils.generateId();
        this.type = type;
        this.name = options.name || type.charAt(0).toUpperCase() + type.slice(1);
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 100;
        this.height = options.height || 100;
        this.rotation = options.rotation || 0;
        this.fill = options.fill || '#5B5BFF';
        this.fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 1;
        this.stroke = options.stroke || null;
        this.strokeWidth = options.strokeWidth || 0;
        this.strokeOpacity = options.strokeOpacity !== undefined ? options.strokeOpacity : 1;
        this.visible = options.visible !== undefined ? options.visible : true;
        this.locked = options.locked || false;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.blendMode = options.blendMode || 'normal';
        this.parent = null;

        // Gradient support
        this.gradient = options.gradient ? Gradient.deserialize(options.gradient) : null;

        // Effects/Shadows support
        this.shadows = [];
        if (options.shadows) {
            options.shadows.forEach(s => this.shadows.push(Shadow.deserialize(s)));
        }

        // Blur effect
        this.blur = options.blur || 0;

        // Constraints for responsive resizing
        this.constraints = options.constraints ? Constraints.deserialize(options.constraints) : null;
    }

    get bounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    get center() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    containsPoint(px, py) {
        if (this.rotation !== 0) {
            return Utils.pointInRotatedRect(px, py, this.bounds, this.rotation);
        }
        return Utils.pointInRect(px, py, this.bounds);
    }

    intersects(rect) {
        if (this.rotation !== 0) {
            const rotatedBounds = Utils.getRotatedBounds(this.bounds, this.rotation);
            return Utils.rectsIntersect(rotatedBounds, rect);
        }
        return Utils.rectsIntersect(this.bounds, rect);
    }

    clone() {
        const cloned = new this.constructor(this.serialize());
        cloned.id = Utils.generateId();
        cloned.name = this.name + ' Copy';
        return cloned;
    }

    serialize() {
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

    static deserialize(data) {
        switch (data.type) {
            case 'rectangle': return new Rectangle(data);
            case 'ellipse': return new Ellipse(data);
            case 'line': return new Line(data);
            case 'text': return new TextObject(data);
            case 'frame': return new Frame(data);
            case 'path': return new Path(data);
            case 'group': return new Group(data);
            case 'image': return new ImageObject(data);
            case 'component': return new Component(data);
            case 'componentInstance': return new ComponentInstance(data);
            default: return new DesignObject(data.type, data);
        }
    }
}

// Rectangle
class Rectangle extends DesignObject {
    constructor(options = {}) {
        super('rectangle', options);
        this.cornerRadius = options.cornerRadius || 0;
    }

    serialize() {
        return {
            ...super.serialize(),
            cornerRadius: this.cornerRadius
        };
    }
}

// Ellipse
class Ellipse extends DesignObject {
    constructor(options = {}) {
        super('ellipse', options);
    }

    containsPoint(px, py) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const rx = this.width / 2;
        const ry = this.height / 2;
        return Utils.pointInEllipse(px, py, cx, cy, rx, ry, this.rotation);
    }
}

// Line
class Line extends DesignObject {
    constructor(options = {}) {
        super('line', options);
        this.x1 = options.x1 || options.x || 0;
        this.y1 = options.y1 || options.y || 0;
        this.x2 = options.x2 || (options.x + options.width) || 100;
        this.y2 = options.y2 || (options.y + options.height) || 100;
        this.fill = null;
        this.stroke = options.stroke || '#000000';
        this.strokeWidth = options.strokeWidth || 2;
    }

    get bounds() {
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

    get x() { return this.bounds.x; }
    set x(val) {
        const dx = val - this.bounds.x;
        this.x1 += dx;
        this.x2 += dx;
    }

    get y() { return this.bounds.y; }
    set y(val) {
        const dy = val - this.bounds.y;
        this.y1 += dy;
        this.y2 += dy;
    }

    get width() { return this.bounds.width; }
    set width(val) {
        const ratio = val / this.bounds.width;
        const minX = Math.min(this.x1, this.x2);
        this.x1 = minX + (this.x1 - minX) * ratio;
        this.x2 = minX + (this.x2 - minX) * ratio;
    }

    get height() { return this.bounds.height; }
    set height(val) {
        const ratio = val / this.bounds.height;
        const minY = Math.min(this.y1, this.y2);
        this.y1 = minY + (this.y1 - minY) * ratio;
        this.y2 = minY + (this.y2 - minY) * ratio;
    }

    containsPoint(px, py) {
        const threshold = Math.max(this.strokeWidth / 2, 5);
        const d = this.distanceToPoint(px, py);
        return d <= threshold;
    }

    distanceToPoint(px, py) {
        const A = px - this.x1;
        const B = py - this.y1;
        const C = this.x2 - this.x1;
        const D = this.y2 - this.y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
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

    serialize() {
        return {
            ...super.serialize(),
            x1: this.x1,
            y1: this.y1,
            x2: this.x2,
            y2: this.y2
        };
    }
}

// Text
class TextObject extends DesignObject {
    constructor(options = {}) {
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

    serialize() {
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

// Frame (container)
class Frame extends DesignObject {
    constructor(options = {}) {
        super('frame', options);
        this.children = [];
        this.clipContent = options.clipContent !== undefined ? options.clipContent : true;
        this.fill = options.fill || '#FFFFFF';
        this.cornerRadius = options.cornerRadius || 0;

        // Auto-layout support
        this.autoLayout = options.autoLayout ? AutoLayout.deserialize(options.autoLayout) : null;

        // Restore children if provided
        if (options.children) {
            options.children.forEach(childData => {
                const child = DesignObject.deserialize(childData);
                this.addChild(child);
            });
        }
    }

    addChild(object) {
        object.parent = this;
        this.children.push(object);

        // Apply auto-layout if enabled
        if (this.autoLayout) {
            this.applyAutoLayout();
        }
    }

    removeChild(object) {
        const index = this.children.indexOf(object);
        if (index !== -1) {
            object.parent = null;
            this.children.splice(index, 1);

            // Re-apply auto-layout
            if (this.autoLayout) {
                this.applyAutoLayout();
            }
        }
    }

    // Enable auto-layout on this frame
    enableAutoLayout(options = {}) {
        this.autoLayout = new AutoLayout(options);
        this.applyAutoLayout();
    }

    // Disable auto-layout
    disableAutoLayout() {
        this.autoLayout = null;
    }

    // Apply auto-layout to children
    applyAutoLayout() {
        if (this.autoLayout) {
            this.autoLayout.apply(this);
        }
    }

    // Apply constraints when frame resizes
    applyConstraints() {
        this.children.forEach(child => {
            if (child.constraints) {
                child.constraints.apply(child, this);
            }
        });
    }

    serialize() {
        return {
            ...super.serialize(),
            clipContent: this.clipContent,
            cornerRadius: this.cornerRadius,
            autoLayout: this.autoLayout ? this.autoLayout.serialize() : null,
            children: this.children.map(child => child.serialize())
        };
    }
}

// Path (vector path with bezier curves)
class Path extends DesignObject {
    constructor(options = {}) {
        super('path', options);
        this.points = options.points || [];
        this.closed = options.closed || false;
    }

    addPoint(point) {
        this.points.push({
            x: point.x,
            y: point.y,
            handleIn: point.handleIn || null,
            handleOut: point.handleOut || null
        });
        this.updateBounds();
    }

    updateBounds() {
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

    get bounds() {
        return {
            x: this._x || 0,
            y: this._y || 0,
            width: this._width || 1,
            height: this._height || 1
        };
    }

    serialize() {
        return {
            ...super.serialize(),
            points: this.points,
            closed: this.closed
        };
    }
}

// Group
class Group extends DesignObject {
    constructor(options = {}) {
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

    addChild(object) {
        object.parent = this;
        this.children.push(object);
        this.updateBounds();
    }

    removeChild(object) {
        const index = this.children.indexOf(object);
        if (index !== -1) {
            object.parent = null;
            this.children.splice(index, 1);
            this.updateBounds();
        }
    }

    updateBounds() {
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

    serialize() {
        return {
            ...super.serialize(),
            children: this.children.map(child => child.serialize())
        };
    }
}

// Component (master component for reusable elements)
class Component extends DesignObject {
    constructor(options = {}) {
        super('component', options);
        this.children = [];
        this.clipContent = options.clipContent !== undefined ? options.clipContent : true;
        this.fill = options.fill || '#FFFFFF';
        this.cornerRadius = options.cornerRadius || 0;
        this.componentId = options.componentId || Utils.generateId();
        this.description = options.description || '';
        this.instances = new Set(); // Track instances

        // Restore children if provided
        if (options.children) {
            options.children.forEach(childData => {
                const child = DesignObject.deserialize(childData);
                this.addChild(child);
            });
        }
    }

    addChild(object) {
        object.parent = this;
        this.children.push(object);
    }

    removeChild(object) {
        const index = this.children.indexOf(object);
        if (index !== -1) {
            object.parent = null;
            this.children.splice(index, 1);
        }
    }

    // Create an instance of this component
    createInstance(x, y) {
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

    // Update all instances when master changes
    updateInstances() {
        this.instances.forEach(instance => {
            instance.syncFromMaster();
        });
    }

    serialize() {
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

// Component Instance (linked copy of a component)
class ComponentInstance extends DesignObject {
    constructor(options = {}) {
        super('componentInstance', options);
        this.componentId = options.componentId;
        this.masterComponent = options.masterComponent || null;
        this.overrides = options.overrides || {}; // Property overrides
        this.cornerRadius = options.cornerRadius || 0;

        // Sync from master on creation
        if (this.masterComponent) {
            this.syncFromMaster();
        }
    }

    // Link to a master component
    linkToMaster(component) {
        if (this.masterComponent) {
            this.masterComponent.instances.delete(this);
        }
        this.masterComponent = component;
        this.componentId = component.componentId;
        component.instances.add(this);
        this.syncFromMaster();
    }

    // Sync properties from master (respecting overrides)
    syncFromMaster() {
        if (!this.masterComponent) return;

        // Sync size if not overridden
        if (!this.overrides.width) this.width = this.masterComponent.width;
        if (!this.overrides.height) this.height = this.masterComponent.height;
        if (!this.overrides.cornerRadius) this.cornerRadius = this.masterComponent.cornerRadius;
        if (!this.overrides.fill) this.fill = this.masterComponent.fill;
        if (!this.overrides.stroke) this.stroke = this.masterComponent.stroke;
        if (!this.overrides.strokeWidth) this.strokeWidth = this.masterComponent.strokeWidth;
    }

    // Override a property (detach from master for that property)
    setOverride(property, value) {
        this.overrides[property] = true;
        this[property] = value;
    }

    // Reset override (re-link to master for that property)
    resetOverride(property) {
        delete this.overrides[property];
        this.syncFromMaster();
    }

    // Reset all overrides
    resetAllOverrides() {
        this.overrides = {};
        this.syncFromMaster();
    }

    // Detach from master (become regular group)
    detach() {
        if (this.masterComponent) {
            this.masterComponent.instances.delete(this);

            // Convert to Group with copies of master's children
            const group = new Group({
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
                name: this.name + ' (Detached)'
            });

            // Deep clone master's children
            this.masterComponent.children.forEach(child => {
                const cloned = child.clone();
                // Offset relative to instance position
                cloned.x = this.x + (child.x - this.masterComponent.x);
                cloned.y = this.y + (child.y - this.masterComponent.y);
                group.addChild(cloned);
            });

            this.masterComponent = null;
            return group;
        }
        return null;
    }

    serialize() {
        return {
            ...super.serialize(),
            componentId: this.componentId,
            overrides: this.overrides,
            cornerRadius: this.cornerRadius
        };
    }
}

// Image object
class ImageObject extends DesignObject {
    constructor(options = {}) {
        super('image', options);
        this.src = options.src || '';
        this.imageData = options.imageData || null; // Base64 data URL
        this.fit = options.fit || 'cover'; // 'cover', 'contain', 'fill', 'none'
        this.cornerRadius = options.cornerRadius || 0;
        this._image = null;

        // Load image if src provided
        if (this.src || this.imageData) {
            this.loadImage();
        }
    }

    loadImage() {
        const src = this.imageData || this.src;
        if (!src) return;

        this._image = new Image();
        this._image.onload = () => {
            if (window.app) {
                window.app.render();
            }
        };
        this._image.src = src;
    }

    get image() {
        return this._image;
    }

    serialize() {
        return {
            ...super.serialize(),
            src: this.src,
            imageData: this.imageData,
            fit: this.fit,
            cornerRadius: this.cornerRadius
        };
    }
}

// Export classes
window.Gradient = Gradient;
window.Shadow = Shadow;
window.DesignObject = DesignObject;
window.Rectangle = Rectangle;
window.Ellipse = Ellipse;
window.Line = Line;
window.TextObject = TextObject;
window.Text = TextObject; // Alias for easier usage
window.Frame = Frame;
window.Path = Path;
window.Group = Group;
window.Component = Component;
window.ComponentInstance = ComponentInstance;
window.ImageObject = ImageObject;
