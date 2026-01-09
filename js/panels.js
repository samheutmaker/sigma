/**
 * Panel management for the Figma clone
 */

class PanelManager {
    constructor(app) {
        this.app = app;
        this.init();
    }

    init() {
        this.setupLayersPanel();
        this.setupPropertiesPanel();
    }

    // =====================
    // LAYERS PANEL
    // =====================

    setupLayersPanel() {
        this.layersList = document.getElementById('layers-list');
        this.addFrameBtn = document.getElementById('add-frame-btn');

        if (this.addFrameBtn) {
            this.addFrameBtn.addEventListener('click', () => {
                const frame = new Frame({
                    x: 0,
                    y: 0,
                    width: 375,
                    height: 812,
                    name: 'Frame ' + (this.app.objects.length + 1)
                });
                this.app.addObject(frame);
                this.app.selectObjects([frame]);
                this.app.saveState();
            });
        }
    }

    updateLayersPanel() {
        if (!this.layersList) return;

        this.layersList.innerHTML = '';

        // Render objects in reverse order (top to bottom)
        const objects = [...this.app.objects].reverse();
        objects.forEach(obj => {
            const item = this.createLayerItem(obj);
            this.layersList.appendChild(item);
        });
    }

    createLayerItem(obj, depth = 0) {
        const item = document.createElement('div');
        item.className = 'layer-item';
        item.dataset.id = obj.id;
        item.style.paddingLeft = (8 + depth * 16) + 'px';

        if (this.app.selectedObjects.includes(obj)) {
            item.classList.add('selected');
        }

        // Icon
        const icon = document.createElement('span');
        icon.className = 'layer-icon';
        icon.innerHTML = this.getLayerIcon(obj.type);
        item.appendChild(icon);

        // Name
        const name = document.createElement('span');
        name.className = 'layer-name';
        name.textContent = obj.name;
        item.appendChild(name);

        // Visibility toggle
        const visibility = document.createElement('span');
        visibility.className = 'layer-visibility';
        visibility.innerHTML = obj.visible ? '👁' : '👁‍🗨';
        visibility.addEventListener('click', (e) => {
            e.stopPropagation();
            obj.visible = !obj.visible;
            this.app.render();
            this.updateLayersPanel();
        });
        item.appendChild(visibility);

        // Click to select
        item.addEventListener('click', (e) => {
            if (e.shiftKey) {
                this.app.toggleSelection(obj);
            } else {
                this.app.selectObjects([obj]);
            }
        });

        // Double click to rename
        name.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startRename(name, obj);
        });

        // Create container for item and children
        const container = document.createElement('div');
        container.appendChild(item);

        // Render children if it's a group or frame
        if (obj.children && obj.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'layer-children';
            obj.children.forEach(child => {
                const childItem = this.createLayerItem(child, depth + 1);
                childrenContainer.appendChild(childItem);
            });
            container.appendChild(childrenContainer);
        }

        return container;
    }

    getLayerIcon(type) {
        const icons = {
            rectangle: '<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="1" fill="currentColor"/></svg>',
            ellipse: '<svg viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="6" ry="6" fill="currentColor"/></svg>',
            line: '<svg viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="2"/></svg>',
            text: '<svg viewBox="0 0 16 16"><text x="4" y="12" font-size="10" font-weight="bold" fill="currentColor">T</text></svg>',
            frame: '<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
            path: '<svg viewBox="0 0 16 16"><path d="M2 8 Q8 2, 14 8 Q8 14, 2 8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
            group: '<svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" fill="currentColor" opacity="0.5"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/></svg>',
            image: '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="6" r="1.5" fill="currentColor"/><path d="M2 11 L6 8 L9 10 L14 6 V12 H2 Z" fill="currentColor" opacity="0.5"/></svg>'
        };
        return icons[type] || icons.rectangle;
    }

    startRename(nameElement, obj) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = obj.name;
        input.className = 'layer-name-input';
        input.style.cssText = `
            background: var(--bg-tertiary);
            border: 1px solid var(--accent);
            border-radius: 2px;
            color: var(--text-primary);
            padding: 2px 4px;
            font-size: 12px;
            width: 100%;
        `;

        nameElement.replaceWith(input);
        input.focus();
        input.select();

        const finishRename = () => {
            obj.name = input.value || obj.name;
            this.updateLayersPanel();
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishRename();
            } else if (e.key === 'Escape') {
                this.updateLayersPanel();
            }
        });
    }

    // =====================
    // PROPERTIES PANEL
    // =====================

    setupPropertiesPanel() {
        // Transform inputs
        this.propX = document.getElementById('prop-x');
        this.propY = document.getElementById('prop-y');
        this.propWidth = document.getElementById('prop-width');
        this.propHeight = document.getElementById('prop-height');
        this.propRotation = document.getElementById('prop-rotation');

        // Fill inputs
        this.propFill = document.getElementById('prop-fill');
        this.propFillHex = document.getElementById('prop-fill-hex');
        this.propFillOpacity = document.getElementById('prop-fill-opacity');

        // Stroke inputs
        this.propStroke = document.getElementById('prop-stroke');
        this.propStrokeHex = document.getElementById('prop-stroke-hex');
        this.propStrokeWidth = document.getElementById('prop-stroke-width');

        // Corner radius
        this.propCornerRadius = document.getElementById('prop-corner-radius');

        // Text inputs
        this.propFontFamily = document.getElementById('prop-font-family');
        this.propFontSize = document.getElementById('prop-font-size');
        this.propFontWeight = document.getElementById('prop-font-weight');

        // Effects inputs
        this.propBlur = document.getElementById('prop-blur');
        this.addShadowBtn = document.getElementById('add-shadow-btn');
        this.shadowList = document.getElementById('shadow-list');

        // Gradient inputs
        this.propGradientType = document.getElementById('prop-gradient-type');
        this.gradientControls = document.getElementById('gradient-controls');
        this.propGradientAngle = document.getElementById('prop-gradient-angle');
        this.propGradientStart = document.getElementById('prop-gradient-start');
        this.propGradientEnd = document.getElementById('prop-gradient-end');

        // Sections
        this.textSection = document.getElementById('text-section');
        this.cornerSection = document.getElementById('corner-section');
        this.effectsSection = document.getElementById('effects-section');
        this.gradientSection = document.getElementById('gradient-section');

        this.bindPropertyEvents();
    }

    bindPropertyEvents() {
        // Transform
        this.bindTransformInput(this.propX, 'x');
        this.bindTransformInput(this.propY, 'y');
        this.bindTransformInput(this.propWidth, 'width');
        this.bindTransformInput(this.propHeight, 'height');
        this.bindTransformInput(this.propRotation, 'rotation');

        // Fill
        if (this.propFill) {
            this.propFill.addEventListener('input', (e) => {
                this.updateSelectedProperty('fill', e.target.value);
                this.propFillHex.value = e.target.value;
            });
        }

        if (this.propFillHex) {
            this.propFillHex.addEventListener('change', (e) => {
                let value = e.target.value;
                if (!value.startsWith('#')) value = '#' + value;
                this.updateSelectedProperty('fill', value);
                this.propFill.value = value;
            });
        }

        if (this.propFillOpacity) {
            this.propFillOpacity.addEventListener('change', (e) => {
                this.updateSelectedProperty('fillOpacity', parseFloat(e.target.value) / 100);
            });
        }

        // Stroke
        if (this.propStroke) {
            this.propStroke.addEventListener('input', (e) => {
                this.updateSelectedProperty('stroke', e.target.value);
                this.propStrokeHex.value = e.target.value;
            });
        }

        if (this.propStrokeHex) {
            this.propStrokeHex.addEventListener('change', (e) => {
                let value = e.target.value;
                if (!value.startsWith('#')) value = '#' + value;
                this.updateSelectedProperty('stroke', value);
                this.propStroke.value = value;
            });
        }

        if (this.propStrokeWidth) {
            this.propStrokeWidth.addEventListener('change', (e) => {
                this.updateSelectedProperty('strokeWidth', parseFloat(e.target.value));
            });
        }

        // Corner radius
        if (this.propCornerRadius) {
            this.propCornerRadius.addEventListener('change', (e) => {
                this.updateSelectedProperty('cornerRadius', parseFloat(e.target.value));
            });
        }

        // Text properties
        if (this.propFontFamily) {
            this.propFontFamily.addEventListener('change', (e) => {
                this.updateSelectedProperty('fontFamily', e.target.value);
            });
        }

        if (this.propFontSize) {
            this.propFontSize.addEventListener('change', (e) => {
                this.updateSelectedProperty('fontSize', parseFloat(e.target.value));
            });
        }

        if (this.propFontWeight) {
            this.propFontWeight.addEventListener('change', (e) => {
                this.updateSelectedProperty('fontWeight', e.target.value);
            });
        }

        // Blur effect
        if (this.propBlur) {
            this.propBlur.addEventListener('change', (e) => {
                this.updateSelectedProperty('blur', parseFloat(e.target.value));
            });
        }

        // Add shadow button
        if (this.addShadowBtn) {
            this.addShadowBtn.addEventListener('click', () => {
                this.app.selectedObjects.forEach(obj => {
                    if (!obj.shadows) obj.shadows = [];
                    obj.shadows.push(new Shadow({
                        type: 'drop',
                        color: 'rgba(0,0,0,0.25)',
                        offsetX: 0,
                        offsetY: 4,
                        blur: 8
                    }));
                });
                this.app.render();
                this.app.saveState();
                this.updateShadowList();
            });
        }

        // Gradient type
        if (this.propGradientType) {
            this.propGradientType.addEventListener('change', (e) => {
                const type = e.target.value;
                this.app.selectedObjects.forEach(obj => {
                    if (type === 'none') {
                        obj.gradient = null;
                    } else {
                        obj.gradient = new Gradient({
                            type: type,
                            angle: parseFloat(this.propGradientAngle.value) || 0,
                            stops: [
                                { offset: 0, color: this.propGradientStart.value },
                                { offset: 1, color: this.propGradientEnd.value }
                            ]
                        });
                    }
                });
                this.gradientControls.style.display = type === 'none' ? 'none' : 'block';
                this.app.render();
                this.app.saveState();
            });
        }

        // Gradient angle
        if (this.propGradientAngle) {
            this.propGradientAngle.addEventListener('change', (e) => {
                this.app.selectedObjects.forEach(obj => {
                    if (obj.gradient) {
                        obj.gradient.angle = parseFloat(e.target.value);
                    }
                });
                this.app.render();
                this.app.saveState();
            });
        }

        // Gradient start color
        if (this.propGradientStart) {
            this.propGradientStart.addEventListener('input', (e) => {
                this.app.selectedObjects.forEach(obj => {
                    if (obj.gradient && obj.gradient.stops.length > 0) {
                        obj.gradient.stops[0].color = e.target.value;
                    }
                });
                this.app.render();
            });
        }

        // Gradient end color
        if (this.propGradientEnd) {
            this.propGradientEnd.addEventListener('input', (e) => {
                this.app.selectedObjects.forEach(obj => {
                    if (obj.gradient && obj.gradient.stops.length > 1) {
                        obj.gradient.stops[1].color = e.target.value;
                    }
                });
                this.app.render();
            });
        }
    }

    updateShadowList() {
        if (!this.shadowList) return;
        this.shadowList.innerHTML = '';

        const selected = this.app.selectedObjects;
        if (selected.length === 0) return;

        const obj = selected[0];
        if (!obj.shadows || obj.shadows.length === 0) return;

        obj.shadows.forEach((shadow, index) => {
            const shadowEl = document.createElement('div');
            shadowEl.className = 'shadow-item property-row';
            shadowEl.innerHTML = `
                <input type="color" class="shadow-color" value="${this.rgbaToHex(shadow.color)}" data-index="${index}">
                <input type="number" class="shadow-blur" value="${shadow.blur}" min="0" step="1" data-index="${index}" style="width: 40px;">
                <input type="number" class="shadow-x" value="${shadow.offsetX}" step="1" data-index="${index}" style="width: 35px;">
                <input type="number" class="shadow-y" value="${shadow.offsetY}" step="1" data-index="${index}" style="width: 35px;">
                <button class="small-btn remove-shadow" data-index="${index}">×</button>
            `;
            this.shadowList.appendChild(shadowEl);
        });

        // Bind shadow input events
        this.shadowList.querySelectorAll('.shadow-color').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.app.selectedObjects.forEach(o => {
                    if (o.shadows && o.shadows[idx]) {
                        o.shadows[idx].color = e.target.value;
                    }
                });
                this.app.render();
            });
        });

        this.shadowList.querySelectorAll('.shadow-blur').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.app.selectedObjects.forEach(o => {
                    if (o.shadows && o.shadows[idx]) {
                        o.shadows[idx].blur = parseFloat(e.target.value);
                    }
                });
                this.app.render();
                this.app.saveState();
            });
        });

        this.shadowList.querySelectorAll('.shadow-x').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.app.selectedObjects.forEach(o => {
                    if (o.shadows && o.shadows[idx]) {
                        o.shadows[idx].offsetX = parseFloat(e.target.value);
                    }
                });
                this.app.render();
                this.app.saveState();
            });
        });

        this.shadowList.querySelectorAll('.shadow-y').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.app.selectedObjects.forEach(o => {
                    if (o.shadows && o.shadows[idx]) {
                        o.shadows[idx].offsetY = parseFloat(e.target.value);
                    }
                });
                this.app.render();
                this.app.saveState();
            });
        });

        this.shadowList.querySelectorAll('.remove-shadow').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.app.selectedObjects.forEach(o => {
                    if (o.shadows) {
                        o.shadows.splice(idx, 1);
                    }
                });
                this.app.render();
                this.app.saveState();
                this.updateShadowList();
            });
        });
    }

    rgbaToHex(rgba) {
        if (!rgba) return '#000000';
        if (rgba.startsWith('#')) return rgba;
        const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }
        return '#000000';
    }

    bindTransformInput(input, property) {
        if (!input) return;

        input.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                this.updateSelectedProperty(property, value);
            }
        });

        // Arrow key support
        input.addEventListener('keydown', (e) => {
            let delta = 1;
            if (e.shiftKey) delta = 10;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const value = parseFloat(input.value) + delta;
                input.value = value;
                this.updateSelectedProperty(property, value);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const value = parseFloat(input.value) - delta;
                input.value = value;
                this.updateSelectedProperty(property, value);
            }
        });
    }

    updateSelectedProperty(property, value) {
        this.app.selectedObjects.forEach(obj => {
            obj[property] = value;
        });
        this.app.render();
        this.app.saveState();
    }

    updatePropertiesPanel() {
        const selected = this.app.selectedObjects;

        if (selected.length === 0) {
            this.clearPropertiesPanel();
            return;
        }

        // Use first selected object for values
        const obj = selected[0];

        // Transform
        if (this.propX) this.propX.value = Utils.formatNumber(obj.x);
        if (this.propY) this.propY.value = Utils.formatNumber(obj.y);
        if (this.propWidth) this.propWidth.value = Utils.formatNumber(obj.width);
        if (this.propHeight) this.propHeight.value = Utils.formatNumber(obj.height);
        if (this.propRotation) this.propRotation.value = Utils.formatNumber(obj.rotation);

        // Fill
        if (this.propFill && obj.fill) {
            this.propFill.value = obj.fill;
            this.propFillHex.value = obj.fill;
        }
        if (this.propFillOpacity) {
            this.propFillOpacity.value = Math.round(obj.fillOpacity * 100);
        }

        // Stroke
        if (this.propStroke && obj.stroke) {
            this.propStroke.value = obj.stroke;
            this.propStrokeHex.value = obj.stroke;
        }
        if (this.propStrokeWidth) {
            this.propStrokeWidth.value = obj.strokeWidth || 0;
        }

        // Corner radius (only for rectangles/frames)
        if (this.cornerSection) {
            if (obj.type === 'rectangle' || obj.type === 'frame') {
                this.cornerSection.style.display = 'block';
                if (this.propCornerRadius) {
                    this.propCornerRadius.value = obj.cornerRadius || 0;
                }
            } else {
                this.cornerSection.style.display = 'none';
            }
        }

        // Text properties
        if (this.textSection) {
            if (obj.type === 'text') {
                this.textSection.style.display = 'block';
                if (this.propFontFamily) this.propFontFamily.value = obj.fontFamily;
                if (this.propFontSize) this.propFontSize.value = obj.fontSize;
                if (this.propFontWeight) this.propFontWeight.value = obj.fontWeight;
            } else {
                this.textSection.style.display = 'none';
            }
        }

        // Effects
        if (this.propBlur) {
            this.propBlur.value = obj.blur || 0;
        }
        this.updateShadowList();

        // Gradient
        if (this.propGradientType) {
            if (obj.gradient) {
                this.propGradientType.value = obj.gradient.type;
                this.gradientControls.style.display = 'block';
                if (this.propGradientAngle) this.propGradientAngle.value = obj.gradient.angle || 0;
                if (this.propGradientStart && obj.gradient.stops.length > 0) {
                    this.propGradientStart.value = obj.gradient.stops[0].color;
                }
                if (this.propGradientEnd && obj.gradient.stops.length > 1) {
                    this.propGradientEnd.value = obj.gradient.stops[1].color;
                }
            } else {
                this.propGradientType.value = 'none';
                this.gradientControls.style.display = 'none';
            }
        }
    }

    clearPropertiesPanel() {
        if (this.propX) this.propX.value = '';
        if (this.propY) this.propY.value = '';
        if (this.propWidth) this.propWidth.value = '';
        if (this.propHeight) this.propHeight.value = '';
        if (this.propRotation) this.propRotation.value = '';
    }
}

window.PanelManager = PanelManager;
