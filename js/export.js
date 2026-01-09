/**
 * Export functionality for the Figma clone
 */

class ExportManager {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('export-modal');
        this.formatSelect = document.getElementById('export-format');
        this.scaleSelect = document.getElementById('export-scale');
        this.cancelBtn = document.getElementById('export-cancel');
        this.confirmBtn = document.getElementById('export-confirm');

        this.init();
    }

    init() {
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.hide());
        }

        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.export());
        }

        // Close on backdrop click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.hide();
                }
            });
        }
    }

    show() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
        }
    }

    hide() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    }

    async export() {
        const format = this.formatSelect?.value || 'png';
        const scale = parseFloat(this.scaleSelect?.value || 1);

        switch (format) {
            case 'png':
                await this.exportPNG(scale);
                break;
            case 'svg':
                await this.exportSVG();
                break;
            case 'json':
                await this.exportJSON();
                break;
        }

        this.hide();
    }

    async exportPNG(scale = 1) {
        // Calculate bounds of all objects
        const bounds = this.calculateBounds();
        if (!bounds) {
            alert('Nothing to export');
            return;
        }

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = bounds.width * scale;
        canvas.height = bounds.height * scale;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale and translate
        ctx.scale(scale, scale);
        ctx.translate(-bounds.x, -bounds.y);

        // Render each object
        this.app.objects.forEach(obj => {
            if (obj.visible) {
                this.renderObjectToContext(ctx, obj);
            }
        });

        // Download
        const link = document.createElement('a');
        link.download = `design-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async exportSVG() {
        const bounds = this.calculateBounds();
        if (!bounds) {
            alert('Nothing to export');
            return;
        }

        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}"
     width="${bounds.width}"
     height="${bounds.height}">
`;

        this.app.objects.forEach(obj => {
            if (obj.visible) {
                svg += this.objectToSVG(obj);
            }
        });

        svg += '</svg>';

        // Download
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.download = `design-${Date.now()}.svg`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    async exportJSON() {
        const data = {
            version: '1.0',
            objects: this.app.objects.map(obj => obj.serialize())
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `design-${Date.now()}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }

    calculateBounds() {
        const objects = this.app.objects.filter(obj => obj.visible);
        if (objects.length === 0) return null;

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            const bounds = obj.rotation ?
                Utils.getRotatedBounds(obj.bounds, obj.rotation) :
                obj.bounds;

            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        // Add padding
        const padding = 20;
        return {
            x: minX - padding,
            y: minY - padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2
        };
    }

    renderObjectToContext(ctx, obj) {
        ctx.save();

        // Apply transform
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;

        if (obj.rotation) {
            ctx.translate(cx, cy);
            ctx.rotate(obj.rotation * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        ctx.globalAlpha = obj.opacity;

        switch (obj.type) {
            case 'rectangle':
                this.renderRectangle(ctx, obj);
                break;
            case 'ellipse':
                this.renderEllipse(ctx, obj);
                break;
            case 'line':
                this.renderLine(ctx, obj);
                break;
            case 'text':
                this.renderText(ctx, obj);
                break;
            case 'frame':
                this.renderFrame(ctx, obj);
                break;
            case 'path':
                this.renderPath(ctx, obj);
                break;
            case 'group':
                obj.children.forEach(child => this.renderObjectToContext(ctx, child));
                break;
        }

        ctx.restore();
    }

    renderRectangle(ctx, obj) {
        ctx.beginPath();
        if (obj.cornerRadius > 0) {
            const r = Math.min(obj.cornerRadius, obj.width / 2, obj.height / 2);
            ctx.roundRect(obj.x, obj.y, obj.width, obj.height, r);
        } else {
            ctx.rect(obj.x, obj.y, obj.width, obj.height);
        }

        if (obj.fill) {
            ctx.fillStyle = obj.fill;
            ctx.globalAlpha = obj.opacity * obj.fillOpacity;
            ctx.fill();
        }

        if (obj.stroke && obj.strokeWidth > 0) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth;
            ctx.globalAlpha = obj.opacity * obj.strokeOpacity;
            ctx.stroke();
        }
    }

    renderEllipse(ctx, obj) {
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, obj.width / 2, obj.height / 2, 0, 0, Math.PI * 2);

        if (obj.fill) {
            ctx.fillStyle = obj.fill;
            ctx.globalAlpha = obj.opacity * obj.fillOpacity;
            ctx.fill();
        }

        if (obj.stroke && obj.strokeWidth > 0) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth;
            ctx.globalAlpha = obj.opacity * obj.strokeOpacity;
            ctx.stroke();
        }
    }

    renderLine(ctx, obj) {
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);

        if (obj.stroke && obj.strokeWidth > 0) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    renderText(ctx, obj) {
        ctx.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = obj.textAlign;

        if (obj.fill) {
            ctx.fillStyle = obj.fill;
            ctx.globalAlpha = obj.opacity * obj.fillOpacity;
        }

        let textX = obj.x;
        if (obj.textAlign === 'center') textX = obj.x + obj.width / 2;
        else if (obj.textAlign === 'right') textX = obj.x + obj.width;

        const lineHeight = obj.fontSize * obj.lineHeight;
        const lines = obj.text.split('\n');

        lines.forEach((line, i) => {
            ctx.fillText(line, textX, obj.y + i * lineHeight);
        });
    }

    renderFrame(ctx, obj) {
        // Background
        if (obj.fill) {
            ctx.beginPath();
            if (obj.cornerRadius > 0) {
                ctx.roundRect(obj.x, obj.y, obj.width, obj.height, obj.cornerRadius);
            } else {
                ctx.rect(obj.x, obj.y, obj.width, obj.height);
            }
            ctx.fillStyle = obj.fill;
            ctx.globalAlpha = obj.opacity * obj.fillOpacity;
            ctx.fill();
        }

        // Children
        if (obj.clipContent) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(obj.x, obj.y, obj.width, obj.height);
            ctx.clip();
        }

        obj.children.forEach(child => {
            if (child.visible) {
                this.renderObjectToContext(ctx, child);
            }
        });

        if (obj.clipContent) {
            ctx.restore();
        }
    }

    renderPath(ctx, obj) {
        if (obj.points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(obj.points[0].x, obj.points[0].y);

        for (let i = 1; i < obj.points.length; i++) {
            const prev = obj.points[i - 1];
            const curr = obj.points[i];

            if (prev.handleOut && curr.handleIn) {
                ctx.bezierCurveTo(
                    prev.handleOut.x, prev.handleOut.y,
                    curr.handleIn.x, curr.handleIn.y,
                    curr.x, curr.y
                );
            } else {
                ctx.lineTo(curr.x, curr.y);
            }
        }

        if (obj.closed) {
            ctx.closePath();
        }

        if (obj.fill && obj.closed) {
            ctx.fillStyle = obj.fill;
            ctx.globalAlpha = obj.opacity * obj.fillOpacity;
            ctx.fill();
        }

        if (obj.stroke && obj.strokeWidth > 0) {
            ctx.strokeStyle = obj.stroke;
            ctx.lineWidth = obj.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = obj.opacity * obj.strokeOpacity;
            ctx.stroke();
        }
    }

    objectToSVG(obj, indent = '  ') {
        const transform = obj.rotation ?
            ` transform="rotate(${obj.rotation} ${obj.x + obj.width / 2} ${obj.y + obj.height / 2})"` : '';
        const opacity = obj.opacity < 1 ? ` opacity="${obj.opacity}"` : '';

        switch (obj.type) {
            case 'rectangle':
                return this.rectangleToSVG(obj, indent, transform, opacity);
            case 'ellipse':
                return this.ellipseToSVG(obj, indent, transform, opacity);
            case 'line':
                return this.lineToSVG(obj, indent, transform, opacity);
            case 'text':
                return this.textToSVG(obj, indent, transform, opacity);
            case 'frame':
                return this.frameToSVG(obj, indent, transform, opacity);
            case 'path':
                return this.pathToSVG(obj, indent, transform, opacity);
            case 'group':
                let svg = `${indent}<g${transform}${opacity}>\n`;
                obj.children.forEach(child => {
                    svg += this.objectToSVG(child, indent + '  ');
                });
                svg += `${indent}</g>\n`;
                return svg;
            default:
                return '';
        }
    }

    rectangleToSVG(obj, indent, transform, opacity) {
        const fill = obj.fill ? ` fill="${obj.fill}"` : ' fill="none"';
        const fillOpacity = obj.fillOpacity < 1 ? ` fill-opacity="${obj.fillOpacity}"` : '';
        const stroke = obj.stroke && obj.strokeWidth > 0 ?
            ` stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}"` : '';
        const rx = obj.cornerRadius > 0 ? ` rx="${obj.cornerRadius}"` : '';

        return `${indent}<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}"${rx}${fill}${fillOpacity}${stroke}${transform}${opacity}/>\n`;
    }

    ellipseToSVG(obj, indent, transform, opacity) {
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        const rx = obj.width / 2;
        const ry = obj.height / 2;
        const fill = obj.fill ? ` fill="${obj.fill}"` : ' fill="none"';
        const fillOpacity = obj.fillOpacity < 1 ? ` fill-opacity="${obj.fillOpacity}"` : '';
        const stroke = obj.stroke && obj.strokeWidth > 0 ?
            ` stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}"` : '';

        return `${indent}<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${fill}${fillOpacity}${stroke}${transform}${opacity}/>\n`;
    }

    lineToSVG(obj, indent, transform, opacity) {
        const stroke = obj.stroke && obj.strokeWidth > 0 ?
            ` stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}" stroke-linecap="round"` : '';

        return `${indent}<line x1="${obj.x1}" y1="${obj.y1}" x2="${obj.x2}" y2="${obj.y2}"${stroke}${transform}${opacity}/>\n`;
    }

    textToSVG(obj, indent, transform, opacity) {
        const fill = obj.fill ? ` fill="${obj.fill}"` : '';
        const style = ` style="font-family: ${obj.fontFamily}; font-size: ${obj.fontSize}px; font-weight: ${obj.fontWeight};"`;
        const anchor = obj.textAlign === 'center' ? 'middle' : (obj.textAlign === 'right' ? 'end' : 'start');

        let x = obj.x;
        if (obj.textAlign === 'center') x = obj.x + obj.width / 2;
        else if (obj.textAlign === 'right') x = obj.x + obj.width;

        return `${indent}<text x="${x}" y="${obj.y + obj.fontSize}" text-anchor="${anchor}"${fill}${style}${transform}${opacity}>${this.escapeXml(obj.text)}</text>\n`;
    }

    frameToSVG(obj, indent, transform, opacity) {
        let svg = `${indent}<g${transform}${opacity}>\n`;

        // Background
        if (obj.fill) {
            const rx = obj.cornerRadius > 0 ? ` rx="${obj.cornerRadius}"` : '';
            svg += `${indent}  <rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}"${rx} fill="${obj.fill}"/>\n`;
        }

        // Clip path for children
        if (obj.clipContent && obj.children.length > 0) {
            const clipId = 'clip-' + obj.id;
            svg += `${indent}  <clipPath id="${clipId}"><rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}"/></clipPath>\n`;
            svg += `${indent}  <g clip-path="url(#${clipId})">\n`;
            obj.children.forEach(child => {
                if (child.visible) {
                    svg += this.objectToSVG(child, indent + '    ');
                }
            });
            svg += `${indent}  </g>\n`;
        } else {
            obj.children.forEach(child => {
                if (child.visible) {
                    svg += this.objectToSVG(child, indent + '  ');
                }
            });
        }

        svg += `${indent}</g>\n`;
        return svg;
    }

    pathToSVG(obj, indent, transform, opacity) {
        if (obj.points.length < 2) return '';

        let d = `M ${obj.points[0].x} ${obj.points[0].y}`;

        for (let i = 1; i < obj.points.length; i++) {
            const prev = obj.points[i - 1];
            const curr = obj.points[i];

            if (prev.handleOut && curr.handleIn) {
                d += ` C ${prev.handleOut.x} ${prev.handleOut.y} ${curr.handleIn.x} ${curr.handleIn.y} ${curr.x} ${curr.y}`;
            } else {
                d += ` L ${curr.x} ${curr.y}`;
            }
        }

        if (obj.closed) d += ' Z';

        const fill = obj.fill && obj.closed ? ` fill="${obj.fill}"` : ' fill="none"';
        const stroke = obj.stroke && obj.strokeWidth > 0 ?
            ` stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"` : '';

        return `${indent}<path d="${d}"${fill}${stroke}${transform}${opacity}/>\n`;
    }

    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Import JSON
    importJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.objects) {
                this.app.objects = data.objects.map(obj => DesignObject.deserialize(obj));
                this.app.selectObjects([]);
                this.app.render();
                this.app.panelManager.updateLayersPanel();
            }
        } catch (e) {
            console.error('Failed to import JSON:', e);
            alert('Failed to import file');
        }
    }
}

window.ExportManager = ExportManager;
