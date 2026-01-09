/**
 * WebGL-accelerated renderer for better performance
 * Falls back to Canvas 2D for complex operations
 */

import type { DesignObject } from './objects.ts';

export interface Viewport {
    offsetX: number;
    offsetY: number;
    zoom: number;
}

interface WebGLProgramInfo extends WebGLProgram {
    attributes: Record<string, number>;
    uniforms: Record<string, WebGLUniformLocation | null>;
}

interface Programs {
    shape: WebGLProgramInfo | null;
    gradient: WebGLProgramInfo | null;
    texture: WebGLProgramInfo | null;
    roundedRect: WebGLProgramInfo | null;
}

interface Buffers {
    quad: WebGLBuffer | null;
}

export class WebGLRenderer {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext | WebGL2RenderingContext | null;
    programs: Programs;
    buffers: Buffers;
    textures: Map<string, WebGLTexture>;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        }) as WebGL2RenderingContext | null;

        if (!this.gl) {
            console.warn('WebGL2 not available, falling back to WebGL1');
            this.gl = canvas.getContext('webgl', {
                alpha: true,
                antialias: true
            });
        }

        if (!this.gl) {
            console.error('WebGL not supported');
        }

        this.programs = {
            shape: null,
            gradient: null,
            texture: null,
            roundedRect: null
        };
        this.buffers = {
            quad: null
        };
        this.textures = new Map();

        this.init();
    }

    init(): void {
        const gl = this.gl;
        if (!gl) return;

        // Enable blending for transparency
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Create shader programs
        this.createShaderPrograms();
        this.createBuffers();
    }

    createShaderPrograms(): void {
        // Basic shape shader
        const shapeVS = `
            attribute vec2 a_position;
            attribute vec4 a_color;
            uniform mat3 u_matrix;
            varying vec4 v_color;

            void main() {
                vec2 position = (u_matrix * vec3(a_position, 1)).xy;
                gl_Position = vec4(position, 0, 1);
                v_color = a_color;
            }
        `;

        const shapeFS = `
            precision mediump float;
            varying vec4 v_color;

            void main() {
                gl_FragColor = v_color;
            }
        `;

        // Gradient shader
        const gradientVS = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat3 u_matrix;
            varying vec2 v_texCoord;

            void main() {
                vec2 position = (u_matrix * vec3(a_position, 1)).xy;
                gl_Position = vec4(position, 0, 1);
                v_texCoord = a_texCoord;
            }
        `;

        const gradientFS = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform vec4 u_startColor;
            uniform vec4 u_endColor;
            uniform float u_angle;
            uniform int u_type; // 0 = linear, 1 = radial

            void main() {
                float t;
                if (u_type == 0) {
                    // Linear gradient
                    float rad = u_angle * 3.14159 / 180.0;
                    vec2 dir = vec2(cos(rad), sin(rad));
                    t = dot(v_texCoord - 0.5, dir) + 0.5;
                } else {
                    // Radial gradient
                    t = length(v_texCoord - 0.5) * 2.0;
                }
                t = clamp(t, 0.0, 1.0);
                gl_FragColor = mix(u_startColor, u_endColor, t);
            }
        `;

        // Texture shader for images
        const textureVS = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform mat3 u_matrix;
            varying vec2 v_texCoord;

            void main() {
                vec2 position = (u_matrix * vec3(a_position, 1)).xy;
                gl_Position = vec4(position, 0, 1);
                v_texCoord = a_texCoord;
            }
        `;

        const textureFS = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform float u_opacity;

            void main() {
                vec4 color = texture2D(u_texture, v_texCoord);
                gl_FragColor = vec4(color.rgb, color.a * u_opacity);
            }
        `;

        // Rounded rectangle shader
        const roundedRectFS = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform vec4 u_color;
            uniform vec2 u_size;
            uniform float u_radius;
            uniform float u_strokeWidth;
            uniform vec4 u_strokeColor;

            float roundedBox(vec2 p, vec2 b, float r) {
                vec2 q = abs(p) - b + r;
                return length(max(q, 0.0)) - r;
            }

            void main() {
                vec2 p = v_texCoord * u_size - u_size * 0.5;
                float d = roundedBox(p, u_size * 0.5, u_radius);

                float aa = 1.0 / min(u_size.x, u_size.y);
                float alpha = 1.0 - smoothstep(-aa, aa, d);

                vec4 color = u_color;

                if (u_strokeWidth > 0.0) {
                    float strokeD = abs(d) - u_strokeWidth * 0.5;
                    float strokeAlpha = 1.0 - smoothstep(-aa, aa, strokeD);
                    color = mix(color, u_strokeColor, strokeAlpha * step(0.0, d + u_strokeWidth));
                }

                gl_FragColor = vec4(color.rgb, color.a * alpha);
            }
        `;

        this.programs.shape = this.createProgram(shapeVS, shapeFS);
        this.programs.gradient = this.createProgram(gradientVS, gradientFS);
        this.programs.texture = this.createProgram(textureVS, textureFS);
        this.programs.roundedRect = this.createProgram(gradientVS, roundedRectFS);
    }

    createProgram(vsSource: string, fsSource: string): WebGLProgramInfo | null {
        const gl = this.gl;
        if (!gl) return null;

        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

        if (!vs || !fs) return null;

        const program = gl.createProgram() as WebGLProgramInfo | null;
        if (!program) return null;

        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }

        // Cache attribute and uniform locations
        program.attributes = {};
        program.uniforms = {};

        const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) as number;
        for (let i = 0; i < numAttribs; i++) {
            const info = gl.getActiveAttrib(program, i);
            if (info) {
                program.attributes[info.name] = gl.getAttribLocation(program, info.name);
            }
        }

        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(program, i);
            if (info) {
                program.uniforms[info.name] = gl.getUniformLocation(program, info.name);
            }
        }

        return program;
    }

    compileShader(type: number, source: string): WebGLShader | null {
        const gl = this.gl;
        if (!gl) return null;

        const shader = gl.createShader(type);
        if (!shader) return null;

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    createBuffers(): void {
        const gl = this.gl;
        if (!gl) return;

        // Quad buffer for rectangles
        this.buffers.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,  0, 0,
            1, 0,  1, 0,
            0, 1,  0, 1,
            0, 1,  0, 1,
            1, 0,  1, 0,
            1, 1,  1, 1
        ]), gl.STATIC_DRAW);
    }

    resize(width: number, height: number): void {
        const gl = this.gl;
        if (!gl) return;

        this.canvas.width = width;
        this.canvas.height = height;
        gl.viewport(0, 0, width, height);
    }

    clear(color: [number, number, number, number] = [0.1, 0.1, 0.1, 1]): void {
        const gl = this.gl;
        if (!gl) return;

        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Create transformation matrix
    createMatrix(x: number, y: number, width: number, height: number, rotation: number, canvasWidth: number, canvasHeight: number): Float32Array {
        // Convert to clip space (-1 to 1)
        const scaleX = 2 / canvasWidth;
        const scaleY = -2 / canvasHeight;

        const cos = Math.cos(rotation * Math.PI / 180);
        const sin = Math.sin(rotation * Math.PI / 180);

        const cx = x + width / 2;
        const cy = y + height / 2;

        // Scale, rotate around center, translate
        return new Float32Array([
            width * scaleX * cos, width * scaleY * sin, 0,
            -height * scaleX * sin, height * scaleY * cos, 0,
            (cx - width/2 * cos + height/2 * sin) * scaleX - 1,
            (cy - width/2 * sin - height/2 * cos) * scaleY + 1,
            1
        ]);
    }

    drawRectangle(obj: DesignObject, viewport: Viewport): void {
        const gl = this.gl;
        if (!gl || !this.programs.roundedRect) return;

        const program = this.programs.roundedRect;
        gl.useProgram(program);

        // Calculate screen position
        const x = obj.x * viewport.zoom + viewport.offsetX;
        const y = obj.y * viewport.zoom + viewport.offsetY;
        const width = obj.width * viewport.zoom;
        const height = obj.height * viewport.zoom;

        const matrix = this.createMatrix(x, y, width, height, obj.rotation,
            this.canvas.width, this.canvas.height);

        gl.uniformMatrix3fv(program.uniforms.u_matrix, false, matrix);

        // Parse color
        const fillColor = this.parseColor(obj.fill, obj.fillOpacity * obj.opacity);
        gl.uniform4fv(program.uniforms.u_color, fillColor);
        gl.uniform2f(program.uniforms.u_size, width, height);
        gl.uniform1f(program.uniforms.u_radius, ((obj as any).cornerRadius || 0) * viewport.zoom);

        if (obj.stroke && obj.strokeWidth > 0) {
            const strokeColor = this.parseColor(obj.stroke, obj.strokeOpacity * obj.opacity);
            gl.uniform4fv(program.uniforms.u_strokeColor, strokeColor);
            gl.uniform1f(program.uniforms.u_strokeWidth, obj.strokeWidth * viewport.zoom);
        } else {
            gl.uniform1f(program.uniforms.u_strokeWidth, 0);
        }

        // Bind quad buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.enableVertexAttribArray(program.attributes.a_position);
        gl.vertexAttribPointer(program.attributes.a_position, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(program.attributes.a_texCoord);
        gl.vertexAttribPointer(program.attributes.a_texCoord, 2, gl.FLOAT, false, 16, 8);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    parseColor(color: string | null | undefined, opacity: number = 1): [number, number, number, number] {
        if (!color) return [0, 0, 0, 0];

        // Handle hex colors
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.substr(0, 2), 16) / 255;
            const g = parseInt(hex.substr(2, 2), 16) / 255;
            const b = parseInt(hex.substr(4, 2), 16) / 255;
            return [r, g, b, opacity];
        }

        // Handle rgba
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
            return [
                parseInt(match[1]!) / 255,
                parseInt(match[2]!) / 255,
                parseInt(match[3]!) / 255,
                (match[4] ? parseFloat(match[4]) : 1) * opacity
            ];
        }

        return [0, 0, 0, opacity];
    }

    createTexture(image: HTMLImageElement): WebGLTexture | null {
        const gl = this.gl;
        if (!gl) return null;

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return texture;
    }

    drawImage(obj: DesignObject & { image?: HTMLImageElement }, viewport: Viewport): void {
        const gl = this.gl;
        if (!gl || !obj.image || !obj.image.complete) return;

        // Get or create texture
        let texture = this.textures.get(obj.id);
        if (!texture) {
            texture = this.createTexture(obj.image)!;
            if (texture) {
                this.textures.set(obj.id, texture);
            }
        }

        const program = this.programs.texture;
        if (!program) return;

        gl.useProgram(program);

        const x = obj.x * viewport.zoom + viewport.offsetX;
        const y = obj.y * viewport.zoom + viewport.offsetY;
        const width = obj.width * viewport.zoom;
        const height = obj.height * viewport.zoom;

        const matrix = this.createMatrix(x, y, width, height, obj.rotation,
            this.canvas.width, this.canvas.height);

        gl.uniformMatrix3fv(program.uniforms.u_matrix, false, matrix);
        gl.uniform1f(program.uniforms.u_opacity, obj.opacity * obj.fillOpacity);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.uniforms.u_texture, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.quad);
        gl.enableVertexAttribArray(program.attributes.a_position);
        gl.vertexAttribPointer(program.attributes.a_position, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(program.attributes.a_texCoord);
        gl.vertexAttribPointer(program.attributes.a_texCoord, 2, gl.FLOAT, false, 16, 8);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    dispose(): void {
        const gl = this.gl;
        if (!gl) return;

        // Clean up textures
        this.textures.forEach(texture => gl.deleteTexture(texture));
        this.textures.clear();

        // Clean up buffers
        Object.values(this.buffers).forEach(buffer => {
            if (buffer) gl.deleteBuffer(buffer);
        });

        // Clean up programs
        Object.values(this.programs).forEach(program => {
            if (program) gl.deleteProgram(program);
        });
    }
}

export default WebGLRenderer;
