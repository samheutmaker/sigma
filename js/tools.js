/**
 * Tool system for the Figma clone
 */

class ToolManager {
    constructor(app) {
        this.app = app;
        this.currentTool = 'select';
        this.tools = {};
        this.isDrawing = false;
        this.startPoint = null;
        this.currentObject = null;

        this.registerTools();
    }

    registerTools() {
        this.tools = {
            select: new SelectTool(this.app),
            rectangle: new RectangleTool(this.app),
            ellipse: new EllipseTool(this.app),
            line: new LineTool(this.app),
            text: new TextTool(this.app),
            pen: new PenTool(this.app),
            hand: new HandTool(this.app),
            frame: new FrameTool(this.app)
        };
    }

    setTool(toolName) {
        if (this.tools[toolName]) {
            // Deactivate current tool
            if (this.tools[this.currentTool].deactivate) {
                this.tools[this.currentTool].deactivate();
            }

            this.currentTool = toolName;

            // Activate new tool
            if (this.tools[this.currentTool].activate) {
                this.tools[this.currentTool].activate();
            }

            this.updateToolUI();
        }
    }

    updateToolUI() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });

        // Update cursor
        const canvas = this.app.renderer.canvas;
        canvas.style.cursor = this.tools[this.currentTool].cursor || 'default';
    }

    handleMouseDown(e) {
        const tool = this.tools[this.currentTool];
        if (tool.onMouseDown) {
            tool.onMouseDown(e);
        }
    }

    handleMouseMove(e) {
        const tool = this.tools[this.currentTool];
        if (tool.onMouseMove) {
            tool.onMouseMove(e);
        }
    }

    handleMouseUp(e) {
        const tool = this.tools[this.currentTool];
        if (tool.onMouseUp) {
            tool.onMouseUp(e);
        }
    }

    handleDoubleClick(e) {
        const tool = this.tools[this.currentTool];
        if (tool.onDoubleClick) {
            tool.onDoubleClick(e);
        }
    }

    handleKeyDown(e) {
        const tool = this.tools[this.currentTool];
        if (tool.onKeyDown) {
            tool.onKeyDown(e);
        }
    }
}

// Base Tool class
class Tool {
    constructor(app) {
        this.app = app;
        this.cursor = 'default';
    }

    get renderer() {
        return this.app.renderer;
    }

    get viewport() {
        return this.renderer.viewport;
    }

    screenToWorld(x, y) {
        return this.renderer.screenToWorld(x, y);
    }

    getMousePos(e) {
        const rect = this.renderer.canvas.getBoundingClientRect();
        return {
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top,
            ...this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
        };
    }

    activate() {}
    deactivate() {}
    onMouseDown(e) {}
    onMouseMove(e) {}
    onMouseUp(e) {}
    onDoubleClick(e) {}
    onKeyDown(e) {}
}

// Select Tool
class SelectTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'default';
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.isMarquee = false;
        this.startPos = null;
        this.dragOffset = null;
        this.resizeHandle = null;
        this.initialBounds = null;
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.startPos = pos;

        // Check for handle hit
        const handle = this.renderer.getHandleAtPoint(pos.screenX, pos.screenY, this.app.selectedObjects);

        if (handle) {
            if (handle.type === 'rotate') {
                this.isRotating = true;
                this.rotateObject = handle.object;
                this.initialRotation = handle.object.rotation;
                const bounds = handle.object.bounds;
                this.rotateCenter = {
                    x: bounds.x + bounds.width / 2,
                    y: bounds.y + bounds.height / 2
                };
            } else {
                this.isResizing = true;
                this.resizeHandle = handle.type;
                this.resizeObject = handle.object;
                this.initialBounds = {
                    x: handle.object.x,
                    y: handle.object.y,
                    width: handle.object.width,
                    height: handle.object.height
                };
            }
            this.app.saveState();
            return;
        }

        // Check for object hit
        const hitObject = this.app.getObjectAtPoint(pos.x, pos.y);

        if (hitObject) {
            if (!e.shiftKey && !this.app.selectedObjects.includes(hitObject)) {
                this.app.selectObjects([hitObject]);
            } else if (e.shiftKey) {
                this.app.toggleSelection(hitObject);
            }

            this.isDragging = true;
            this.dragOffset = {
                x: pos.x - hitObject.x,
                y: pos.y - hitObject.y
            };
            this.app.saveState();
        } else {
            // Start marquee selection
            if (!e.shiftKey) {
                this.app.selectObjects([]);
            }
            this.isMarquee = true;
            this.marqueeStart = { x: pos.x, y: pos.y };
        }
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.isRotating) {
            const angle = Utils.getAngle(
                this.rotateCenter.x, this.rotateCenter.y,
                pos.x, pos.y
            );
            let rotation = Utils.radToDeg(angle) + 90;

            // Snap to 15 degree increments when shift is held
            if (e.shiftKey) {
                rotation = Math.round(rotation / 15) * 15;
            }

            this.rotateObject.rotation = rotation;
            this.app.render();
            return;
        }

        if (this.isResizing) {
            this.handleResize(pos, e.shiftKey, e.altKey);
            this.app.render();
            return;
        }

        if (this.isDragging && this.app.selectedObjects.length > 0) {
            const dx = pos.x - this.startPos.x;
            const dy = pos.y - this.startPos.y;

            this.app.selectedObjects.forEach(obj => {
                if (!obj._dragStart) {
                    obj._dragStart = { x: obj.x, y: obj.y };
                }
                obj.x = obj._dragStart.x + dx;
                obj.y = obj._dragStart.y + dy;

                // Snap to grid when shift is held
                if (e.shiftKey) {
                    obj.x = Utils.snapToGrid(obj.x, 10);
                    obj.y = Utils.snapToGrid(obj.y, 10);
                }
            });

            this.app.render();
            return;
        }

        if (this.isMarquee) {
            const x = Math.min(this.marqueeStart.x, pos.x);
            const y = Math.min(this.marqueeStart.y, pos.y);
            const width = Math.abs(pos.x - this.marqueeStart.x);
            const height = Math.abs(pos.y - this.marqueeStart.y);

            this.renderer.setSelectionRect({ x, y, width, height });
            return;
        }

        // Update cursor based on what's under mouse
        this.updateCursor(pos);
    }

    onMouseUp(e) {
        if (this.isMarquee) {
            const pos = this.getMousePos(e);
            const x = Math.min(this.marqueeStart.x, pos.x);
            const y = Math.min(this.marqueeStart.y, pos.y);
            const width = Math.abs(pos.x - this.marqueeStart.x);
            const height = Math.abs(pos.y - this.marqueeStart.y);

            if (width > 5 || height > 5) {
                const objects = this.app.getObjectsInRect({ x, y, width, height });
                if (e.shiftKey) {
                    this.app.addToSelection(objects);
                } else {
                    this.app.selectObjects(objects);
                }
            }

            this.renderer.setSelectionRect(null);
        }

        // Clear drag start positions
        this.app.selectedObjects.forEach(obj => {
            delete obj._dragStart;
        });

        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.isMarquee = false;
        this.resizeHandle = null;
        this.resizeObject = null;
        this.rotateObject = null;
    }

    handleResize(pos, constrain, fromCenter) {
        const obj = this.resizeObject;
        const handle = this.resizeHandle;
        const initial = this.initialBounds;

        let newX = obj.x;
        let newY = obj.y;
        let newWidth = obj.width;
        let newHeight = obj.height;

        const dx = pos.x - this.startPos.x;
        const dy = pos.y - this.startPos.y;

        switch (handle) {
            case 'nw':
                newX = initial.x + dx;
                newY = initial.y + dy;
                newWidth = initial.width - dx;
                newHeight = initial.height - dy;
                break;
            case 'ne':
                newY = initial.y + dy;
                newWidth = initial.width + dx;
                newHeight = initial.height - dy;
                break;
            case 'se':
                newWidth = initial.width + dx;
                newHeight = initial.height + dy;
                break;
            case 'sw':
                newX = initial.x + dx;
                newWidth = initial.width - dx;
                newHeight = initial.height + dy;
                break;
            case 'n':
                newY = initial.y + dy;
                newHeight = initial.height - dy;
                break;
            case 's':
                newHeight = initial.height + dy;
                break;
            case 'e':
                newWidth = initial.width + dx;
                break;
            case 'w':
                newX = initial.x + dx;
                newWidth = initial.width - dx;
                break;
        }

        // Constrain proportions
        if (constrain) {
            const ratio = initial.width / initial.height;
            if (handle === 'n' || handle === 's') {
                newWidth = newHeight * ratio;
            } else if (handle === 'e' || handle === 'w') {
                newHeight = newWidth / ratio;
            } else {
                if (Math.abs(dx) > Math.abs(dy)) {
                    newHeight = newWidth / ratio;
                } else {
                    newWidth = newHeight * ratio;
                }
            }
        }

        // Prevent negative dimensions
        if (newWidth < 1) {
            newWidth = 1;
            newX = initial.x + initial.width - 1;
        }
        if (newHeight < 1) {
            newHeight = 1;
            newY = initial.y + initial.height - 1;
        }

        obj.x = newX;
        obj.y = newY;
        obj.width = newWidth;
        obj.height = newHeight;
    }

    updateCursor(pos) {
        const canvas = this.renderer.canvas;
        const handle = this.renderer.getHandleAtPoint(pos.screenX, pos.screenY, this.app.selectedObjects);

        if (handle) {
            if (handle.type === 'rotate') {
                canvas.style.cursor = 'crosshair';
            } else {
                const cursors = {
                    nw: 'nwse-resize',
                    ne: 'nesw-resize',
                    se: 'nwse-resize',
                    sw: 'nesw-resize',
                    n: 'ns-resize',
                    s: 'ns-resize',
                    e: 'ew-resize',
                    w: 'ew-resize'
                };
                canvas.style.cursor = cursors[handle.type] || 'pointer';
            }
            return;
        }

        const hitObject = this.app.getObjectAtPoint(pos.x, pos.y);
        canvas.style.cursor = hitObject ? 'move' : 'default';
    }
}

// Rectangle Tool
class RectangleTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'crosshair';
        this.isDrawing = false;
        this.startPos = null;
        this.currentRect = null;
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.startPos = pos;
        this.isDrawing = true;

        this.currentRect = new Rectangle({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            fill: this.app.currentFill,
            stroke: this.app.currentStroke,
            strokeWidth: this.app.currentStrokeWidth
        });

        this.app.addObject(this.currentRect);
        this.app.selectObjects([this.currentRect]);
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);
        let x = Math.min(this.startPos.x, pos.x);
        let y = Math.min(this.startPos.y, pos.y);
        let width = Math.abs(pos.x - this.startPos.x);
        let height = Math.abs(pos.y - this.startPos.y);

        // Shift = constrain to square
        if (e.shiftKey) {
            const size = Math.max(width, height);
            width = size;
            height = size;
            if (pos.x < this.startPos.x) x = this.startPos.x - size;
            if (pos.y < this.startPos.y) y = this.startPos.y - size;
        }

        // Alt = draw from center
        if (e.altKey) {
            x = this.startPos.x - width;
            y = this.startPos.y - height;
            width *= 2;
            height *= 2;
        }

        this.currentRect.x = x;
        this.currentRect.y = y;
        this.currentRect.width = width;
        this.currentRect.height = height;

        this.app.render();
    }

    onMouseUp(e) {
        if (this.isDrawing) {
            // Remove if too small
            if (this.currentRect.width < 2 && this.currentRect.height < 2) {
                this.app.removeObject(this.currentRect);
                this.app.selectObjects([]);
            } else {
                this.app.saveState();
            }
        }

        this.isDrawing = false;
        this.currentRect = null;
        this.app.toolManager.setTool('select');
    }
}

// Ellipse Tool
class EllipseTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'crosshair';
        this.isDrawing = false;
        this.startPos = null;
        this.currentEllipse = null;
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.startPos = pos;
        this.isDrawing = true;

        this.currentEllipse = new Ellipse({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            fill: this.app.currentFill,
            stroke: this.app.currentStroke,
            strokeWidth: this.app.currentStrokeWidth
        });

        this.app.addObject(this.currentEllipse);
        this.app.selectObjects([this.currentEllipse]);
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);
        let x = Math.min(this.startPos.x, pos.x);
        let y = Math.min(this.startPos.y, pos.y);
        let width = Math.abs(pos.x - this.startPos.x);
        let height = Math.abs(pos.y - this.startPos.y);

        if (e.shiftKey) {
            const size = Math.max(width, height);
            width = size;
            height = size;
            if (pos.x < this.startPos.x) x = this.startPos.x - size;
            if (pos.y < this.startPos.y) y = this.startPos.y - size;
        }

        if (e.altKey) {
            x = this.startPos.x - width;
            y = this.startPos.y - height;
            width *= 2;
            height *= 2;
        }

        this.currentEllipse.x = x;
        this.currentEllipse.y = y;
        this.currentEllipse.width = width;
        this.currentEllipse.height = height;

        this.app.render();
    }

    onMouseUp(e) {
        if (this.isDrawing) {
            if (this.currentEllipse.width < 2 && this.currentEllipse.height < 2) {
                this.app.removeObject(this.currentEllipse);
                this.app.selectObjects([]);
            } else {
                this.app.saveState();
            }
        }

        this.isDrawing = false;
        this.currentEllipse = null;
        this.app.toolManager.setTool('select');
    }
}

// Line Tool
class LineTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'crosshair';
        this.isDrawing = false;
        this.currentLine = null;
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.isDrawing = true;

        this.currentLine = new Line({
            x1: pos.x,
            y1: pos.y,
            x2: pos.x,
            y2: pos.y,
            stroke: this.app.currentStroke || '#000000',
            strokeWidth: this.app.currentStrokeWidth || 2
        });

        this.app.addObject(this.currentLine);
        this.app.selectObjects([this.currentLine]);
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);
        let x2 = pos.x;
        let y2 = pos.y;

        // Shift = constrain to 45 degree angles
        if (e.shiftKey) {
            const dx = x2 - this.currentLine.x1;
            const dy = y2 - this.currentLine.y1;
            const angle = Math.atan2(dy, dx);
            const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const length = Math.sqrt(dx * dx + dy * dy);
            x2 = this.currentLine.x1 + Math.cos(snappedAngle) * length;
            y2 = this.currentLine.y1 + Math.sin(snappedAngle) * length;
        }

        this.currentLine.x2 = x2;
        this.currentLine.y2 = y2;

        this.app.render();
    }

    onMouseUp(e) {
        if (this.isDrawing) {
            const length = Utils.distance(
                this.currentLine.x1, this.currentLine.y1,
                this.currentLine.x2, this.currentLine.y2
            );
            if (length < 2) {
                this.app.removeObject(this.currentLine);
                this.app.selectObjects([]);
            } else {
                this.app.saveState();
            }
        }

        this.isDrawing = false;
        this.currentLine = null;
        this.app.toolManager.setTool('select');
    }
}

// Text Tool
class TextTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'text';
        this.textInput = null;
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);

        // Check if clicking on existing text
        const hitObject = this.app.getObjectAtPoint(pos.x, pos.y);
        if (hitObject && hitObject.type === 'text') {
            this.editText(hitObject);
            return;
        }

        // Create new text
        const textObj = new TextObject({
            x: pos.x,
            y: pos.y,
            width: 200,
            height: 24,
            text: '',
            fill: this.app.currentFill,
            fontSize: 16,
            fontFamily: 'Inter'
        });

        this.app.addObject(textObj);
        this.app.selectObjects([textObj]);
        this.editText(textObj);
    }

    editText(textObj) {
        // Remove any existing input
        if (this.textInput) {
            this.finishEditing();
        }

        const container = this.app.renderer.canvas.parentElement;
        const screenPos = this.renderer.worldToScreen(textObj.x, textObj.y);
        const zoom = this.viewport.zoom;

        this.textInput = document.createElement('textarea');
        this.textInput.id = 'text-input-overlay';
        this.textInput.value = textObj.text;
        this.textInput.style.left = screenPos.x + 'px';
        this.textInput.style.top = screenPos.y + 'px';
        this.textInput.style.width = (textObj.width * zoom) + 'px';
        this.textInput.style.minHeight = (textObj.height * zoom) + 'px';
        this.textInput.style.fontSize = (textObj.fontSize * zoom) + 'px';
        this.textInput.style.fontFamily = textObj.fontFamily;
        this.textInput.style.fontWeight = textObj.fontWeight;
        this.textInput.style.color = textObj.fill;
        this.textInput.style.lineHeight = textObj.lineHeight;
        this.textInput.style.textAlign = textObj.textAlign;

        container.appendChild(this.textInput);
        this.textInput.focus();
        this.textInput.select();

        this.editingObject = textObj;
        textObj.visible = false;
        this.app.render();

        this.textInput.addEventListener('blur', () => this.finishEditing());
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.finishEditing();
            }
        });
    }

    finishEditing() {
        if (!this.textInput || !this.editingObject) return;

        const text = this.textInput.value.trim();

        if (text) {
            this.editingObject.text = text;
            this.editingObject.visible = true;

            // Update height based on content
            const ctx = this.app.renderer.ctx;
            ctx.font = `${this.editingObject.fontWeight} ${this.editingObject.fontSize}px ${this.editingObject.fontFamily}`;
            const lines = this.app.renderer.wrapText(ctx, text, this.editingObject.width);
            this.editingObject.height = lines.length * this.editingObject.fontSize * this.editingObject.lineHeight;

            this.app.saveState();
        } else {
            this.app.removeObject(this.editingObject);
            this.app.selectObjects([]);
        }

        this.textInput.remove();
        this.textInput = null;
        this.editingObject = null;
        this.app.render();
        this.app.toolManager.setTool('select');
    }

    deactivate() {
        this.finishEditing();
    }

    onDoubleClick(e) {
        const pos = this.getMousePos(e);
        const hitObject = this.app.getObjectAtPoint(pos.x, pos.y);
        if (hitObject && hitObject.type === 'text') {
            this.editText(hitObject);
        }
    }
}

// Pen Tool with bezier curve support
class PenTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'crosshair';
        this.currentPath = null;
        this.isDrawing = false;
        this.isDraggingHandle = false;
        this.editingPath = null;
        this.selectedPointIndex = -1;
        this.dragType = null; // 'anchor', 'handleIn', 'handleOut'
    }

    activate() {
        // If a path is selected, enter edit mode
        if (this.app.selectedObjects.length === 1 &&
            this.app.selectedObjects[0].type === 'path') {
            this.editingPath = this.app.selectedObjects[0];
            this.renderer.setEditingPath(this.editingPath);
        }
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);

        // Check if clicking on existing path point when editing
        if (this.editingPath) {
            const hit = this.renderer.getPathPointAtPosition(
                this.editingPath,
                pos.screenX,
                pos.screenY
            );

            if (hit) {
                this.selectedPointIndex = hit.index;
                this.renderer.selectedPointIndex = hit.index;
                this.dragType = hit.type;
                this.isDraggingHandle = true;
                this.app.saveState();
                return;
            }

            // Check if clicking near the path to add a point
            // For now, clicking away exits edit mode
            if (!this.editingPath.containsPoint(pos.x, pos.y)) {
                this.exitEditMode();
            }
        }

        // Creating a new path
        if (!this.currentPath) {
            this.currentPath = new Path({
                stroke: this.app.currentStroke || '#000000',
                strokeWidth: this.app.currentStrokeWidth || 2,
                fill: null,
                name: 'Path'
            });
            this.app.addObject(this.currentPath);
            this.app.selectObjects([this.currentPath]);
            this.editingPath = this.currentPath;
            this.renderer.setEditingPath(this.currentPath);
        }

        // Check if clicking near first point to close path
        if (this.currentPath.points.length > 2) {
            const firstPoint = this.currentPath.points[0];
            const firstScreenX = firstPoint.x * this.viewport.zoom + this.viewport.offsetX;
            const firstScreenY = firstPoint.y * this.viewport.zoom + this.viewport.offsetY;

            if (Utils.distance(pos.screenX, pos.screenY, firstScreenX, firstScreenY) < 15) {
                this.currentPath.closed = true;
                this.currentPath.fill = this.app.currentFill;
                this.finishPath();
                return;
            }
        }

        // Add new point
        this.currentPath.addPoint({
            x: pos.x,
            y: pos.y,
            handleIn: null,
            handleOut: null
        });

        this.selectedPointIndex = this.currentPath.points.length - 1;
        this.renderer.selectedPointIndex = this.selectedPointIndex;
        this.isDrawing = true;
        this.app.render();
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);

        // Dragging a point or handle on existing path
        if (this.isDraggingHandle && this.editingPath) {
            const point = this.editingPath.points[this.selectedPointIndex];

            if (this.dragType === 'anchor') {
                // Move the anchor point and its handles
                const dx = pos.x - point.x;
                const dy = pos.y - point.y;

                point.x = pos.x;
                point.y = pos.y;

                if (point.handleIn) {
                    point.handleIn.x += dx;
                    point.handleIn.y += dy;
                }
                if (point.handleOut) {
                    point.handleOut.x += dx;
                    point.handleOut.y += dy;
                }
            } else if (this.dragType === 'handleIn') {
                point.handleIn = { x: pos.x, y: pos.y };
                // Mirror handle out if shift is NOT held (smooth point)
                if (!e.shiftKey && point.handleOut) {
                    point.handleOut = {
                        x: point.x - (pos.x - point.x),
                        y: point.y - (pos.y - point.y)
                    };
                }
            } else if (this.dragType === 'handleOut') {
                point.handleOut = { x: pos.x, y: pos.y };
                // Mirror handle in if shift is NOT held (smooth point)
                if (!e.shiftKey && point.handleIn) {
                    point.handleIn = {
                        x: point.x - (pos.x - point.x),
                        y: point.y - (pos.y - point.y)
                    };
                }
            }

            this.editingPath.updateBounds();
            this.app.render();
            return;
        }

        // Creating bezier handles while adding new point
        if (this.isDrawing && this.currentPath) {
            const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];

            // Create bezier handles by dragging
            const dx = pos.x - lastPoint.x;
            const dy = pos.y - lastPoint.y;

            // Only create handles if dragged far enough
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                lastPoint.handleOut = { x: pos.x, y: pos.y };
                lastPoint.handleIn = {
                    x: lastPoint.x - dx,
                    y: lastPoint.y - dy
                };
            }

            this.app.render();
        }

        // Update cursor based on what's under mouse
        if (this.editingPath) {
            const hit = this.renderer.getPathPointAtPosition(
                this.editingPath,
                pos.screenX,
                pos.screenY
            );
            this.renderer.canvas.style.cursor = hit ? 'pointer' : 'crosshair';
        }
    }

    onMouseUp(e) {
        this.isDrawing = false;
        this.isDraggingHandle = false;
        this.dragType = null;
    }

    onDoubleClick(e) {
        const pos = this.getMousePos(e);

        // Double-click on existing path enters edit mode
        const hitObject = this.app.getObjectAtPoint(pos.x, pos.y);
        if (hitObject && hitObject.type === 'path') {
            this.editingPath = hitObject;
            this.renderer.setEditingPath(hitObject);
            this.app.selectObjects([hitObject]);
            return;
        }

        // Double-click while drawing closes path
        if (this.currentPath && this.currentPath.points.length > 2) {
            this.currentPath.closed = true;
            this.currentPath.fill = this.app.currentFill;
        }
        this.finishPath();
    }

    onKeyDown(e) {
        // Delete selected point
        if ((e.key === 'Delete' || e.key === 'Backspace') &&
            this.editingPath && this.selectedPointIndex >= 0) {
            this.editingPath.points.splice(this.selectedPointIndex, 1);
            this.selectedPointIndex = -1;
            this.renderer.selectedPointIndex = -1;
            this.editingPath.updateBounds();
            this.app.render();
            e.preventDefault();
            return;
        }

        if (e.key === 'Escape') {
            if (this.currentPath) {
                this.finishPath();
            } else {
                this.exitEditMode();
            }
        }

        if (e.key === 'Enter') {
            this.finishPath();
        }
    }

    exitEditMode() {
        this.editingPath = null;
        this.renderer.setEditingPath(null);
        this.selectedPointIndex = -1;
        this.renderer.selectedPointIndex = -1;
        this.app.render();
        this.app.toolManager.setTool('select');
    }

    finishPath() {
        if (this.currentPath) {
            this.currentPath.updateBounds();
            if (this.currentPath.points.length < 2) {
                this.app.removeObject(this.currentPath);
                this.app.selectObjects([]);
            } else {
                this.app.saveState();
            }
        }
        this.currentPath = null;
        this.editingPath = null;
        this.renderer.setEditingPath(null);
        this.selectedPointIndex = -1;
        this.renderer.selectedPointIndex = -1;
        this.app.toolManager.setTool('select');
    }

    deactivate() {
        if (this.currentPath) {
            this.finishPath();
        } else {
            this.exitEditMode();
        }
    }
}

// Hand Tool (Pan)
class HandTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'grab';
        this.isPanning = false;
        this.lastPos = null;
    }

    onMouseDown(e) {
        this.isPanning = true;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.renderer.canvas.style.cursor = 'grabbing';
    }

    onMouseMove(e) {
        if (!this.isPanning) return;

        const dx = e.clientX - this.lastPos.x;
        const dy = e.clientY - this.lastPos.y;

        this.renderer.setViewport({
            offsetX: this.viewport.offsetX + dx,
            offsetY: this.viewport.offsetY + dy
        });

        this.lastPos = { x: e.clientX, y: e.clientY };
    }

    onMouseUp(e) {
        this.isPanning = false;
        this.renderer.canvas.style.cursor = 'grab';
    }
}

// Frame Tool
class FrameTool extends Tool {
    constructor(app) {
        super(app);
        this.cursor = 'crosshair';
        this.isDrawing = false;
        this.startPos = null;
        this.currentFrame = null;
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        this.startPos = pos;
        this.isDrawing = true;

        this.currentFrame = new Frame({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            fill: '#FFFFFF'
        });

        this.app.addObject(this.currentFrame);
        this.app.selectObjects([this.currentFrame]);
    }

    onMouseMove(e) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);
        let x = Math.min(this.startPos.x, pos.x);
        let y = Math.min(this.startPos.y, pos.y);
        let width = Math.abs(pos.x - this.startPos.x);
        let height = Math.abs(pos.y - this.startPos.y);

        this.currentFrame.x = x;
        this.currentFrame.y = y;
        this.currentFrame.width = width;
        this.currentFrame.height = height;

        this.app.render();
    }

    onMouseUp(e) {
        if (this.isDrawing) {
            if (this.currentFrame.width < 10 && this.currentFrame.height < 10) {
                // Create default sized frame
                this.currentFrame.width = 375;
                this.currentFrame.height = 812;
            }
            this.app.saveState();
        }

        this.isDrawing = false;
        this.currentFrame = null;
        this.app.toolManager.setTool('select');
    }
}

window.ToolManager = ToolManager;
window.Tool = Tool;
window.SelectTool = SelectTool;
window.RectangleTool = RectangleTool;
window.EllipseTool = EllipseTool;
window.LineTool = LineTool;
window.TextTool = TextTool;
window.PenTool = PenTool;
window.HandTool = HandTool;
window.FrameTool = FrameTool;
