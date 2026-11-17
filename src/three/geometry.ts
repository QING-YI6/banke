import * as THREE from 'three'

/** 番茄被压扁一点，看起来才像番茄而不是乒乓球。 */
export const TOMATO_SQUASH = 0.9

/** 极轻的四瓣起伏，避免完美球体的塑料感。 */
function lobe(a: number, theta: number): number {
  // Math.sin(Math.PI) 可能是 -3e-16，直接开方会得到 NaN。
  const s = Math.max(0, Math.sin(theta))
  return 1 + 0.03 * Math.cos(4 * a) * Math.pow(s, 0.8) + 0.012 * Math.cos(7 * a + 1.2)
}

/** 外皮：一瓣番茄的球面扇形。 */
export function makeSkinGeometry(a0: number, a1: number, radius = 1): THREE.BufferGeometry {
  const segA = 30
  const segT = 52
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []

  for (let i = 0; i <= segA; i++) {
    const a = a0 + ((a1 - a0) * i) / segA
    for (let j = 0; j <= segT; j++) {
      const th = (Math.PI * j) / segT
      const r = radius * lobe(a, th)
      const st = Math.sin(th)
      const x = st * Math.cos(a) * r
      const y = Math.cos(th) * r * TOMATO_SQUASH
      const z = st * Math.sin(a) * r
      pos.push(x, y, z)
      const sq = TOMATO_SQUASH * TOMATO_SQUASH
      const len = Math.hypot(x, y / sq, z) || 1
      nor.push(x / len, y / sq / len, z / len)
      uv.push(i / segA, 1 - j / segT)
    }
  }

  for (let i = 0; i < segA; i++) {
    for (let j = 0; j < segT; j++) {
      const a = i * (segT + 1) + j
      const b = a + segT + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/**
 * 切面：半个圆盘，直边是番茄中轴。
 * UV 正好落在横截面贴图的右半圆上，能完整露出籽腔。
 */
export function makeCapGeometry(azimuth: number, radius = 1): THREE.BufferGeometry {
  const segR = 20
  const segP = 60
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []

  for (let j = 0; j <= segP; j++) {
    const psi = (Math.PI * j) / segP
    for (let k = 0; k <= segR; k++) {
      const rho = k / segR
      const rr = radius * lobe(azimuth, psi) * rho
      const sp = Math.sin(psi)
      const cp = Math.cos(psi)
      pos.push(Math.cos(azimuth) * sp * rr, cp * rr * TOMATO_SQUASH, Math.sin(azimuth) * sp * rr)
      uv.push(0.5 + 0.5 * sp * rho, 0.5 + 0.5 * cp * rho)
    }
  }

  for (let j = 0; j < segP; j++) {
    for (let k = 0; k < segR; k++) {
      const a = j * (segR + 1) + k
      const b = a + segR + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  // 切面是平的：直接给恒定法线，避免圆心与接缝处退化三角形算出 NaN。
  const n: number[] = []
  const nx = Math.sin(azimuth)
  const nz = -Math.cos(azimuth)
  for (let i = 0; i < pos.length / 3; i++) n.push(nx, 0, nz)
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3))
  g.setIndex(idx)
  return g
}
