/**
 * Auto-layout system for Figma clone
 * Supports flex-like layouts with padding, spacing, and alignment
 */

class AutoLayout {
    constructor(options = {}) {
        // Layout direction
        this.direction = options.direction || 'horizontal'; // 'horizontal' or 'vertical'

        // Alignment
        this.primaryAxisAlign = options.primaryAxisAlign || 'start'; // 'start', 'center', 'end', 'space-between'
        this.counterAxisAlign = options.counterAxisAlign || 'start'; // 'start', 'center', 'end', 'stretch'

        // Spacing
        this.spacing = options.spacing || 10;

        // Padding
        this.paddingTop = options.paddingTop || options.padding || 0;
        this.paddingRight = options.paddingRight || options.padding || 0;
        this.paddingBottom = options.paddingBottom || options.padding || 0;
        this.paddingLeft = options.paddingLeft || options.padding || 0;

        // Sizing mode
        this.primaryAxisSizing = options.primaryAxisSizing || 'hug'; // 'hug' or 'fixed'
        this.counterAxisSizing = options.counterAxisSizing || 'hug'; // 'hug' or 'fixed'

        // Wrap (for multi-line layouts)
        this.wrap = options.wrap || false;
    }

    // Apply layout to a frame's children
    apply(frame) {
        if (!frame.children || frame.children.length === 0) return;

        const isHorizontal = this.direction === 'horizontal';
        const children = frame.children.filter(c => c.visible);

        // Calculate content area
        const contentX = frame.x + this.paddingLeft;
        const contentY = frame.y + this.paddingTop;
        const contentWidth = frame.width - this.paddingLeft - this.paddingRight;
        const contentHeight = frame.height - this.paddingTop - this.paddingBottom;

        // Calculate total children size
        let totalPrimarySize = 0;
        let maxCounterSize = 0;

        children.forEach(child => {
            if (isHorizontal) {
                totalPrimarySize += child.width;
                maxCounterSize = Math.max(maxCounterSize, child.height);
            } else {
                totalPrimarySize += child.height;
                maxCounterSize = Math.max(maxCounterSize, child.width);
            }
        });

        // Add spacing between items
        totalPrimarySize += this.spacing * (children.length - 1);

        // Calculate starting position based on alignment
        let primaryPos = contentX;
        let spacingBetween = this.spacing;

        if (isHorizontal) {
            switch (this.primaryAxisAlign) {
                case 'center':
                    primaryPos = contentX + (contentWidth - totalPrimarySize) / 2;
                    break;
                case 'end':
                    primaryPos = contentX + contentWidth - totalPrimarySize;
                    break;
                case 'space-between':
                    primaryPos = contentX;
                    if (children.length > 1) {
                        const totalChildWidth = children.reduce((sum, c) => sum + c.width, 0);
                        spacingBetween = (contentWidth - totalChildWidth) / (children.length - 1);
                    }
                    break;
                default: // 'start'
                    primaryPos = contentX;
            }
        } else {
            switch (this.primaryAxisAlign) {
                case 'center':
                    primaryPos = contentY + (contentHeight - totalPrimarySize) / 2;
                    break;
                case 'end':
                    primaryPos = contentY + contentHeight - totalPrimarySize;
                    break;
                case 'space-between':
                    primaryPos = contentY;
                    if (children.length > 1) {
                        const totalChildHeight = children.reduce((sum, c) => sum + c.height, 0);
                        spacingBetween = (contentHeight - totalChildHeight) / (children.length - 1);
                    }
                    break;
                default: // 'start'
                    primaryPos = contentY;
            }
        }

        // Position each child
        children.forEach(child => {
            if (isHorizontal) {
                child.x = primaryPos;

                // Counter axis alignment
                switch (this.counterAxisAlign) {
                    case 'center':
                        child.y = contentY + (contentHeight - child.height) / 2;
                        break;
                    case 'end':
                        child.y = contentY + contentHeight - child.height;
                        break;
                    case 'stretch':
                        child.y = contentY;
                        child.height = contentHeight;
                        break;
                    default: // 'start'
                        child.y = contentY;
                }

                primaryPos += child.width + spacingBetween;
            } else {
                child.y = primaryPos;

                // Counter axis alignment
                switch (this.counterAxisAlign) {
                    case 'center':
                        child.x = contentX + (contentWidth - child.width) / 2;
                        break;
                    case 'end':
                        child.x = contentX + contentWidth - child.width;
                        break;
                    case 'stretch':
                        child.x = contentX;
                        child.width = contentWidth;
                        break;
                    default: // 'start'
                        child.x = contentX;
                }

                primaryPos += child.height + spacingBetween;
            }
        });

        // Update frame size if hugging content
        if (this.primaryAxisSizing === 'hug') {
            if (isHorizontal) {
                frame.width = totalPrimarySize + this.paddingLeft + this.paddingRight;
            } else {
                frame.height = totalPrimarySize + this.paddingTop + this.paddingBottom;
            }
        }

        if (this.counterAxisSizing === 'hug') {
            if (isHorizontal) {
                frame.height = maxCounterSize + this.paddingTop + this.paddingBottom;
            } else {
                frame.width = maxCounterSize + this.paddingLeft + this.paddingRight;
            }
        }
    }

    serialize() {
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
            counterAxisSizing: this.counterAxisSizing,
            wrap: this.wrap
        };
    }

    static deserialize(data) {
        if (!data) return null;
        return new AutoLayout(data);
    }
}

/**
 * Constraints system for positioning objects relative to their parent
 */
class Constraints {
    constructor(options = {}) {
        // Horizontal constraint: 'left', 'right', 'center', 'scale', 'left-right' (stretch)
        this.horizontal = options.horizontal || 'left';

        // Vertical constraint: 'top', 'bottom', 'center', 'scale', 'top-bottom' (stretch)
        this.vertical = options.vertical || 'top';

        // Store original values for constraint calculations
        this.originalX = options.originalX;
        this.originalY = options.originalY;
        this.originalWidth = options.originalWidth;
        this.originalHeight = options.originalHeight;
        this.originalParentWidth = options.originalParentWidth;
        this.originalParentHeight = options.originalParentHeight;
    }

    // Initialize constraints based on current position
    initialize(child, parent) {
        this.originalX = child.x - parent.x;
        this.originalY = child.y - parent.y;
        this.originalWidth = child.width;
        this.originalHeight = child.height;
        this.originalParentWidth = parent.width;
        this.originalParentHeight = parent.height;
    }

    // Apply constraints when parent resizes
    apply(child, parent) {
        if (this.originalParentWidth === undefined) {
            this.initialize(child, parent);
            return;
        }

        const parentX = parent.x;
        const parentY = parent.y;
        const parentWidth = parent.width;
        const parentHeight = parent.height;

        // Original distances from edges
        const originalRight = this.originalParentWidth - (this.originalX + this.originalWidth);
        const originalBottom = this.originalParentHeight - (this.originalY + this.originalHeight);

        // Apply horizontal constraint
        switch (this.horizontal) {
            case 'left':
                // Keep distance from left edge
                child.x = parentX + this.originalX;
                child.width = this.originalWidth;
                break;
            case 'right':
                // Keep distance from right edge
                child.x = parentX + parentWidth - originalRight - this.originalWidth;
                child.width = this.originalWidth;
                break;
            case 'center':
                // Keep centered
                const centerRatio = (this.originalX + this.originalWidth / 2) / this.originalParentWidth;
                child.x = parentX + parentWidth * centerRatio - this.originalWidth / 2;
                child.width = this.originalWidth;
                break;
            case 'scale':
                // Scale proportionally
                const xRatio = this.originalX / this.originalParentWidth;
                const widthRatio = this.originalWidth / this.originalParentWidth;
                child.x = parentX + parentWidth * xRatio;
                child.width = parentWidth * widthRatio;
                break;
            case 'left-right':
                // Stretch to maintain both edges
                child.x = parentX + this.originalX;
                child.width = parentWidth - this.originalX - originalRight;
                break;
        }

        // Apply vertical constraint
        switch (this.vertical) {
            case 'top':
                // Keep distance from top edge
                child.y = parentY + this.originalY;
                child.height = this.originalHeight;
                break;
            case 'bottom':
                // Keep distance from bottom edge
                child.y = parentY + parentHeight - originalBottom - this.originalHeight;
                child.height = this.originalHeight;
                break;
            case 'center':
                // Keep centered
                const centerRatio = (this.originalY + this.originalHeight / 2) / this.originalParentHeight;
                child.y = parentY + parentHeight * centerRatio - this.originalHeight / 2;
                child.height = this.originalHeight;
                break;
            case 'scale':
                // Scale proportionally
                const yRatio = this.originalY / this.originalParentHeight;
                const heightRatio = this.originalHeight / this.originalParentHeight;
                child.y = parentY + parentHeight * yRatio;
                child.height = parentHeight * heightRatio;
                break;
            case 'top-bottom':
                // Stretch to maintain both edges
                child.y = parentY + this.originalY;
                child.height = parentHeight - this.originalY - originalBottom;
                break;
        }
    }

    serialize() {
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

    static deserialize(data) {
        if (!data) return null;
        return new Constraints(data);
    }
}

// Export classes
window.AutoLayout = AutoLayout;
window.Constraints = Constraints;
