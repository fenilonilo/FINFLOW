import { spring, stepSprings } from '@/lib/spring'

// Port fiel do protótipo (prototipo.html 1043–1184): um shader WebGL2 por placa, sem env de vídeo.
const VERT = `#version 300 es
in vec2 aPosition; out vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`;
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform vec2 uSize; uniform float uRadius, uScale, uBlur, uRough, uMetal, uWarp, uWarpScale, uShine, uBevel, uGlare, uGain;
uniform mat3 uRotate; uniform vec2 uPointer;
const float VIEW = 900.0;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0; }
vec3 gradientNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0), du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = hash2(i), gb = hash2(i + vec2(1, 0)), gc = hash2(i + vec2(0, 1)), gd = hash2(i + vec2(1, 1));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1, 0)), vc = dot(gc, f - vec2(0, 1)), vd = dot(gd, f - vec2(1, 1));
  float k = va - vb - vc + vd;
  float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  vec2 slope = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k + vec2(vb, vc) - va);
  return vec3(value, slope);
}
float valueNoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
float erf(float x) { float x2 = x * x; return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + 0.147 * x2) / (1.0 + 0.147 * x2))); }
float band(float x, float hw, float sigma) { float s = 1.4142136 * max(sigma, 0.0001); return 0.5 * (erf((x + hw) / s) - erf((x - hw) / s)); }
float strip(vec2 q, vec2 c, vec2 dir, float hw, vec2 sigma) { vec2 n = vec2(-dir.y, dir.x); return band(dot(q - c, n), hw, length(sigma * n)); }
const vec2 SWEEP = vec2(0.5, 0.86);
float softbox(vec2 q, vec2 sigma) {
  float key = strip(q, vec2(-0.1, -0.16), normalize(SWEEP), 0.022, sigma + 0.018);
  float top = band(q.y + 0.6, 0.12, sigma.y + 0.05);
  float side = band(q.x - 0.46, 0.05, sigma.x + 0.05);
  return key + top * 0.8 + side * 0.35;
}
float room(vec2 q, vec2 sigma) {
  float fall = smoothstep(-0.55, 0.5, q.y);
  float flag = strip(q, vec2(0.24, -0.02), normalize(SWEEP), 0.09, sigma + 0.08);
  return mix(0.85, 0.12, fall) * (1.0 - 0.6 * flag);
}
void main() {
  vec2 p = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uSize, halfSize = uSize * 0.5;
  float r = min(uRadius, min(halfSize.x, halfSize.y));
  vec2 corner = abs(p) - halfSize + r, side = vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0);
  float d; vec2 outward;
  if (corner.x > 0.0 && corner.y > 0.0) { d = length(corner) - r; outward = normalize(corner) * side; }
  else if (corner.x > corner.y) { d = corner.x - r; outward = vec2(side.x, 0.0); }
  else { d = corner.y - r; outward = vec2(0.0, side.y); }
  float coverage = clamp(0.5 - d * uScale, 0.0, 1.0);
  float cw = min(uBevel, max(r, 1.0));
  float chamfer = cw > 0.01 ? 1.0 - smoothstep(0.0, cw, -d) : 0.0;
  vec2 slope = outward * chamfer;
  vec2 wp = p / (220.0 * uWarpScale);
  vec3 w1 = gradientNoise(wp), w2 = gradientNoise(wp * 2.07 + 13.7);
  vec2 ripple = (w1.yz + w2.yz * 0.5) * uWarp;
  slope += ripple * 0.008;
  float grain = valueNoise(vec2(p.x * 0.008, p.y * 0.55)) * 0.45 + valueNoise(vec2(p.x * 0.019 + 3.7, p.y * 0.23)) * 0.35 + valueNoise(vec2(p.x * 0.004 + 9.2, p.y * 0.09)) * 0.2;
  float brush = uRough * uRough;
  slope.y += (grain - 0.5) * brush * 0.004;
  vec3 normal = uRotate * normalize(vec3(slope, 1.0));
  vec3 position = uRotate * vec3(p, 0.0);
  vec3 view = normalize(position - vec3(0.0, 0.0, VIEW));
  vec3 bounce = reflect(view, normal);
  vec2 q = bounce.xy / max(bounce.z, 0.2);
  vec2 fp = fwidth(q);
  vec2 sigma = sqrt(vec2(uBlur / VIEW) * vec2(uBlur / VIEW) + fp * fp * 0.5) + vec2(0.004, 0.05) * uRough;
  float scene = room(q, sigma) * (1.0 + (grain - 0.5) * brush * 0.3);
  vec2 toPointer = (uPointer - p) / (120.0 + uBlur * 4.0);
  vec2 spread = toPointer * vec2(1.0, 1.0 / (1.0 + 2.5 * uRough));
  float reach = dot(spread, spread);
  float glint = max(1.0 + 3.0 * dot(slope, toPointer), 0.0);
  float glare = (exp(-reach * 1.6) + exp(-reach * 0.35) * 0.15) * glint * uGlare * (1.0 + 0.8 * (grain - 0.5) * brush);
  float highlight = (softbox(q, sigma) * uShine + glare) * mix(0.4, 1.0, uMetal);
  vec3 color = vec3(0.005) + vec3(scene * 0.05 * uMetal + highlight * 0.36);
  color *= uGain;
  color = min(color, 0.7) + 0.3 * (1.0 - exp(-max(color - 0.7, 0.0) / 0.3));
  color = pow(clamp(color, 0.0, 1.0), vec3(1.15));   // stay linear-ish: screen blend keeps brand colour, only glints pop
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(clamp(color, 0.0, 1.0) * coverage, coverage);
}`

const S = { metal: 1, rough: 0.3, blur: 6, shine: 1, glare: 0.55, warp: 0.6, warpScale: 1, bevel: 3, tilt: 12, radius: 18, gain: 1.9 }
const redraws = new Set<() => void>()

/** Redesenha os cartões que ficaram visíveis (ex.: ao entrar na aba Cartões). */
export function metalRefresh(): void {
  requestAnimationFrame(() => redraws.forEach((f) => f()))
}

/** Monta a camada metálica em `canvas` (dentro de `plate`); null se não houver WebGL2. */
export function mountMetal(host: HTMLElement, plate: HTMLElement, canvas: HTMLCanvasElement): (() => void) | null {
  if (!('WebGL2RenderingContext' in window)) return null // jsdom/browsers sem WebGL2: nem tenta getContext
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
  if (!gl) return null
  const sh = (t: number, src: string) => {
    const s = gl.createShader(t)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s))
    return s
  }
  const prog = gl.createProgram()!
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
  gl.bindAttribLocation(prog, 0, 'aPosition')
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return null }
  const U: Record<string, WebGLUniformLocation | null> = {}
  for (let i = 0; i < gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i++) {
    const n = gl.getActiveUniform(prog, i)!.name
    U[n] = gl.getUniformLocation(prog, n)
  }
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const x = spring(0, 120, 16), y = spring(0, 120, 16)
  const light = { p: 0, t: 0 }, ptr = { x: 0, y: 0 }, rot = new Float32Array(9)
  let raf = 0, last = 0, w = 0, h = 0

  const size = () => {
    w = plate.offsetWidth
    h = plate.offsetHeight
    const sc = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(w * sc))
    canvas.height = Math.max(1, Math.round(h * sc))
  }
  function draw() {
    if (!w) return
    const tilt = reduced ? 0 : S.tilt
    const rx = y.p * tilt * Math.PI / 180, ry = -x.p * tilt * Math.PI / 180
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry)
    rot.set([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy])
    gl!.viewport(0, 0, canvas.width, canvas.height)
    gl!.useProgram(prog)
    gl!.uniform2f(U.uSize, w, h); gl!.uniform1f(U.uRadius, S.radius); gl!.uniform1f(U.uScale, canvas.width / w)
    gl!.uniformMatrix3fv(U.uRotate, false, rot); gl!.uniform1f(U.uBlur, S.blur); gl!.uniform1f(U.uRough, S.rough); gl!.uniform1f(U.uMetal, S.metal)
    gl!.uniform1f(U.uWarp, S.warp); gl!.uniform1f(U.uWarpScale, S.warpScale); gl!.uniform1f(U.uShine, S.shine); gl!.uniform1f(U.uBevel, S.bevel)
    gl!.uniform1f(U.uGlare, S.glare * light.p); gl!.uniform2f(U.uPointer, ptr.x, ptr.y); gl!.uniform1f(U.uGain, S.gain)
    gl!.drawArrays(gl!.TRIANGLES, 0, 3)
    plate.style.setProperty('--rx', (y.p * tilt).toFixed(3) + 'deg')
    plate.style.setProperty('--ry', (-x.p * tilt).toFixed(3) + 'deg')
  }
  function frame(now: number) {
    raf = 0
    const dt = Math.min(0.05, (now - last) / 1000 || 0)
    last = now
    const busy = stepSprings([x, y], dt, { p: 5e-4, v: 5e-4 })
    light.p += (light.t - light.p) * (1 - Math.exp(-dt / (light.t > light.p ? 0.18 : 0.45)))
    const lightBusy = Math.abs(light.t - light.p) > 2e-3
    if (!lightBusy) light.p = light.t
    draw()
    if (busy || lightBusy) raf = requestAnimationFrame(frame)
  }
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame) } }
  const aimAt = (e: PointerEvent) => {
    const r = host.getBoundingClientRect()
    if (!r.width) return
    const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = (e.clientY - r.top) / r.height * 2 - 1
    ptr.x = nx * w * 0.5; ptr.y = ny * h * 0.5
    x.t = Math.max(-1, Math.min(1, nx)); y.t = Math.max(-1, Math.min(1, ny)); light.t = 1
    if (!reduced) wake(); else { light.p = 1; draw() }
  }
  const leave = () => { x.t = 0; y.t = 0; light.t = 0; if (!reduced) wake(); else { light.p = 0; draw() } }
  host.addEventListener('pointerenter', aimAt)
  host.addEventListener('pointermove', aimAt)
  host.addEventListener('pointerleave', leave)
  const redraw = () => { size(); draw() }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null
  ro?.observe(plate)
  redraws.add(redraw)
  redraw()

  return () => {
    cancelAnimationFrame(raf)
    ro?.disconnect()
    redraws.delete(redraw)
    host.removeEventListener('pointerenter', aimAt)
    host.removeEventListener('pointermove', aimAt)
    host.removeEventListener('pointerleave', leave)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
