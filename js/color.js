/**
 * Color utility class for the Figma clone
 */

class Color {
    constructor(r = 0, g = 0, b = 0, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    static fromHex(hex) {
        const parsed = Utils.parseColor(hex);
        return new Color(parsed.r, parsed.g, parsed.b, parsed.a);
    }

    static fromRGBA(r, g, b, a = 1) {
        return new Color(r, g, b, a);
    }

    static fromHSL(h, s, l, a = 1) {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        return new Color(
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255),
            a
        );
    }

    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }

    toHex(includeAlpha = false) {
        const toHex = (n) => {
            const hex = Math.round(Utils.clamp(n, 0, 255)).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        let hex = '#' + toHex(this.r) + toHex(this.g) + toHex(this.b);
        if (includeAlpha && this.a < 1) {
            hex += toHex(this.a * 255);
        }
        return hex;
    }

    toRGBA() {
        if (this.a === 1) {
            return `rgb(${this.r}, ${this.g}, ${this.b})`;
        }
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
    }

    toHSL() {
        const r = this.r / 255;
        const g = this.g / 255;
        const b = this.b / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;

        if (max === min) {
            return { h: 0, s: 0, l };
        }

        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        let h;
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }

        return { h: h * 360, s, l };
    }

    withAlpha(alpha) {
        return new Color(this.r, this.g, this.b, Utils.clamp(alpha, 0, 1));
    }

    lighten(amount) {
        const hsl = this.toHSL();
        hsl.l = Utils.clamp(hsl.l + amount, 0, 1);
        return Color.fromHSL(hsl.h, hsl.s, hsl.l, this.a);
    }

    darken(amount) {
        return this.lighten(-amount);
    }

    mix(other, ratio = 0.5) {
        return new Color(
            Math.round(Utils.lerp(this.r, other.r, ratio)),
            Math.round(Utils.lerp(this.g, other.g, ratio)),
            Math.round(Utils.lerp(this.b, other.b, ratio)),
            Utils.lerp(this.a, other.a, ratio)
        );
    }

    isLight() {
        // Using relative luminance
        const luminance = (0.299 * this.r + 0.587 * this.g + 0.114 * this.b) / 255;
        return luminance > 0.5;
    }

    contrastColor() {
        return this.isLight() ? new Color(0, 0, 0, 1) : new Color(255, 255, 255, 1);
    }

    equals(other) {
        return this.r === other.r &&
               this.g === other.g &&
               this.b === other.b &&
               this.a === other.a;
    }

    serialize() {
        return {
            r: this.r,
            g: this.g,
            b: this.b,
            a: this.a
        };
    }

    static deserialize(data) {
        return new Color(data.r, data.g, data.b, data.a);
    }
}

// Predefined colors
Color.WHITE = new Color(255, 255, 255, 1);
Color.BLACK = new Color(0, 0, 0, 1);
Color.RED = new Color(255, 0, 0, 1);
Color.GREEN = new Color(0, 255, 0, 1);
Color.BLUE = new Color(0, 0, 255, 1);
Color.TRANSPARENT = new Color(0, 0, 0, 0);

window.Color = Color;
