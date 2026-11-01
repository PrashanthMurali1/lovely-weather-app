import { FIELD_MAX_DBZ, buildColourLut, type RadarField } from "./radarField";
import { RADAR_ALPHA, STEPS } from "./radarScale";
import { tileEvicted } from "./radarTiles";

/** One tile (or a quarter of a coarser one) to paint: where it goes on screen and which part of the data it shows. */
export interface RadarDraw {
  field: RadarField;
  /** Screen rectangle in CSS pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The part of the field shown, 0..1. */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

const MARGIN = 2;

/**
 * Trim a tile to the screen (plus a small margin), adjusting which part of the data it shows.
 * Close in, one tile is thousands of pixels wide; trimming keeps the graphics card's maths exact.
 */
export function clipToView(d: RadarDraw, viewW: number, viewH: number): RadarDraw | null {
  const x0 = Math.max(d.x, -MARGIN);
  const x1 = Math.min(d.x + d.w, viewW + MARGIN);
  const y0 = Math.max(d.y, -MARGIN);
  const y1 = Math.min(d.y + d.h, viewH + MARGIN);
  if (x1 <= x0 || y1 <= y0) return null;
  if (x0 === d.x && x1 === d.x + d.w && y0 === d.y && y1 === d.y + d.h) return d;
  const du = d.u1 - d.u0;
  const dv = d.v1 - d.v0;
  return {
    field: d.field,
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0,
    u0: d.u0 + ((x0 - d.x) / d.w) * du,
    u1: d.u0 + ((x1 - d.x) / d.w) * du,
    v0: d.v0 + ((y0 - d.y) / d.h) * dv,
    v1: d.v0 + ((y1 - d.y) / d.h) * dv,
  };
}

/** Coverage level that becomes the outline of the rain. Lower grows echoes outward, higher shrinks them. */
const OUTLINE = 0.2;

const VERTEX = `#version 300 es
in vec2 aPos;
in vec2 aUv;
uniform vec2 uView;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos.x / uView.x * 2.0 - 1.0, 1.0 - aPos.y / uView.y * 2.0, 0.0, 1.0);
}`;

// Cubic B-spline sampling from four bilinear fetches, so values vary smoothly at any magnification.
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uTexSize;
uniform float uOutline;
uniform float uAlpha;
uniform float uT[${STEPS.length}];
uniform vec3 uC[${STEPS.length}];
in vec2 vUv;
out vec4 outColor;

vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

vec2 bicubic(vec2 uv) {
  vec2 inv = 1.0 / uTexSize;
  uv = uv * uTexSize - 0.5;
  vec2 fxy = fract(uv);
  uv -= fxy;
  vec4 xc = cubic(fxy.x);
  vec4 yc = cubic(fxy.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec2 s0 = texture(uField, o.xz).rg;
  vec2 s1 = texture(uField, o.yz).rg;
  vec2 s2 = texture(uField, o.xw).rg;
  vec2 s3 = texture(uField, o.yw).rg;
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

void main() {
  vec2 f = bicubic(vUv);
  // Outline: where smoothed coverage crosses the threshold, with one screen pixel of anti-aliasing.
  float edge = clamp((f.g - uOutline) / max(fwidth(f.g), 1e-4) + 0.5, 0.0, 1.0);
  // Flat colour steps. Each step edge is a smooth curve (the intensity field is smooth), with one pixel of anti-aliasing.
  float v = f.r * ${FIELD_MAX_DBZ.toFixed(1)};
  float w = max(fwidth(v), 1e-3);
  vec3 col = uC[0];
  for (int i = 1; i < ${STEPS.length}; i++) col = mix(col, uC[i], clamp((v - uT[i]) / w + 0.5, 0.0, 1.0));
  float a = edge * uAlpha;
  outColor = vec4(col * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader failed");
  return s;
}

/** Paints radar tiles on the graphics card, evaluating the data per screen pixel so it is sharp at any zoom. */
class GlRadar {
  readonly canvas = document.createElement("canvas");
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private textures = new WeakMap<RadarField, WebGLTexture>();
  private loc: Record<string, WebGLUniformLocation | null>;
  lost = false;

  constructor() {
    const gl = this.canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) throw new Error("WebGL 2 is not available");
    this.gl = gl;
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
    });
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.bindAttribLocation(program, 0, "aPos");
    gl.bindAttribLocation(program, 1, "aUv");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
    this.program = program;
    this.loc = Object.fromEntries(["uView", "uField", "uTexSize", "uOutline", "uAlpha", "uT", "uC"].map((n) => [n, gl.getUniformLocation(program, n)]));

    this.buffer = gl.createBuffer()!;
  }

  private setFilter(filter: number) {
    const { gl } = this;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private textureFor(field: RadarField): WebGLTexture {
    let t = this.textures.get(field);
    if (t) return t;
    const { gl } = this;
    t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, field.w, field.h, 0, gl.RG, gl.UNSIGNED_BYTE, field.data);
    this.setFilter(gl.LINEAR);
    this.textures.set(field, t);
    return t;
  }

  forget(field: RadarField) {
    const t = this.textures.get(field);
    if (t) {
      this.gl.deleteTexture(t);
      this.textures.delete(field);
    }
  }

  render(items: RadarDraw[], cssW: number, cssH: number, dpr: number) {
    const { gl, canvas } = this;
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!items.length) return;

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(this.loc.uView, cssW, cssH);
    gl.uniform1f(this.loc.uOutline, OUTLINE);
    gl.uniform1i(this.loc.uField, 0);
    gl.uniform1f(this.loc.uAlpha, RADAR_ALPHA);
    gl.uniform1fv(this.loc.uT, STEPS.map((s) => s.dbz));
    gl.uniform3fv(this.loc.uC, STEPS.flatMap((s) => s.rgb.map((c) => c / 255)));
    gl.activeTexture(gl.TEXTURE0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    for (const it of items) {
      gl.bindTexture(gl.TEXTURE_2D, this.textureFor(it.field));
      gl.uniform2f(this.loc.uTexSize, it.field.w, it.field.h);
      const x1 = it.x + it.w + 0.5; // a hair of overlap so tile seams never show
      const y1 = it.y + it.h + 0.5;
      // prettier-ignore
      const v = new Float32Array([
        it.x, it.y, it.u0, it.v0,  x1, it.y, it.u1, it.v0,  it.x, y1, it.u0, it.v1,
        it.x, y1, it.u0, it.v1,  x1, it.y, it.u1, it.v0,  x1, y1, it.u1, it.v1,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
}

// ---- fallback for devices without WebGL 2: the same data drawn as a plain picture ----------------

const fallbackCanvases = new WeakMap<RadarField, HTMLCanvasElement>();

function fallbackCanvas(field: RadarField): HTMLCanvasElement {
  let c = fallbackCanvases.get(field);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = field.w;
  c.height = field.h;
  const g = c.getContext("2d")!;
  const image = g.createImageData(field.w, field.h);
  const lut = buildColourLut();
  for (let i = 0; i < field.w * field.h; i++) {
    const cover = field.data[i * 2 + 1] / 255;
    if (cover < OUTLINE) continue;
    const k = field.data[i * 2] * 4;
    image.data.set([lut[k], lut[k + 1], lut[k + 2], lut[k + 3]], i * 4);
  }
  g.putImageData(image, 0, 0);
  fallbackCanvases.set(field, c);
  return c;
}

let gl: GlRadar | null | undefined;

function glRadar(): GlRadar | null {
  if (gl === undefined || (gl && gl.lost)) {
    try {
      gl = new GlRadar();
    } catch {
      gl = null;
    }
  }
  return gl;
}

// A tile that leaves the cache must also leave the graphics card.
tileEvicted.add((field) => gl?.forget(field));

/** Paint radar tiles onto a 2D canvas at the given opacity. */
export function drawRadar(ctx: CanvasRenderingContext2D, items: RadarDraw[], cssW: number, cssH: number, dpr: number, opacity: number) {
  if (!items.length) return;
  const renderer = glRadar();
  ctx.save();
  ctx.globalAlpha = opacity;
  if (renderer) {
    renderer.render(items, cssW, cssH, dpr);
    ctx.drawImage(renderer.canvas, 0, 0, cssW, cssH);
  } else {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (const it of items) {
      const sw = it.field.w;
      const sh = it.field.h;
      ctx.drawImage(fallbackCanvas(it.field), it.u0 * sw, it.v0 * sh, (it.u1 - it.u0) * sw, (it.v1 - it.v0) * sh, it.x, it.y, it.w + 0.5, it.h + 0.5);
    }
  }
  ctx.restore();
}
