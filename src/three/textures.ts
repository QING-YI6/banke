import * as THREE from 'three'

/** 所有贴图都在运行时用 Canvas 画出来，离线可用，也避免素材版权问题。 */

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas2d(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement, srgb = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

let skinCache: THREE.Texture | null = null
let fleshCache: THREE.Texture | null = null
let glowCache: THREE.Texture | null = null

/** 番茄表皮：深红底 + 细碎斑驳 + 纵向浅纹 */
export function skinTexture(): THREE.Texture {
  if (skinCache) return skinCache
  const size = 512
  const [c, ctx] = canvas2d(size)
  const rnd = rng(1207)

  const base = ctx.createLinearGradient(0, 0, size, size)
  base.addColorStop(0, '#a82a16')
  base.addColorStop(0.45, '#8d1d0d')
  base.addColorStop(0.75, '#b02c17')
  base.addColorStop(1, '#751306')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 240; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 4 + rnd() * 38
    const light = rnd() > 0.52
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.55 + rnd() * 0.9), rnd() * Math.PI, 0, Math.PI * 2)
    ctx.fillStyle = light ? `rgba(238,106,77,${0.03 + rnd() * 0.07})` : `rgba(108,22,12,${0.03 + rnd() * 0.08})`
    ctx.fill()
  }

  // 纵向浅纹，顺着番茄的肩部
  for (let i = 0; i < 46; i++) {
    const x = rnd() * size
    const w = 1 + rnd() * 2.4
    const g = ctx.createLinearGradient(x, 0, x + 26, size)
    g.addColorStop(0, 'rgba(255,170,140,0)')
    g.addColorStop(0.4, `rgba(255,164,132,${0.05 + rnd() * 0.07})`)
    g.addColorStop(1, 'rgba(90,18,10,0)')
    ctx.strokeStyle = g
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + 30, size * 0.33, x - 24, size * 0.66, x + 8, size)
    ctx.stroke()
  }

  // 细小噪点
  const img = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 14
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.6))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.6))
  }
  ctx.putImageData(img, 0, 0)

  skinCache = toTexture(c)
  return skinCache
}

/** 切面：果肉、筋络、籽腔与籽 */
export function fleshTexture(): THREE.Texture {
  if (fleshCache) return fleshCache
  const size = 640
  const [c, ctx] = canvas2d(size)
  const rnd = rng(7719)
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.5

  const base = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.2, R * 0.05, cx, cy, R)
  base.addColorStop(0, '#d98a63')
  base.addColorStop(0.28, '#ce603c')
  base.addColorStop(0.6, '#bc452b')
  base.addColorStop(0.92, '#982a19')
  base.addColorStop(1, '#791b0e')
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()

  // 从中心向外的果肉纤维
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2
    const r0 = R * (0.12 + rnd() * 0.42)
    const r1 = r0 + R * (0.1 + rnd() * 0.42)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
    ctx.lineTo(cx + Math.cos(a + (rnd() - 0.5) * 0.1) * r1, cy + Math.sin(a + (rnd() - 0.5) * 0.1) * r1)
    ctx.strokeStyle = rnd() > 0.5 ? `rgba(255,205,175,${0.04 + rnd() * 0.07})` : `rgba(150,35,22,${0.05 + rnd() * 0.08})`
    ctx.lineWidth = 0.8 + rnd() * 2.2
    ctx.stroke()
  }

  // 中心胎座：不规则的浅色果心
  ctx.save()
  ctx.translate(cx, cy)
  ctx.beginPath()
  const coreR = R * 0.24
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const rr = coreR * (0.72 + 0.35 * Math.sin(a * 3.0 + 1.2) + rnd() * 0.08)
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  const core = ctx.createRadialGradient(0, 0, coreR * 0.2, 0, 0, coreR)
  core.addColorStop(0, 'rgba(238,201,158,0.92)')
  core.addColorStop(1, 'rgba(216,164,112,0.5)')
  ctx.fillStyle = core
  ctx.fill()
  ctx.restore()

  // 四五个籽腔
  const cavities = 5
  for (let k = 0; k < cavities; k++) {
    const a = (k / cavities) * Math.PI * 2 + 0.35
    const dist = R * (0.42 + rnd() * 0.06)
    const px = cx + Math.cos(a) * dist
    const py = cy + Math.sin(a) * dist
    const rot = a
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(rot)
    ctx.beginPath()
    ctx.ellipse(0, 0, R * 0.17, R * 0.105, 0, 0, Math.PI * 2)
    const gel = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.18)
    gel.addColorStop(0, 'rgba(214,150,95,0.55)')
    gel.addColorStop(0.7, 'rgba(204,132,82,0.28)')
    gel.addColorStop(1, 'rgba(190,100,64,0)')
    ctx.fillStyle = gel
    ctx.fill()

    // 籽
    for (let s = 0; s < 5; s++) {
      const sx = -R * 0.105 + s * R * 0.052
      const sy = (rnd() - 0.5) * R * 0.055
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate((rnd() - 0.5) * 0.8)
      ctx.beginPath()
      ctx.ellipse(0, 0, R * 0.019, R * 0.032, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(240,219,178,0.9)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(154,96,56,0.65)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  }

  // 外圈果皮
  ctx.beginPath()
  ctx.arc(cx, cy, R - 3, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(122,26,16,0.85)'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, R - 9, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,190,155,0.22)'
  ctx.lineWidth = 3
  ctx.stroke()

  fleshCache = toTexture(c)
  return fleshCache
}

/** 柔光贴图：切口的闪光、水汽 */
export function glowTexture(): THREE.Texture {
  if (glowCache) return glowCache
  const size = 256
  const [c, ctx] = canvas2d(size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,244,220,1)')
  g.addColorStop(0.25, 'rgba(255,220,170,0.55)')
  g.addColorStop(0.6, 'rgba(255,170,120,0.12)')
  g.addColorStop(1, 'rgba(255,150,100,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowCache = toTexture(c)
  return glowCache
}
