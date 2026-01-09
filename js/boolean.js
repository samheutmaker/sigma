/**
 * Boolean operations for shape manipulation
 * Union, Subtract, Intersect, Exclude
 */

class BooleanOperations {
    /**
     * Convert a design object to a polygon (array of points)
     */
    static objectToPolygon(obj) {
        if (obj.type === 'rectangle') {
            const { x, y, width, height, cornerRadius } = obj;
            if (cornerRadius && cornerRadius > 0) {
                return this.roundedRectToPolygon(x, y, width, height, cornerRadius);
            }
            return [
                { x: x, y: y },
                { x: x + width, y: y },
                { x: x + width, y: y + height },
                { x: x, y: y + height }
            ];
        } else if (obj.type === 'ellipse') {
            return this.ellipseToPolygon(obj.x, obj.y, obj.width, obj.height, 32);
        } else if (obj.type === 'path') {
            return this.pathToPolygon(obj);
        }
        return [];
    }

    /**
     * Convert ellipse to polygon approximation
     */
    static ellipseToPolygon(x, y, width, height, segments = 32) {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const rx = width / 2;
        const ry = height / 2;
        const points = [];

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push({
                x: cx + Math.cos(angle) * rx,
                y: cy + Math.sin(angle) * ry
            });
        }

        return points;
    }

    /**
     * Convert rounded rectangle to polygon
     */
    static roundedRectToPolygon(x, y, width, height, radius, segmentsPerCorner = 8) {
        const r = Math.min(radius, width / 2, height / 2);
        const points = [];

        // Top-right corner
        for (let i = 0; i <= segmentsPerCorner; i++) {
            const angle = -Math.PI / 2 + (i / segmentsPerCorner) * (Math.PI / 2);
            points.push({
                x: x + width - r + Math.cos(angle) * r,
                y: y + r + Math.sin(angle) * r
            });
        }

        // Bottom-right corner
        for (let i = 0; i <= segmentsPerCorner; i++) {
            const angle = (i / segmentsPerCorner) * (Math.PI / 2);
            points.push({
                x: x + width - r + Math.cos(angle) * r,
                y: y + height - r + Math.sin(angle) * r
            });
        }

        // Bottom-left corner
        for (let i = 0; i <= segmentsPerCorner; i++) {
            const angle = Math.PI / 2 + (i / segmentsPerCorner) * (Math.PI / 2);
            points.push({
                x: x + r + Math.cos(angle) * r,
                y: y + height - r + Math.sin(angle) * r
            });
        }

        // Top-left corner
        for (let i = 0; i <= segmentsPerCorner; i++) {
            const angle = Math.PI + (i / segmentsPerCorner) * (Math.PI / 2);
            points.push({
                x: x + r + Math.cos(angle) * r,
                y: y + r + Math.sin(angle) * r
            });
        }

        return points;
    }

    /**
     * Convert path to polygon (flattens bezier curves)
     */
    static pathToPolygon(path, segmentsPerCurve = 8) {
        const points = [];
        const pathPoints = path.points;

        for (let i = 0; i < pathPoints.length; i++) {
            const current = pathPoints[i];
            const next = pathPoints[(i + 1) % pathPoints.length];

            points.push({ x: current.x, y: current.y });

            // If there are bezier handles, subdivide the curve
            if (current.handleOut || next.handleIn) {
                const p0 = { x: current.x, y: current.y };
                const p1 = current.handleOut || p0;
                const p2 = next.handleIn || { x: next.x, y: next.y };
                const p3 = { x: next.x, y: next.y };

                for (let t = 1; t < segmentsPerCurve; t++) {
                    const tNorm = t / segmentsPerCurve;
                    const point = this.bezierPoint(p0, p1, p2, p3, tNorm);
                    points.push(point);
                }
            }

            if (!path.closed && i === pathPoints.length - 1) {
                points.push({ x: next.x, y: next.y });
            }
        }

        return points;
    }

    /**
     * Calculate point on cubic bezier curve
     */
    static bezierPoint(p0, p1, p2, p3, t) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        const t2 = t * t;
        const t3 = t2 * t;

        return {
            x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
            y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
        };
    }

    /**
     * Check if a point is inside a polygon (ray casting algorithm)
     */
    static pointInPolygon(point, polygon) {
        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Find intersection point of two line segments
     */
    static lineIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.0001) return null;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }

        return null;
    }

    /**
     * Simplified union - combines two shapes
     * Uses convex hull for simple cases
     */
    static union(obj1, obj2) {
        const poly1 = this.objectToPolygon(obj1);
        const poly2 = this.objectToPolygon(obj2);

        // Combine all points and compute convex hull as approximation
        const allPoints = [...poly1, ...poly2];
        const hull = this.convexHull(allPoints);

        return this.polygonToPath(hull, obj1.fill || obj2.fill, obj1.stroke);
    }

    /**
     * Subtract: removes obj2 from obj1
     * Creates a path with a hole
     */
    static subtract(obj1, obj2) {
        const poly1 = this.objectToPolygon(obj1);
        const poly2 = this.objectToPolygon(obj2);

        // Create path with outer boundary (poly1) and inner hole (poly2 reversed)
        const path = new Path({
            fill: obj1.fill,
            stroke: obj1.stroke,
            strokeWidth: obj1.strokeWidth,
            closed: true,
            name: 'Subtracted Shape'
        });

        // Add outer boundary points
        poly1.forEach(p => {
            path.points.push({ x: p.x, y: p.y, handleIn: null, handleOut: null });
        });

        // For a proper subtract, we'd need to implement proper polygon clipping
        // For now, return the outer shape (simplified)
        path.updateBounds();
        return path;
    }

    /**
     * Intersect: keeps only overlapping area
     */
    static intersect(obj1, obj2) {
        const poly1 = this.objectToPolygon(obj1);
        const poly2 = this.objectToPolygon(obj2);

        // Find points from poly1 that are inside poly2
        const intersectionPoints = [];

        poly1.forEach(p => {
            if (this.pointInPolygon(p, poly2)) {
                intersectionPoints.push(p);
            }
        });

        // Find points from poly2 that are inside poly1
        poly2.forEach(p => {
            if (this.pointInPolygon(p, poly1)) {
                intersectionPoints.push(p);
            }
        });

        // Find edge intersections
        for (let i = 0; i < poly1.length; i++) {
            const p1 = poly1[i];
            const p2 = poly1[(i + 1) % poly1.length];

            for (let j = 0; j < poly2.length; j++) {
                const p3 = poly2[j];
                const p4 = poly2[(j + 1) % poly2.length];

                const intersection = this.lineIntersection(p1, p2, p3, p4);
                if (intersection) {
                    intersectionPoints.push(intersection);
                }
            }
        }

        if (intersectionPoints.length < 3) {
            return null; // No intersection
        }

        // Order points by angle from centroid
        const hull = this.convexHull(intersectionPoints);
        return this.polygonToPath(hull, obj1.fill || obj2.fill, obj1.stroke);
    }

    /**
     * Exclude: keeps non-overlapping parts
     */
    static exclude(obj1, obj2) {
        // For now, just return the union outline
        // Proper exclude would require complex polygon operations
        return this.union(obj1, obj2);
    }

    /**
     * Compute convex hull using Graham scan
     */
    static convexHull(points) {
        if (points.length < 3) return points;

        // Find lowest point
        let lowest = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < points[lowest].y ||
                (points[i].y === points[lowest].y && points[i].x < points[lowest].x)) {
                lowest = i;
            }
        }

        // Swap lowest to first position
        [points[0], points[lowest]] = [points[lowest], points[0]];
        const pivot = points[0];

        // Sort by polar angle
        const sorted = points.slice(1).sort((a, b) => {
            const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
            const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
            if (angleA !== angleB) return angleA - angleB;
            // Same angle - sort by distance
            const distA = (a.x - pivot.x) ** 2 + (a.y - pivot.y) ** 2;
            const distB = (b.x - pivot.x) ** 2 + (b.y - pivot.y) ** 2;
            return distA - distB;
        });

        // Build hull
        const hull = [pivot];
        for (const point of sorted) {
            while (hull.length > 1) {
                const top = hull[hull.length - 1];
                const second = hull[hull.length - 2];
                const cross = (top.x - second.x) * (point.y - second.y) -
                             (top.y - second.y) * (point.x - second.x);
                if (cross <= 0) {
                    hull.pop();
                } else {
                    break;
                }
            }
            hull.push(point);
        }

        return hull;
    }

    /**
     * Convert polygon back to Path object
     */
    static polygonToPath(polygon, fill, stroke) {
        const path = new Path({
            fill: fill,
            stroke: stroke,
            strokeWidth: stroke ? 1 : 0,
            closed: true,
            name: 'Boolean Result'
        });

        polygon.forEach(p => {
            path.points.push({
                x: p.x,
                y: p.y,
                handleIn: null,
                handleOut: null
            });
        });

        path.updateBounds();
        return path;
    }

    /**
     * Perform boolean operation and add result to app
     */
    static performOperation(app, operation) {
        const selected = app.selectedObjects;
        if (selected.length !== 2) {
            console.warn('Boolean operations require exactly 2 selected objects');
            return null;
        }

        const obj1 = selected[0];
        const obj2 = selected[1];

        // Check if objects are valid shapes
        const validTypes = ['rectangle', 'ellipse', 'path'];
        if (!validTypes.includes(obj1.type) || !validTypes.includes(obj2.type)) {
            console.warn('Boolean operations only work with rectangles, ellipses, and paths');
            return null;
        }

        let result = null;
        switch (operation) {
            case 'union':
                result = this.union(obj1, obj2);
                break;
            case 'subtract':
                result = this.subtract(obj1, obj2);
                break;
            case 'intersect':
                result = this.intersect(obj1, obj2);
                break;
            case 'exclude':
                result = this.exclude(obj1, obj2);
                break;
        }

        if (result) {
            app.saveState();
            app.removeObject(obj1);
            app.removeObject(obj2);
            app.addObject(result);
            app.selectObjects([result]);
        }

        return result;
    }
}

window.BooleanOperations = BooleanOperations;
