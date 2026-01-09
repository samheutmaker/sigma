/**
 * Main Application for Figma Clone
 */

import { Utils } from './utils.ts';
import type { Rect, Point } from './utils.ts';
import { HistoryManager } from './history.ts';
import type { HistoryState } from './history.ts';
import { Renderer } from './renderer.ts';
import { ToolManager } from './tools.ts';
import type { ToolName } from './tools.ts';
import { PanelManager } from './panels.ts';
import { ExportManager } from './export.ts';
import { GuideManager } from './guides.ts';
import { BooleanOperations } from './boolean.ts';
import type { BooleanOperationType } from './boolean.ts';
import {
    DesignObject,
    Group,
    Component,
    ComponentInstance,
    ImageObject
} from './objects.ts';

declare global {
    interface Window {
        app: FigmaApp;
    }
}

export type AlignDirection = 'left' | 'right' | 'centerH' | 'top' | 'bottom' | 'centerV';
export type DistributeDirection = 'horizontal' | 'vertical';
export type ContextAction =
    | 'duplicate' | 'delete' | 'bring-front' | 'send-back'
    | 'group' | 'ungroup' | 'create-component' | 'create-instance' | 'detach-instance'
    | 'boolean-union' | 'boolean-subtract' | 'boolean-intersect' | 'boolean-exclude';

export class FigmaApp {
    objects: DesignObject[];
    selectedObjects: DesignObject[];
    history: HistoryManager;
    clipboard: unknown[];
    components: Map<string, Component>;
    currentFill: string;
    currentStroke: string;
    currentStrokeWidth: number;
    renderer!: Renderer;
    toolManager!: ToolManager;
    panelManager!: PanelManager;
    exportManager!: ExportManager;
    guideManager!: GuideManager;
    private _previousTool: ToolName | null;

    constructor() {
        this.objects = [];
        this.selectedObjects = [];
        this.history = new HistoryManager();
        this.clipboard = [];
        this.components = new Map();

        // Default styles
        this.currentFill = '#5B5BFF';
        this.currentStroke = '#000000';
        this.currentStrokeWidth = 0;
        this._previousTool = null;

        this.init();
    }

    async init(): Promise<void> {
        // Get canvas elements
        const mainCanvas = document.getElementById('main-canvas') as HTMLCanvasElement;
        const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;

        if (!mainCanvas || !overlayCanvas) {
            console.error('Canvas elements not found');
            return;
        }

        // Initialize renderer
        this.renderer = new Renderer(mainCanvas, overlayCanvas);
        this.renderer.setObjects(this.objects);

        // Initialize managers
        this.toolManager = new ToolManager(this);
        this.panelManager = new PanelManager(this);
        this.exportManager = new ExportManager(this);
        this.guideManager = new GuideManager(this);

        // Setup event listeners
        this.setupEventListeners();
        this.setupKeyboardShortcuts();

        // Set default tool
        this.toolManager.setTool('select');

        // Initial render
        this.render();

        console.log('Figma Clone initialized');
    }

    setupEventListeners(): void {
        const canvas = this.renderer.canvas;
        const container = document.getElementById('canvas-container');

        // Mouse events
        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.toolManager.handleMouseDown(e);
        });

        canvas.addEventListener('mousemove', (e) => {
            this.toolManager.handleMouseMove(e);
        });

        canvas.addEventListener('mouseup', (e) => {
            this.toolManager.handleMouseUp(e);
        });

        canvas.addEventListener('dblclick', (e) => {
            this.toolManager.handleDoubleClick(e);
        });

        // Wheel for zoom
        container?.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.handleWheel(e);
        }, { passive: false });

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const toolBtn = btn as HTMLElement;
                const tool = toolBtn.dataset.tool as ToolName | undefined;
                if (tool) {
                    this.toolManager.setTool(tool);
                }
            });
        });

        // Zoom controls
        document.getElementById('zoom-in')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-fit')?.addEventListener('click', () => this.zoomFit());

        // Undo/Redo
        document.getElementById('undo-btn')?.addEventListener('click', () => this.undo());
        document.getElementById('redo-btn')?.addEventListener('click', () => this.redo());

        // Alignment tools
        document.getElementById('align-left')?.addEventListener('click', () => this.alignSelection('left'));
        document.getElementById('align-center-h')?.addEventListener('click', () => this.alignSelection('centerH'));
        document.getElementById('align-right')?.addEventListener('click', () => this.alignSelection('right'));
        document.getElementById('align-top')?.addEventListener('click', () => this.alignSelection('top'));
        document.getElementById('align-center-v')?.addEventListener('click', () => this.alignSelection('centerV'));
        document.getElementById('align-bottom')?.addEventListener('click', () => this.alignSelection('bottom'));

        // Export
        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportManager.show();
        });

        // Context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e);
        });

        // Click to hide context menu
        document.addEventListener('click', () => this.hideContextMenu());

        // Context menu actions
        document.querySelectorAll('#context-menu button').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionBtn = btn as HTMLElement;
                const action = actionBtn.dataset.action as ContextAction | undefined;
                if (action) {
                    this.handleContextAction(action);
                }
            });
        });

        // Drag and drop for import
        container?.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        container?.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e);
        });
    }

    setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            // Don't handle shortcuts when typing in inputs
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifier = isMac ? e.metaKey : e.ctrlKey;

            // Tool shortcuts
            if (!modifier) {
                switch (e.key.toLowerCase()) {
                    case 'v':
                        this.toolManager.setTool('select');
                        break;
                    case 'r':
                        this.toolManager.setTool('rectangle');
                        break;
                    case 'o':
                        this.toolManager.setTool('ellipse');
                        break;
                    case 'l':
                        this.toolManager.setTool('line');
                        break;
                    case 't':
                        this.toolManager.setTool('text');
                        break;
                    case 'p':
                        this.toolManager.setTool('pen');
                        break;
                    case 'h':
                        this.toolManager.setTool('hand');
                        break;
                    case 'f':
                        this.toolManager.setTool('frame');
                        break;
                }
            }

            // Modifier shortcuts
            if (modifier) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        e.preventDefault();
                        break;
                    case 'y':
                        this.redo();
                        e.preventDefault();
                        break;
                    case 'a':
                        this.selectAll();
                        e.preventDefault();
                        break;
                    case 'd':
                        this.duplicateSelection();
                        e.preventDefault();
                        break;
                    case 'g':
                        if (e.shiftKey) {
                            this.ungroupSelection();
                        } else {
                            this.groupSelection();
                        }
                        e.preventDefault();
                        break;
                    case 'k':
                        // Cmd+K: Create component
                        this.createComponent();
                        e.preventDefault();
                        break;
                    case 'b':
                        // Cmd+B: Detach instance
                        this.detachInstance();
                        e.preventDefault();
                        break;
                    case 's':
                        e.preventDefault();
                        this.exportManager.show();
                        break;
                    case 'c':
                        this.copySelection();
                        e.preventDefault();
                        break;
                    case 'x':
                        this.cutSelection();
                        e.preventDefault();
                        break;
                    case 'v':
                        this.paste();
                        e.preventDefault();
                        break;
                    case '=':
                    case '+':
                        this.zoomIn();
                        e.preventDefault();
                        break;
                    case '-':
                        this.zoomOut();
                        e.preventDefault();
                        break;
                    case '0':
                        this.zoomReset();
                        e.preventDefault();
                        break;
                }
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.deleteSelection();
                e.preventDefault();
            }

            // Escape
            if (e.key === 'Escape') {
                this.selectObjects([]);
            }

            // Arrow keys for nudging
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                if (this.selectedObjects.length > 0) {
                    const delta = e.shiftKey ? 10 : 1;
                    this.selectedObjects.forEach(obj => {
                        switch (e.key) {
                            case 'ArrowUp': obj.y -= delta; break;
                            case 'ArrowDown': obj.y += delta; break;
                            case 'ArrowLeft': obj.x -= delta; break;
                            case 'ArrowRight': obj.x += delta; break;
                        }
                    });
                    this.render();
                    this.panelManager.updatePropertiesPanel();
                    e.preventDefault();
                }
            }

            // Pass to tool
            this.toolManager.handleKeyDown(e);
        });

        // Space for hand tool (temporary)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                this._previousTool = this.toolManager.currentTool;
                this.toolManager.setTool('hand');
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' && this._previousTool) {
                this.toolManager.setTool(this._previousTool);
                this._previousTool = null;
            }
        });
    }

    // =====================
    // OBJECT MANAGEMENT
    // =====================

    addObject(object: DesignObject): void {
        this.objects.push(object);
        this.renderer.setObjects(this.objects);
        this.panelManager.updateLayersPanel();
    }

    removeObject(object: DesignObject): void {
        const index = this.objects.indexOf(object);
        if (index !== -1) {
            this.objects.splice(index, 1);
            this.renderer.setObjects(this.objects);
            this.panelManager.updateLayersPanel();
        }
    }

    getObjectAtPoint(x: number, y: number): DesignObject | null {
        // Search in reverse order (top to bottom)
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (obj.visible && !obj.locked && obj.containsPoint(x, y)) {
                return obj;
            }
        }
        return null;
    }

    getObjectsInRect(rect: Rect): DesignObject[] {
        return this.objects.filter(obj => {
            return obj.visible && !obj.locked && obj.intersects(rect);
        });
    }

    // =====================
    // SELECTION
    // =====================

    selectObjects(objects: DesignObject[]): void {
        this.selectedObjects = objects;
        this.renderer.setSelection(this.selectedObjects);
        this.panelManager.updateLayersPanel();
        this.panelManager.updatePropertiesPanel();
    }

    toggleSelection(object: DesignObject): void {
        const index = this.selectedObjects.indexOf(object);
        if (index !== -1) {
            this.selectedObjects.splice(index, 1);
        } else {
            this.selectedObjects.push(object);
        }
        this.renderer.setSelection(this.selectedObjects);
        this.panelManager.updateLayersPanel();
        this.panelManager.updatePropertiesPanel();
    }

    addToSelection(objects: DesignObject[]): void {
        objects.forEach(obj => {
            if (!this.selectedObjects.includes(obj)) {
                this.selectedObjects.push(obj);
            }
        });
        this.renderer.setSelection(this.selectedObjects);
        this.panelManager.updateLayersPanel();
        this.panelManager.updatePropertiesPanel();
    }

    selectAll(): void {
        this.selectObjects([...this.objects]);
    }

    // =====================
    // OPERATIONS
    // =====================

    deleteSelection(): void {
        if (this.selectedObjects.length === 0) return;

        this.saveState();
        this.selectedObjects.forEach(obj => {
            this.removeObject(obj);
        });
        this.selectObjects([]);
    }

    duplicateSelection(): void {
        if (this.selectedObjects.length === 0) return;

        this.saveState();
        const newObjects = this.selectedObjects.map(obj => {
            const clone = obj.clone();
            clone.x += 20;
            clone.y += 20;
            this.addObject(clone);
            return clone;
        });
        this.selectObjects(newObjects);
    }

    groupSelection(): void {
        if (this.selectedObjects.length < 2) return;

        this.saveState();
        const group = new Group();

        // Calculate bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.selectedObjects.forEach(obj => {
            minX = Math.min(minX, obj.x);
            minY = Math.min(minY, obj.y);
            maxX = Math.max(maxX, obj.x + obj.width);
            maxY = Math.max(maxY, obj.y + obj.height);
        });

        group.x = minX;
        group.y = minY;
        group.width = maxX - minX;
        group.height = maxY - minY;

        // Add objects to group
        this.selectedObjects.forEach(obj => {
            this.removeObject(obj);
            group.addChild(obj);
        });

        this.addObject(group);
        this.selectObjects([group]);
    }

    ungroupSelection(): void {
        const groups = this.selectedObjects.filter(obj => obj.type === 'group') as Group[];
        if (groups.length === 0) return;

        this.saveState();
        const ungroupedObjects: DesignObject[] = [];

        groups.forEach(group => {
            group.children.forEach(child => {
                child.parent = null;
                this.addObject(child);
                ungroupedObjects.push(child);
            });
            this.removeObject(group);
        });

        this.selectObjects(ungroupedObjects);
    }

    copySelection(): void {
        if (this.selectedObjects.length === 0) return;
        this.clipboard = this.selectedObjects.map(obj => obj.serialize());
    }

    cutSelection(): void {
        if (this.selectedObjects.length === 0) return;
        this.copySelection();
        this.deleteSelection();
    }

    paste(): void {
        if (this.clipboard.length === 0) return;

        this.saveState();
        const pastedObjects: DesignObject[] = [];

        this.clipboard.forEach(data => {
            const obj = DesignObject.deserialize(data);
            obj.id = Utils.generateId(); // New ID
            obj.name = obj.name + ' Copy';
            obj.x += 20;
            obj.y += 20;
            this.addObject(obj);
            pastedObjects.push(obj);
        });

        // Update clipboard with new positions for subsequent pastes
        this.clipboard = pastedObjects.map(obj => obj.serialize());
        this.selectObjects(pastedObjects);
    }

    alignSelection(direction: AlignDirection): void {
        if (this.selectedObjects.length < 2) return;

        this.saveState();

        // Calculate bounds of all selected objects
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.selectedObjects.forEach(obj => {
            minX = Math.min(minX, obj.x);
            minY = Math.min(minY, obj.y);
            maxX = Math.max(maxX, obj.x + obj.width);
            maxY = Math.max(maxY, obj.y + obj.height);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        this.selectedObjects.forEach(obj => {
            switch (direction) {
                case 'left':
                    obj.x = minX;
                    break;
                case 'right':
                    obj.x = maxX - obj.width;
                    break;
                case 'centerH':
                    obj.x = centerX - obj.width / 2;
                    break;
                case 'top':
                    obj.y = minY;
                    break;
                case 'bottom':
                    obj.y = maxY - obj.height;
                    break;
                case 'centerV':
                    obj.y = centerY - obj.height / 2;
                    break;
            }
        });

        this.render();
        this.panelManager.updatePropertiesPanel();
    }

    distributeSelection(direction: DistributeDirection): void {
        if (this.selectedObjects.length < 3) return;

        this.saveState();

        // Sort by position
        const sorted = [...this.selectedObjects].sort((a, b) => {
            return direction === 'horizontal' ? a.x - b.x : a.y - b.y;
        });

        if (direction === 'horizontal') {
            const totalWidth = sorted.reduce((sum, obj) => sum + obj.width, 0);
            const minX = sorted[0].x;
            const maxX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
            const spacing = (maxX - minX - totalWidth) / (sorted.length - 1);

            let currentX = minX;
            sorted.forEach(obj => {
                obj.x = currentX;
                currentX += obj.width + spacing;
            });
        } else {
            const totalHeight = sorted.reduce((sum, obj) => sum + obj.height, 0);
            const minY = sorted[0].y;
            const maxY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
            const spacing = (maxY - minY - totalHeight) / (sorted.length - 1);

            let currentY = minY;
            sorted.forEach(obj => {
                obj.y = currentY;
                currentY += obj.height + spacing;
            });
        }

        this.render();
        this.panelManager.updatePropertiesPanel();
    }

    bringToFront(): void {
        if (this.selectedObjects.length === 0) return;

        this.saveState();
        this.selectedObjects.forEach(obj => {
            const index = this.objects.indexOf(obj);
            if (index !== -1) {
                this.objects.splice(index, 1);
                this.objects.push(obj);
            }
        });
        this.render();
        this.panelManager.updateLayersPanel();
    }

    sendToBack(): void {
        if (this.selectedObjects.length === 0) return;

        this.saveState();
        this.selectedObjects.forEach(obj => {
            const index = this.objects.indexOf(obj);
            if (index !== -1) {
                this.objects.splice(index, 1);
                this.objects.unshift(obj);
            }
        });
        this.render();
        this.panelManager.updateLayersPanel();
    }

    // =====================
    // COMPONENTS
    // =====================

    createComponent(): Component | undefined {
        if (this.selectedObjects.length === 0) return;

        this.saveState();

        // Calculate bounds of selection
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.selectedObjects.forEach(obj => {
            minX = Math.min(minX, obj.x);
            minY = Math.min(minY, obj.y);
            maxX = Math.max(maxX, obj.x + obj.width);
            maxY = Math.max(maxY, obj.y + obj.height);
        });

        // Create component
        const component = new Component({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            name: 'Component',
            fill: null
        });

        // Move selected objects into component
        this.selectedObjects.forEach(obj => {
            this.removeObject(obj);
            component.addChild(obj);
        });

        // Register component
        this.components.set(component.componentId, component);

        this.addObject(component);
        this.selectObjects([component]);
        this.panelManager.updateLayersPanel();

        return component;
    }

    createInstanceFromComponent(component: Component, x: number, y: number): ComponentInstance | null {
        if (!component || component.type !== 'component') return null;

        this.saveState();

        const instance = component.createInstance(x, y);
        instance.name = component.name + ' Instance';

        this.addObject(instance);
        this.selectObjects([instance]);

        return instance;
    }

    duplicateAsInstance(): ComponentInstance | null {
        // If selection is a component, create an instance
        if (this.selectedObjects.length === 1 && this.selectedObjects[0].type === 'component') {
            const component = this.selectedObjects[0] as Component;
            const instance = this.createInstanceFromComponent(
                component,
                component.x + 20,
                component.y + 20
            );
            return instance;
        }

        // If selection is an instance, create another instance from its master
        if (this.selectedObjects.length === 1 && this.selectedObjects[0].type === 'componentInstance') {
            const instance = this.selectedObjects[0] as ComponentInstance;
            if (instance.masterComponent) {
                const newInstance = this.createInstanceFromComponent(
                    instance.masterComponent,
                    instance.x + 20,
                    instance.y + 20
                );
                return newInstance;
            }
        }

        return null;
    }

    detachInstance(): void {
        const instances = this.selectedObjects.filter(obj => obj.type === 'componentInstance') as ComponentInstance[];
        if (instances.length === 0) return;

        this.saveState();
        const detachedGroups: Group[] = [];

        instances.forEach(instance => {
            const group = instance.detach();
            if (group) {
                // Replace instance with group
                const index = this.objects.indexOf(instance);
                if (index !== -1) {
                    this.objects.splice(index, 1, group);
                }
                detachedGroups.push(group);
            }
        });

        this.renderer.setObjects(this.objects);
        this.selectObjects(detachedGroups);
        this.panelManager.updateLayersPanel();
    }

    // Find component by ID (for linking instances after deserialization)
    getComponentById(componentId: string): Component | undefined {
        return this.components.get(componentId);
    }

    // Register a component (used during deserialization)
    registerComponent(component: Component): void {
        if (component && component.type === 'component') {
            this.components.set(component.componentId, component);
        }
    }

    // =====================
    // ZOOM & PAN
    // =====================

    handleWheel(e: WheelEvent): void {
        const rect = this.renderer.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Pan with ctrl/cmd or middle mouse
        if (e.ctrlKey || e.metaKey || e.buttons === 4) {
            const viewport = this.renderer.viewport;
            this.renderer.setViewport({
                offsetX: viewport.offsetX - e.deltaX,
                offsetY: viewport.offsetY - e.deltaY
            });
        } else {
            // Zoom
            const delta = -e.deltaY * 0.001;
            this.zoomAtPoint(mouseX, mouseY, delta);
        }

        this.updateZoomDisplay();
    }

    zoomAtPoint(screenX: number, screenY: number, delta: number): void {
        const viewport = this.renderer.viewport;
        const oldZoom = viewport.zoom;
        const newZoom = Utils.clamp(oldZoom * (1 + delta), 0.1, 10);

        // Calculate new offset to zoom towards mouse position
        const worldX = (screenX - viewport.offsetX) / oldZoom;
        const worldY = (screenY - viewport.offsetY) / oldZoom;

        this.renderer.setViewport({
            zoom: newZoom,
            offsetX: screenX - worldX * newZoom,
            offsetY: screenY - worldY * newZoom
        });

        this.updateZoomDisplay();
    }

    zoomIn(): void {
        const viewport = this.renderer.viewport;
        const newZoom = Utils.clamp(viewport.zoom * 1.25, 0.1, 10);
        this.zoomToCenter(newZoom);
    }

    zoomOut(): void {
        const viewport = this.renderer.viewport;
        const newZoom = Utils.clamp(viewport.zoom / 1.25, 0.1, 10);
        this.zoomToCenter(newZoom);
    }

    zoomReset(): void {
        this.zoomToCenter(1);
    }

    zoomToCenter(newZoom: number): void {
        const viewport = this.renderer.viewport;
        const centerX = this.renderer.width / 2;
        const centerY = this.renderer.height / 2;

        const worldX = (centerX - viewport.offsetX) / viewport.zoom;
        const worldY = (centerY - viewport.offsetY) / viewport.zoom;

        this.renderer.setViewport({
            zoom: newZoom,
            offsetX: centerX - worldX * newZoom,
            offsetY: centerY - worldY * newZoom
        });

        this.updateZoomDisplay();
    }

    zoomFit(): void {
        if (this.objects.length === 0) {
            this.zoomReset();
            return;
        }

        // Calculate bounds
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.objects.forEach(obj => {
            const bounds = obj.bounds;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const padding = 50;

        const scaleX = (this.renderer.width - padding * 2) / contentWidth;
        const scaleY = (this.renderer.height - padding * 2) / contentHeight;
        const newZoom = Utils.clamp(Math.min(scaleX, scaleY), 0.1, 10);

        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;

        this.renderer.setViewport({
            zoom: newZoom,
            offsetX: this.renderer.width / 2 - contentCenterX * newZoom,
            offsetY: this.renderer.height / 2 - contentCenterY * newZoom
        });

        this.updateZoomDisplay();
    }

    updateZoomDisplay(): void {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round(this.renderer.viewport.zoom * 100) + '%';
        }
    }

    // =====================
    // HISTORY
    // =====================

    saveState(): void {
        this.history.push({
            objects: this.objects.map(obj => obj.serialize()),
            selectedIds: this.selectedObjects.map(obj => obj.id)
        });
        this.updateHistoryButtons();
    }

    undo(): void {
        const currentState: HistoryState = {
            objects: this.objects.map(obj => obj.serialize()),
            selectedIds: this.selectedObjects.map(obj => obj.id)
        };

        const previousState = this.history.undo(currentState);
        if (previousState) {
            this.restoreState(previousState);
        }
    }

    redo(): void {
        const state = this.history.redo();
        if (state) {
            this.restoreState(state);
        }
    }

    restoreState(state: HistoryState): void {
        this.history.beginApply();

        this.objects = (state.objects as unknown[]).map(data => DesignObject.deserialize(data));
        this.renderer.setObjects(this.objects);

        // Restore selection
        const selectedIds = new Set(state.selectedIds);
        this.selectedObjects = this.objects.filter(obj => selectedIds.has(obj.id));
        this.renderer.setSelection(this.selectedObjects);

        this.panelManager.updateLayersPanel();
        this.panelManager.updatePropertiesPanel();

        this.history.endApply();
        this.updateHistoryButtons();
    }

    updateHistoryButtons(): void {
        const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
        const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement | null;

        if (undoBtn) {
            undoBtn.disabled = !this.history.canUndo();
            undoBtn.style.opacity = this.history.canUndo() ? '1' : '0.5';
        }
        if (redoBtn) {
            redoBtn.disabled = !this.history.canRedo();
            redoBtn.style.opacity = this.history.canRedo() ? '1' : '0.5';
        }
    }

    // =====================
    // CONTEXT MENU
    // =====================

    showContextMenu(e: MouseEvent): void {
        const menu = document.getElementById('context-menu');
        if (!menu) return;

        // Check if clicking on an object
        const rect = this.renderer.canvas.getBoundingClientRect();
        const pos = this.renderer.screenToWorld(
            e.clientX - rect.left,
            e.clientY - rect.top
        );

        const hitObject = this.getObjectAtPoint(pos.x, pos.y);
        if (hitObject && !this.selectedObjects.includes(hitObject)) {
            this.selectObjects([hitObject]);
        }

        if (this.selectedObjects.length === 0) {
            return;
        }

        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.remove('hidden');
    }

    hideContextMenu(): void {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.classList.add('hidden');
        }
    }

    handleContextAction(action: ContextAction): void {
        switch (action) {
            case 'duplicate':
                this.duplicateSelection();
                break;
            case 'delete':
                this.deleteSelection();
                break;
            case 'bring-front':
                this.bringToFront();
                break;
            case 'send-back':
                this.sendToBack();
                break;
            case 'group':
                this.groupSelection();
                break;
            case 'ungroup':
                this.ungroupSelection();
                break;
            case 'create-component':
                this.createComponent();
                break;
            case 'create-instance':
                this.duplicateAsInstance();
                break;
            case 'detach-instance':
                this.detachInstance();
                break;
            case 'boolean-union':
                BooleanOperations.performOperation(this, 'union');
                break;
            case 'boolean-subtract':
                BooleanOperations.performOperation(this, 'subtract');
                break;
            case 'boolean-intersect':
                BooleanOperations.performOperation(this, 'intersect');
                break;
            case 'boolean-exclude':
                BooleanOperations.performOperation(this, 'exclude');
                break;
        }
        this.hideContextMenu();
    }

    // =====================
    // FILE HANDLING
    // =====================

    handleFileDrop(e: DragEvent): void {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const rect = this.renderer.canvas.getBoundingClientRect();
        const dropPos = this.renderer.screenToWorld(
            e.clientX - rect.left,
            e.clientY - rect.top
        );

        if (file.type === 'application/json' || file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                this.exportManager.importJSON(loadEvent.target?.result as string);
            };
            reader.readAsText(file);
        } else if (file.type.startsWith('image/')) {
            // Handle image drop - create an ImageObject
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const img = new Image();
                img.onload = () => {
                    // Scale image if too large
                    let width = img.naturalWidth;
                    let height = img.naturalHeight;
                    const maxSize = 500;

                    if (width > maxSize || height > maxSize) {
                        const scale = maxSize / Math.max(width, height);
                        width *= scale;
                        height *= scale;
                    }

                    const imageObj = new ImageObject({
                        x: dropPos.x - width / 2,
                        y: dropPos.y - height / 2,
                        width: width,
                        height: height,
                        imageData: loadEvent.target?.result as string,
                        name: file.name.replace(/\.[^/.]+$/, '') // Remove extension
                    });

                    this.saveState();
                    this.addObject(imageObj);
                    this.selectObjects([imageObj]);
                };
                img.src = loadEvent.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    // =====================
    // RENDER
    // =====================

    render(): void {
        this.renderer.requestRender();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FigmaApp();
});

export default FigmaApp;
