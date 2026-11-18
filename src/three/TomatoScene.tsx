import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { QUADRANTS, type Quadrant } from '../core/types'
import { clamp } from '../core/time'
import { sound } from '../core/sound'
import { fleshTexture, glowTexture, skinTexture } from './textures'
import { makeCapGeometry, makeSkinGeometry, makeWholeSkinGeometry } from './geometry'
import { PALETTE } from './palette'
import { sceneBridge, waterFx, type SplashSpec } from './bridge'
import { PoolFloor, Water } from './Water'
import { Splash } from './Splash'
import { StemModel } from './StemModel'

export type ScenePhase = 'idle' | 'cutting' | 'opening' | 'settled'

const CENTER_Y = 0.9
const STEM_TOP = 1.82
const CUT_A = 2.0
const CUT_B = 2.4
const SPLIT_AT = 2.6
const FALL_DURATION = 1.12
const CAM_START = 4.6
const CAM_DURATION = 1.6

interface TomatoSceneProps {
  skipIntro: boolean
  entering: Quadrant | null
  waterIntensity: number
  selected: number
  onSelected: (index: number) => void
  onSelect: (q: Quadrant) => void
  onOpenStem: () => void
  onPhase: (phase: ScenePhase) => void
}

interface OrbitState {
  az: number
  targetAz: number
  el: number
  targetEl: number
  dragging: boolean
  lastX: number
  lastY: number
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

function smoothstep(x: number): number {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

function SkyDome() {
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[90, 32, 24]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
        vertexShader={/* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          precision highp float;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 top = vec3(0.38, 0.57, 0.73);
            vec3 mid = vec3(0.66, 0.8, 0.88);
            vec3 horizon = vec3(0.86, 0.92, 0.95);
            vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.16, h));
            col = mix(col, top, smoothstep(0.12, 0.7, h));
            vec3 sunDir = normalize(vec3(-0.4, 0.55, -0.9));
            float glow = pow(max(dot(d, sunDir), 0.0), 12.0);
            col += vec3(1.0, 0.98, 0.94) * glow * 0.18;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  )
}

function EnvironmentSetup() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04)
    scene.environment = env.texture
    scene.environmentIntensity = 0.45
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

interface RingSpec {
  at: number
  position: [number, number, number]
}

function LandRing({ spec, timeRef }: { spec: RingSpec; timeRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = timeRef.current - spec.at
    const life = 1.15
    if (t < 0 || t > life) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    const k = t / life
    const s = 0.24 + k * 1.55
    mesh.scale.set(s, s, 1)
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = (1 - k) * 0.65
  })
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={spec.position}
      visible={false}
      renderOrder={4}
    >
      <ringGeometry args={[0.68, 0.82, 64]} />
      <meshBasicMaterial color="#f2fdff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Motes({ count = 60 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10
      pos[i * 3 + 1] = 0.3 + Math.random() * 2.5
      pos[i * 3 + 2] = (Math.random() - 0.5) * 7
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.y = t * 0.008
    ref.current.position.y = Math.sin(t * 0.18) * 0.04
  })

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={0.02} transparent opacity={0.4} depthWrite={false} sizeAttenuation />
    </points>
  )
}

interface PieceFinal {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: number
  theta: number
  outward: THREE.Vector3
  ridge: THREE.Vector3
}

/**
 * 一块番茄立在水面上：皮（圆弧）朝下，芯的棱线横在顶部，像一块立起来的西瓜。
 * 长边沿切线，前后宽度沿半径，所以左右长、前后宽，顶部是一条尖棱。
 */
function standQuaternion(aMid: number, T: THREE.Vector3): THREE.Quaternion {
  const down = new THREE.Vector3(0, -1, 0)
  const M = new THREE.Vector3(Math.cos(aMid), 0, Math.sin(aMid)).normalize()
  const C = new THREE.Vector3(0, 1, 0) // 番茄中轴 = 顶部的芯棱
  const local = new THREE.Matrix4().makeBasis(M, C, new THREE.Vector3().crossVectors(M, C).normalize())
  const world = new THREE.Matrix4().makeBasis(down, T, new THREE.Vector3().crossVectors(down, T).normalize())
  const m = world.multiply(local.transpose())
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

function CameraRig({
  camMixRef,
  orbitRef,
  entering,
}: {
  camMixRef: React.MutableRefObject<number>
  orbitRef: React.MutableRefObject<OrbitState>
  entering: Quadrant | null
}) {
  const { camera, size } = useThree()

  useFrame((_, dt) => {
    const mix = clamp(camMixRef.current, 0, 1)
    const portrait = size.width / size.height < 1.0
    const r0 = portrait ? 8.4 : 5.2
    const r1 = portrait ? 7.6 : 4.5
    let r = r0 + (r1 - r0) * mix
    if (entering) r = Math.max(2.6, r - dt * 8)

    const phi0 = 1.38
    const phi1 = portrait ? 0.2 : 0.18
    const orbit = orbitRef.current
    const phi = phi0 + (phi1 - phi0) * mix + (orbit.el - phi1) * smoothstep((mix - 0.75) / 0.25)
    const az = orbit.az * smoothstep((mix - 0.75) / 0.25)
    const targetY = CENTER_Y + ((portrait ? 0.42 : 0.42) - CENTER_Y) * mix

    camera.position.set(
      Math.sin(az) * Math.cos(phi) * r,
      targetY + Math.sin(phi) * r,
      Math.cos(az) * Math.cos(phi) * r,
    )
    camera.lookAt(0, targetY, 0)
  })

  return null
}

function SceneContent({
  skipIntro,
  entering,
  waterIntensity,
  selected,
  onSelected,
  onSelect,
  onOpenStem,
  onPhase,
}: TomatoSceneProps) {
  const { size, gl } = useThree()
  const rootRef = useRef<THREE.Group>(null!)
  const wholeRef = useRef<THREE.Mesh>(null)
  const wedgeRefs = useRef<(THREE.Group | null)[]>([])
  const anchorRefs = useRef<(THREE.Object3D | null)[]>([])
  const stemRef = useRef<THREE.Group>(null!)
  const stemAnchor = useRef<THREE.Object3D>(null)
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([])
  const reflectionRefs = useRef<(THREE.Mesh | null)[]>([])
  const skinMeshes = useRef<(THREE.Mesh | null)[]>([])
  const capAMeshes = useRef<(THREE.Mesh | null)[]>([])
  const capBMeshes = useRef<(THREE.Mesh | null)[]>([])
  const ringRef = useRef<THREE.Mesh>(null)
  const lineA = useRef<THREE.Mesh>(null)
  const lineB = useRef<THREE.Mesh>(null)
  const flashA = useRef<THREE.Sprite>(null)
  const flashB = useRef<THREE.Sprite>(null)
  const animTime = useRef(0)
  const camMixRef = useRef(skipIntro ? 1 : 0)
  const orbitRef = useRef<OrbitState>({
    az: 0,
    targetAz: 0,
    el: 0.45,
    targetEl: 0.45,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })
  const [phase, setPhase] = useState<ScenePhase>(skipIntro ? 'settled' : 'idle')
  const phaseRef = useRef(phase)
  const selectedRef = useRef(selected)
  const landed = useRef([false, false, false, false])
  const stemLanded = useRef(false)
  const fired = useRef({ ripple: false })
  const lastActive = useRef(selected)

  selectedRef.current = selected

  const skinTex = useMemo(() => skinTexture(), [])
  const fleshTex = useMemo(() => fleshTexture(), [])
  const glowTex = useMemo(() => glowTexture(), [])

  const skinMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: skinTex,
        color: new THREE.Color('#f2a28e'),
        roughness: 0.46,
        metalness: 0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.42,
        sheen: 0.2,
        sheenColor: new THREE.Color('#ffb7a2'),
        envMapIntensity: 0.5,
      }),
    [skinTex],
  )

  const fleshMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: fleshTex,
        color: new THREE.Color('#ffd0bd'),
        roughness: 0.62,
        metalness: 0,
        clearcoat: 0.05,
        clearcoatRoughness: 0.7,
        sheen: 0.2,
        sheenColor: new THREE.Color('#ffe1d0'),
        envMapIntensity: 0.25,
        side: THREE.DoubleSide,
      }),
    [fleshTex],
  )

  const wholeSkin = useMemo(() => makeWholeSkinGeometry(), [])

  const quarters = useMemo(() => {
    // 横切、竖切：四个象限的边界在 0 / 90 / 180 / 270 度，切面与坐标轴对齐。
    const gap = -0.002
    return QUADRANTS.map((_, i) => {
      const a0 = (i * Math.PI) / 2 + gap
      const a1 = ((i + 1) * Math.PI) / 2 - gap
      return {
        skin: makeSkinGeometry(a0, a1),
        capA: makeCapGeometry(a0),
        capB: makeCapGeometry(a1),
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      quarters.forEach((q) => {
        q.skin.dispose()
        q.capA.dispose()
        q.capB.dispose()
      })
      wholeSkin.dispose()
      skinMaterial.dispose()
      fleshMaterial.dispose()
    }
  }, [quarters, wholeSkin, skinMaterial, fleshMaterial])

  const compact = size.width / size.height < 1.02
  const finals = useMemo<PieceFinal[]>(() => {
    const scale = compact ? 0.4 : 0.56
    const dist = compact ? 0.72 : 1.0
    return QUADRANTS.map((_, i) => {
      const theta = (i * Math.PI) / 2
      const R = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta))
      const T = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta))
      const aMid = theta + Math.PI / 4
      return {
        position: new THREE.Vector3(R.x * dist, scale + 0.02 - CENTER_Y, R.z * dist),
        quaternion: standQuaternion(aMid, T),
        scale,
        theta,
        outward: R.clone(),
        ridge: T.clone(),
      }
    })
  }, [compact])

  const stemHome = useMemo<[number, number, number]>(
    () => [0, compact ? 0.5 : 0.62, 0],
    [compact],
  )

  useEffect(() => {
    QUADRANTS.forEach((q, i) => {
      const a = anchorRefs.current[i]
      if (a) sceneBridge.register(q, a)
    })
    if (stemAnchor.current) sceneBridge.register('stem', stemAnchor.current)
    return () => {
      QUADRANTS.forEach((q, i) => sceneBridge.unregister(q, anchorRefs.current[i] ?? undefined))
      sceneBridge.unregister('stem', stemAnchor.current ?? undefined)
    }
  }, [])

  useEffect(() => {
    onPhase(phase)
  }, [phase, onPhase])

  useEffect(() => {
    if (skipIntro) {
      camMixRef.current = 1
      if (phaseRef.current !== 'settled') {
        phaseRef.current = 'settled'
        setPhase('settled')
      }
      landed.current = [true, true, true, true]
      stemLanded.current = true
    }
  }, [skipIntro])

  useEffect(() => {
    if (phase === 'cutting') sound.cut()
  }, [phase])

  useEffect(() => {
    document.body.style.cursor = phase === 'settled' ? 'grab' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [phase])

  // 360° 环视：拖动只转镜头，不做一瓣一瓣的自动切换。
  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      if (phaseRef.current !== 'settled') return
      const o = orbitRef.current
      o.dragging = true
      o.lastX = e.clientX
      o.lastY = e.clientY
      sceneBridge.dragDistance = 0
      document.body.style.cursor = 'grabbing'
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const move = (e: PointerEvent) => {
      const o = orbitRef.current
      if (!o.dragging) return
      const dx = e.clientX - o.lastX
      const dy = e.clientY - o.lastY
      o.lastX = e.clientX
      o.lastY = e.clientY
      sceneBridge.dragDistance += Math.abs(dx) + Math.abs(dy)
      o.targetAz -= dx * 0.006
      o.targetEl = clamp(o.targetEl + dy * 0.0025, 0.26, 0.78)
    }
    const up = () => {
      const o = orbitRef.current
      o.dragging = false
      if (phaseRef.current === 'settled') document.body.style.cursor = 'grab'
      try {
        el.releasePointerCapture(0)
      } catch {
        /* ignore */
      }
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl])

  const ringSpecs = useMemo<RingSpec[]>(() => {
    const rings: RingSpec[] = finals.map((f, i) => ({
      at: SPLIT_AT + i * 0.06 + FALL_DURATION + 0.02,
      position: [f.position.x + f.outward.x * 0.32, 0.022, f.position.z + f.outward.z * 0.32],
    }))
    rings.push({ at: SPLIT_AT + 1.28, position: [0, 0.022, 0] })
    return rings
  }, [finals])

  const splashSpecs = useMemo<SplashSpec[]>(() => {
    const specs: SplashSpec[] = QUADRANTS.map((_, i) => {
      const f = finals[i]
      return {
        id: `land-${i}`,
        at: SPLIT_AT + i * 0.06 + FALL_DURATION + 0.03,
        origin: [f.position.x + f.outward.x * 0.38, 0.03, f.position.z + f.outward.z * 0.38],
        count: 110,
        power: 3.0,
        color: '#f4feff',
        size: 1.5,
      }
    })
    specs.push({
      id: 'stem-land',
      at: SPLIT_AT + 1.3,
      origin: [0, 0.03, 0],
      count: 60,
      power: 1.6,
      color: '#e8fcff',
      size: 1.0,
    })
    return specs
  }, [finals])

  const clickWedge = (i: number) => {
    if (sceneBridge.dragDistance > 10) return
    if (phaseRef.current !== 'settled') return
    onSelect(QUADRANTS[i])
  }

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    animTime.current += Math.min(dt, 0.05)
    const e = animTime.current
    const step = Math.min(dt, 0.05)

    if (!skipIntro) {
      if (phaseRef.current === 'idle' && e > CUT_A) {
        phaseRef.current = 'cutting'
        setPhase('cutting')
      } else if (phaseRef.current === 'cutting' && e > SPLIT_AT) {
        phaseRef.current = 'opening'
        setPhase('opening')
      }
      const cam = smoothstep((e - CAM_START) / CAM_DURATION)
      camMixRef.current = cam
      if (cam > 0.995 && e > CAM_START + CAM_DURATION + 0.1 && phaseRef.current !== 'settled') {
        phaseRef.current = 'settled'
        setPhase('settled')
        orbitRef.current.targetAz = 0
      }

      const cutA = clamp((e - CUT_A) / 0.4, 0, 1)
      const cutB = clamp((e - CUT_B) / 0.4, 0, 1)
      if (lineA.current) {
        lineA.current.visible = cutA > 0 && cutA < 1
        lineA.current.position.y = 2.25 - easeOutCubic(cutA) * 2.0
        ;(lineA.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(cutA * Math.PI) * 0.9
      }
      if (lineB.current) {
        lineB.current.visible = cutB > 0 && cutB < 1
        lineB.current.position.y = 2.25 - easeOutCubic(cutB) * 2.0
        ;(lineB.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(cutB * Math.PI) * 0.9
      }
      const flash = (sprite: THREE.Sprite | null, at: number) => {
        if (!sprite) return
        const p = clamp((e - at) / 0.34, 0, 1)
        const s = 0.5 + p * 2.2
        sprite.scale.set(s, s, s)
        ;(sprite.material as THREE.SpriteMaterial).opacity = p > 0 && p < 1 ? (1 - p) * 0.45 : 0
      }
      flash(flashA.current, CUT_A + 0.3)
      flash(flashB.current, CUT_B + 0.3)
    } else {
      camMixRef.current = 1
      orbitRef.current.az = orbitRef.current.targetAz
      orbitRef.current.el = orbitRef.current.targetEl
    }

    if (phaseRef.current === 'settled') {
      const o = orbitRef.current
      o.az += (o.targetAz - o.az) * (1 - Math.exp(-step * 7))
      o.el += (o.targetEl - o.el) * (1 - Math.exp(-step * 7))
      const idx = ((Math.round(o.az / (Math.PI / 2)) % 4) + 4) % 4
      if (idx !== lastActive.current) {
        lastActive.current = idx
        onSelected(idx)
      }
    }

    const falling = skipIntro ? 1 : clamp((e - SPLIT_AT) / FALL_DURATION, 0, 1)
    const idle = 1 - falling

    if (rootRef.current) {
      rootRef.current.position.y = CENTER_Y + Math.sin(t * 1.2) * 0.006 * idle
    }

    for (let i = 0; i < 4; i++) {
      const g = wedgeRefs.current[i]
      if (!g) continue
      const f = finals[i]
      const delay = i * 0.055
      const k = skipIntro ? 1 : clamp((e - SPLIT_AT - delay) / FALL_DURATION, 0, 1)
      const spread = easeOutCubic(k)
      const drop = k * k
      const tip = smoothstep(clamp(k * 1.15, 0, 1))
      const landBounce = k >= 1 ? Math.sin((e - SPLIT_AT - delay - FALL_DURATION) * 10) * 0.012 : 0

      g.position.set(
        f.position.x * spread,
        f.position.y * drop + (k >= 1 ? Math.abs(landBounce) : 0),
        f.position.z * spread,
      )
      g.quaternion.copy(new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), f.quaternion, tip))
      const s = 1 + (f.scale - 1) * smoothstep(k)
      const emphasis = phaseRef.current === 'settled' ? (i === selectedRef.current ? 1.04 : 0.94) : 1
      g.scale.setScalar(s * emphasis)

      const shadow = shadowRefs.current[i]
      if (shadow) {
        shadow.position.set(f.position.x * spread, 0.016, f.position.z * spread)
        shadow.scale.setScalar(0.55 + 0.35 * k)
        ;(shadow.material as THREE.MeshBasicMaterial).opacity = k > 0.5 ? 0.14 * k : 0
      }
      const reflection = reflectionRefs.current[i]
      if (reflection) {
        reflection.position.set(f.position.x * spread, 0.014, f.position.z * spread)
        reflection.scale.set(1.1, 1.7, 1)
        ;(reflection.material as THREE.MeshBasicMaterial).opacity = k > 0.5 ? 0.1 * k : 0
      }

      const anchor = anchorRefs.current[i]
      if (anchor) {
        anchor.position.set(
          f.position.x * spread + f.outward.x * 0.18 * spread,
          CENTER_Y + f.position.y * drop + 0.03,
          f.position.z * spread + f.outward.z * 0.18 * spread,
        )
      }

      if (k >= 1 && !landed.current[i]) {
        landed.current[i] = true
        waterFx.trigger(f.position.x, f.position.z, t, 1.0)
      }
    }

    const stemK = skipIntro ? 1 : clamp((e - SPLIT_AT - 0.1) / 1.2, 0, 1)
    if (stemRef.current) {
      const fe = stemK * stemK
      stemRef.current.position.set(
        THREE.MathUtils.lerp(0, stemHome[0], fe),
        THREE.MathUtils.lerp(STEM_TOP, stemHome[1], fe),
        THREE.MathUtils.lerp(0, stemHome[2], fe),
      )
      stemRef.current.rotation.set(0, 0.55 * fe, -1.48 * fe)
      stemRef.current.scale.setScalar(compact ? 0.46 : 0.55)
      if (stemK >= 1) {
        const rest = e - (SPLIT_AT + 1.3)
        stemRef.current.position.y = stemHome[1] + Math.sin(rest * 1.3) * 0.008
        stemRef.current.rotation.z = -1.48 + Math.sin(rest * 0.9) * 0.022
      }
    }
    if (stemK >= 1 && !stemLanded.current) {
      stemLanded.current = true
      waterFx.trigger(0, 0, t, 1.1)
      if (!fired.current.ripple) {
        fired.current.ripple = true
        sound.splash()
      }
    }

    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = stemK >= 1 ? 0.22 + Math.sin(t * 1.1) * 0.08 : 0
      ringRef.current.rotation.z = t * 0.12
    }

    if (flashA.current) flashA.current.position.set(0, CENTER_Y, 0)
    if (flashB.current) flashB.current.position.set(0, CENTER_Y, 0)
  })

  const pixelRatio = Math.min(gl.getPixelRatio(), 2)

  return (
    <>
      <ambientLight intensity={1.25} color="#eaf6ff" />
      <directionalLight position={[4, 7, 5]} intensity={2.2} color="#fff8ee" />
      <directionalLight position={[-4, 3, 2]} intensity={0.7} color="#cfe6ff" />
      <pointLight position={[0, 2.6, 3.2]} intensity={1.2} distance={9} decay={2} color="#ffe5cc" />

      <SkyDome />
      <PoolFloor />
      <Water intensity={waterIntensity} />
      <Motes />
      {QUADRANTS.map((q, i) => (
        <object3D
          key={`anchor-${q}`}
          ref={(el) => {
            anchorRefs.current[i] = el
          }}
        />
      ))}
      <CameraRig camMixRef={camMixRef} orbitRef={orbitRef} entering={entering} />

      <group ref={rootRef} position={[0, CENTER_Y, 0]}>
        <mesh ref={wholeRef} geometry={wholeSkin} material={skinMaterial} visible={phase === 'idle'} />
        {quarters.map((q, i) => (
          <group
            key={QUADRANTS[i]}
            visible={phase !== 'idle'}
            ref={(el) => {
              wedgeRefs.current[i] = el
            }}
            onClick={(ev) => {
              ev.stopPropagation()
              clickWedge(i)
            }}
            onPointerOver={(ev) => {
              ev.stopPropagation()
              if (phaseRef.current === 'settled') document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              if (phaseRef.current === 'settled') document.body.style.cursor = 'grab'
            }}
          >
            <mesh
              geometry={q.skin}
              material={skinMaterial}
              ref={(el) => {
                skinMeshes.current[i] = el
              }}
            />
            <mesh
              geometry={q.capA}
              material={fleshMaterial}
              ref={(el) => {
                capAMeshes.current[i] = el
              }}
            />
            <mesh
              geometry={q.capB}
              material={fleshMaterial}
              ref={(el) => {
                capBMeshes.current[i] = el
              }}
            />
          </group>
        ))}
      </group>

      {finals.map((f, i) => (
        <mesh
          key={`shadow-${i}`}
          ref={(el) => {
            shadowRefs.current[i] = el
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[f.position.x, 0.016, f.position.z]}
        >
          <circleGeometry args={[0.56, 36]} />
          <meshBasicMaterial map={glowTex} color="#7fa5b4" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {finals.map((f, i) => (
        <mesh
          key={`reflection-${i}`}
          ref={(el) => {
            reflectionRefs.current[i] = el
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[f.position.x, 0.014, f.position.z]}
          renderOrder={1}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={glowTex} color="#c4634d" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      <group
        ref={stemRef}
        position={[0, STEM_TOP, 0]}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenStem()
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          if (phaseRef.current === 'settled') document.body.style.cursor = 'grab'
        }}
      >
        <StemModel />
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.44, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <object3D ref={stemAnchor} position={[0, 0.3, 0]} />
      </group>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[stemHome[0], 0.02, stemHome[2]]}>
        <ringGeometry args={[0.3, 0.32, 64]} />
        <meshBasicMaterial color={PALETTE.gold} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh ref={lineA} rotation={[0, 0, 0]} visible={false} renderOrder={20}>
        <boxGeometry args={[2.6, 0.014, 0.014]} />
        <meshBasicMaterial color="#ff6a4d" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={lineB} rotation={[0, Math.PI / 2, 0]} visible={false} renderOrder={20}>
        <boxGeometry args={[2.6, 0.014, 0.014]} />
        <meshBasicMaterial color="#ff6a4d" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>

      <sprite ref={flashA} position={[0, CENTER_Y, 0]} scale={0}>
        <spriteMaterial map={glowTex} color="#ffb4a0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={flashB} position={[0, CENTER_Y, 0]} scale={0}>
        <spriteMaterial map={glowTex} color="#ffb4a0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </sprite>

      {!skipIntro &&
        splashSpecs.map((spec) => (
          <Splash key={spec.id} spec={spec} pixelRatio={pixelRatio} timeRef={animTime} />
        ))}

      {!skipIntro && ringSpecs.map((spec, i) => <LandRing key={`ring-${i}`} spec={spec} timeRef={animTime} />)}

      <Bridge />
    </>
  )
}

function Bridge() {
  const { camera } = useThree()
  useEffect(() => {
    sceneBridge.camera = camera as THREE.PerspectiveCamera
  }, [camera])
  return null
}

export function TomatoScene(props: TomatoSceneProps) {
  return (
    <>
      <EnvironmentSetup />
      <SceneContent {...props} />
    </>
  )
}
