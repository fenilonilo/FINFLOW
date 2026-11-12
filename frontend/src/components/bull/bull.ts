import * as THREE from 'three'

export type Bull = {
  place(screen: string, contentRect: DOMRect | null): void
  shock(x: number, y: number): void
  dispose(): void
}

// Port fiel do protótipo (prototipo.html 1185–1351): parâmetros inalterados.
export function createBull(canvas: HTMLCanvasElement): Bull | null {
  let renderer: THREE.WebGLRenderer
  if (!(canvas.getContext('webgl2') || canvas.getContext('webgl'))) return null
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    return null
  }
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const PR = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(PR)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(0, 0, 10)
  const group = new THREE.Group()
  scene.add(group)

  let screen = 'login'
  let rect: DOMRect | null = null
  let dimTarget = 1
  let placed = false
  let disposed = false
  let swapTimer: ReturnType<typeof setTimeout> | undefined

  function applyPlace() {
    const W = window.innerWidth
    const halfH = Math.tan(THREE.MathUtils.degToRad(19)) * 10
    const halfW = halfH * camera.aspect
    if (screen === 'login') {
      group.position.set(0, 0, 0)
      group.scale.setScalar(1)
      return 1
    }
    const right = rect ? Math.min(rect.right, W) : W * 0.55
    const s = 0.9
    const bullHalfPx = ((2.55 * s) / (2 * halfW)) * W
    group.scale.setScalar(s)
    if (W - right > bullHalfPx * 1.3) {
      const cx = Math.min((right + W) / 2, W - bullHalfPx - 24)
      group.position.set(((cx / W) * 2 - 1) * halfW, -0.1, 0)
      return 0.42
    }
    group.position.set(halfW - 2.6 * s, -0.1, 0)
    return 0.22
  }
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    dimTarget = applyPlace()
  }
  window.addEventListener('resize', resize)
  resize()

  const uniforms = {
    uTime: { value: 0 }, uMorph: { value: 0 }, uPR: { value: PR }, uDim: { value: 1 },
    uMouse: { value: new THREE.Vector3() }, uMouseStr: { value: 0 },
    uShockO: { value: new THREE.Vector3() }, uShockT: { value: 99 },
  }
  let morphTarget = 1
  let morphSpeed = 0.55
  if (reduced) uniforms.uMorph.value = 1

  const mouse = new THREE.Vector2(0, 0)
  let inside = false
  const onMove = (e: PointerEvent) => {
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
    inside = true
  }
  const onLeave = () => { inside = false }
  window.addEventListener('pointermove', onMove)
  document.addEventListener('pointerleave', onLeave)

  const ray = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const hit = new THREE.Vector3()
  function localMouse() {
    ray.setFromCamera(mouse, camera)
    ray.ray.intersectPlane(plane, hit)
    return group.worldToLocal(hit.clone())
  }

  let geo: THREE.BufferGeometry | undefined
  let mat: THREE.ShaderMaterial | undefined
  const clock = new THREE.Clock()
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05)
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uShockT.value += dt
    const m = uniforms.uMorph.value
    uniforms.uMorph.value = m + Math.sign(morphTarget - m) * Math.min(Math.abs(morphTarget - m), dt * morphSpeed)
    uniforms.uDim.value += (dimTarget - uniforms.uDim.value) * 0.06
    if (!reduced) {
      uniforms.uMouse.value.lerp(localMouse(), 0.18)
      uniforms.uMouseStr.value += ((inside ? 1 : 0) - uniforms.uMouseStr.value) * 0.08
      group.rotation.y += (mouse.x * 0.14 - group.rotation.y) * 0.04
      group.rotation.x += (-mouse.y * 0.05 - group.rotation.x) * 0.04
    }
    renderer.render(scene, camera)
  }
  const onVisibility = () => {
    if (!geo) return
    if (document.hidden) renderer.setAnimationLoop(null)
    else { clock.getDelta(); renderer.setAnimationLoop(frame) }
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ---- bull v2 (photo sampling) ----
  const img = new Image()
  img.onload = () => {
    if (disposed) return
    const X0 = 90, Y0 = 360, W = 560, H = 590
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const cx = cv.getContext('2d', { willReadFrequently: true })
    if (!cx) return
    cx.drawImage(img, X0, Y0, W, H, 0, 0, W, H)
    const px = cx.getImageData(0, 0, W, H).data
    const lum = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
    const dist = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) dist[i] = lum[i] > 22 ? 1e9 : 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!dist[i]) continue
      let d = dist[i]
      if (x > 0) d = Math.min(d, dist[i - 1] + 1)
      if (y > 0) {
        d = Math.min(d, dist[i - W] + 1)
        if (x > 0) d = Math.min(d, dist[i - W - 1] + 1.414)
        if (x < W - 1) d = Math.min(d, dist[i - W + 1] + 1.414)
      }
      dist[i] = d
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x
      if (!dist[i]) continue
      let d = dist[i]
      if (x < W - 1) d = Math.min(d, dist[i + 1] + 1)
      if (y < H - 1) {
        d = Math.min(d, dist[i + W] + 1)
        if (x < W - 1) d = Math.min(d, dist[i + W + 1] + 1.414)
        if (x > 0) d = Math.min(d, dist[i + W - 1] + 1.414)
      }
      dist[i] = d
    }
    let dmax = 0
    for (let i = 0; i < W * H; i++) if (dist[i] < 1e8) dmax = Math.max(dmax, dist[i])

    const S = 5.6 / H, DEPTH = 1.25
    const pos: number[] = [], scat: number[] = [], size: number[] = [], bright: number[] = [], delay: number[] = [], isBull: number[] = []
    const push = (x: number, y: number, z: number, s: number, b: number, bull: number) => {
      pos.push(x, y, z)
      const r = 7 + Math.random() * 6, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
      scat.push(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.6, r * Math.cos(ph) - 3)
      size.push(s); bright.push(b); isBull.push(bull)
      delay.push(Math.min(1, Math.max(0, ((x + 3) / 6) * 0.7 + Math.random() * 0.3)))
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, L = lum[i]
      if (L <= 22) continue
      const t = Math.sqrt(dist[i] / dmax), n = L / 255, p = 0.07 + Math.pow(n, 1.4) * 1.1
      if (Math.random() > p) continue
      const wx = (x - W / 2) * S, wy = -(y - H / 2) * S
      if (n > 0.3) push(wx, wy, (Math.random() < 0.5 ? 1 : -1) * t * DEPTH + (Math.random() - 0.5) * 0.03, n > 0.8 ? 4.5 + Math.random() * 2.5 : 2.0 + n * 1.6, Math.min(1, n * 1.3), 1)
      else push(wx, wy, (Math.random() * 2 - 1) * t * DEPTH, 1.6, 0.35 + n * 0.6, 1)
    }
    for (let k = 0; k < 4600; k++) push((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 13, -6 + Math.random() * 9, 0.7 + Math.random() * 2.4, 0.18 + Math.random() * 0.55, 0)

    geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('aScatter', new THREE.Float32BufferAttribute(scat, 3))
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1))
    geo.setAttribute('aBright', new THREE.Float32BufferAttribute(bright, 1))
    geo.setAttribute('aDelay', new THREE.Float32BufferAttribute(delay, 1))
    geo.setAttribute('aBull', new THREE.Float32BufferAttribute(isBull, 1))
    mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
    uniform float uTime, uMorph, uPR, uMouseStr, uShockT, uDim;
    uniform vec3 uMouse, uShockO;
    attribute vec3 aScatter; attribute float aSize, aBright, aDelay, aBull;
    varying float vGlow, vBright, vAlpha;
    void main() {
      float m = clamp((uMorph - aDelay * 0.45) / 0.55, 0.0, 1.0);
      m = mix(1.0, m * m * (3.0 - 2.0 * m), aBull);
      vec3 p = mix(aScatter, position, m);
      vec2 dd = p.xy - uMouse.xy;
      float f = smoothstep(1.0, 0.0, length(dd)) * uMouseStr;
      p.xy += normalize(dd + 1e-4) * f * 0.16;
      float r = uShockT * 5.0;
      float s = smoothstep(0.45, 0.0, abs(length(p - uShockO) - r)) * exp(-uShockT * 1.4);
      p += normalize(p - uShockO + 1e-4) * s * 0.45;
      vGlow = clamp(f * 0.45 + s * 1.8 + (1.0 - m) * 0.7, 0.0, 1.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = aSize * uPR * (1.0 + vGlow * 0.25) * (16.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
      vBright = aBright;
      vAlpha = (0.25 + 0.75 * m) * mix(1.0, uDim, aBull);
    }`,
      fragmentShader: /* glsl */ `
    varying float vGlow, vBright, vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d); a *= a;
      vec3 col = mix(vec3(0.80, 0.88, 0.84), vec3(0.45, 0.96, 0.56), clamp(vGlow + 0.12, 0.0, 1.0)) * (0.55 + vBright * 0.95);
      gl_FragColor = vec4(col, a * vAlpha * (0.3 + vBright * 0.7));
    }`,
    })
    group.add(new THREE.Points(geo, mat))
    if (!document.hidden) renderer.setAnimationLoop(frame)
  }
  img.onerror = () => {
    console.warn('bull: falha ao carregar /touro.jpg')
    canvas.dataset.fallback = 'true'
  }
  img.src = '/touro.jpg'

  return {
    place(to, r) {
      rect = r
      if (!placed || reduced || to === screen) {
        // primeira chamada, reduced-motion ou só mudou o retângulo: sem dissolve
        placed = true
        clearTimeout(swapTimer)
        if (morphTarget === 0) morphSpeed = 0.75
        morphTarget = 1
        screen = to
        dimTarget = applyPlace()
        return
      }
      // troca de tela: dissolve, reposiciona, remonta
      morphTarget = 0
      morphSpeed = 1.9
      clearTimeout(swapTimer)
      swapTimer = setTimeout(() => {
        screen = to
        dimTarget = applyPlace()
        morphTarget = 1
        morphSpeed = 0.75
      }, 560)
    },
    shock(x, y) {
      if (reduced) return
      mouse.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
      uniforms.uShockO.value.copy(localMouse())
      uniforms.uShockT.value = 0
    },
    dispose() {
      disposed = true
      clearTimeout(swapTimer)
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      geo?.dispose()
      mat?.dispose()
      renderer.dispose()
    },
  }
}
