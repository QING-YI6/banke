import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { QUADRANTS, type Quadrant } from '../core/types'
import { clamp } from '../core/time'
import { sound } from '../core/sound'
import { fleshTexture, glowTexture, skinTexture } from './textures'
import { makeCapGeometry, makeSkinGeometry } from './geometry'
import { PALETTE } from './palette'
import { sceneBridge, waterFx, type SplashSpec } from './bridge'
import { PoolFloor, Water } from './Water'
import { Splash } from './Splash'
import { StemModel } from './StemModel'

export type ScenePhase = 'idle' | 'cutting' | 'opening' | 'settled'

const CENTER_Y = 1.6
const STEM_TOP = 2.52

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

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

function easeOutBack(x: number): number {
  const c1 = 1.18
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function smoothstep(x: number): number {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

/** 白天的水面：接近白、带一点蓝，亮而透。 */
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
            vec3 top = vec3(0.6, 0.73, 0.81);
            vec3 mid = vec3(0.8, 0.88, 0.91);
            vec3 horizon = vec3(0.933, 0.957, 0.961);
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

function Motes({ count = 70 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 11
      pos[i * 3 + 1] = 0.4 + Math.random() * 3.2
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.y = t * 0.01
    ref.current.position.y = Math.sin(t * 0.2) * 0.05
  })

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#ffffff"
        size={0.02}
        transparent
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

interface WedgeTarget {
  p: THREE.Vector3
  rot: [number, number, number]
  scale: number
  gap: number
}

const FACE_YAW = [-0.78 + Math.PI, -0.79, -2.36, 0.79]

function CameraRig({
  camMixRef,
  entering,
}: {
  camMixRef: React.MutableRefObject<number>
  entering: Quadrant | null
}) {
  const { camera, size } = useThree()

  useFrame(({ clock }, dt) => {
    const mix = clamp(camMixRef.current, 0, 1)
    const portrait = size.width / size.height < 1.0
    const startR = portrait ? 6.4 : 5.5
    const endR = portrait ? 9.6 : 7.7
    let r = startR + (endR - startR) * mix
    if (entering) r = Math.max(3.2, r - dt * 9)

    const phiStart = 1.17
    const phiEnd = 0.23
    const phi = phiStart + (phiEnd - phiStart) * mix
    const targetY = 1.56
    const t = clock.elapsedTime
    const az = Math.sin(t * 0.09) * 0.018 * mix

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
  const wedgeRefs = useRef<(THREE.Group | null)[]>([])
  const anchorRefs = useRef<(THREE.Object3D | null)[]>([])
  const stemRef = useRef<THREE.Group>(null!)
  const stemAnchor = useRef<THREE.Object3D>(null)
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([])
  const reflectionRefs = useRef<(THREE.Mesh | null)[]>([])
  const ringRef = useRef<THREE.Mesh>(null)
  const lineA = useRef<THREE.Mesh>(null)
  const lineB = useRef<THREE.Mesh>(null)
  const flashA = useRef<THREE.Sprite>(null)
  const flashB = useRef<THREE.Sprite>(null)
  const openRef = useRef(skipIntro ? 1 : 0)
  const camMixRef = useRef(skipIntro ? 1 : 0)
  const animTime = useRef(0)
  const [phase, setPhase] = useState<ScenePhase>(skipIntro ? 'settled' : 'idle')
  const phaseRef = useRef(phase)
  const [hovered, setHovered] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)
  const selectedRef = useRef(selected)
  const fired = useRef({ rippleCut: false, rippleBurst: false, stemLand: false })

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

  const quarters = useMemo(() => {
    // 切之前必须是一颗完整的番茄，所以接缝为 0。
    const gap = 0
    return QUADRANTS.map((_, i) => {
      const a0 = Math.PI / 4 + (i * Math.PI) / 2 + gap
      const a1 = Math.PI / 4 + ((i + 1) * Math.PI) / 2 - gap
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
      skinMaterial.dispose()
      fleshMaterial.dispose()
    }
  }, [quarters, skinMaterial, fleshMaterial])

  const compact = size.width / size.height < 1.02
  const layout = useMemo<WedgeTarget[]>(() => {
    return QUADRANTS.map((_, i) => {
      let d = i - selected
      if (d >= 2) d -= 4
      if (d < -2) d += 4
      const ad = Math.abs(d)
      const x =
        d === 0 ? 0 : ad === 2 ? 0 : Math.sign(d) * (compact ? 0.68 : 1.04)
      const y = d === 0 ? 0.16 : ad === 2 ? (compact ? 0.38 : 0.62) : -0.02
      const z = d === 0 ? 0.9 : ad === 2 ? (compact ? -1.25 : -1.0) : -0.12
      const scale =
        d === 0 ? (compact ? 0.66 : 0.82) : ad === 2 ? (compact ? 0.38 : 0.58) : compact ? 0.5 : 0.64
      const yaw =
        d === 0 ? FACE_YAW[i] : ad === 2 ? FACE_YAW[i] + Math.PI : FACE_YAW[i] - Math.sign(d) * 0.65
      return {
        p: new THREE.Vector3(x, y, z),
        rot: [-0.05, yaw, d === 0 ? 0.02 : Math.sign(d) * 0.04],
        scale,
        gap: d,
      }
    })
  }, [selected, compact])

  const stemHome = useMemo<[number, number, number]>(
    () => [0, 0.05, compact ? 0.2 : 0.25],
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
      openRef.current = 1
      camMixRef.current = 1
      if (phaseRef.current !== 'settled') {
        phaseRef.current = 'settled'
        setPhase('settled')
      }
    }
  }, [skipIntro])

  useEffect(() => {
    if (phase === 'cutting') sound.cut()
    if (phase === 'opening') sound.splash()
  }, [phase])

  useEffect(() => {
    document.body.style.cursor = hovered !== null ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  // 左右拖动切换选中的一瓣。
  useEffect(() => {
    const el = gl.domElement
    const drag = { down: false, lastX: 0, acc: 0 }
    const down = (e: PointerEvent) => {
      drag.down = true
      drag.lastX = e.clientX
      drag.acc = 0
      sceneBridge.dragDistance = 0
    }
    const move = (e: PointerEvent) => {
      if (!drag.down) return
      const dx = e.clientX - drag.lastX
      drag.lastX = e.clientX
      drag.acc += dx
      sceneBridge.dragDistance += Math.abs(dx)
      if (phaseRef.current === 'settled' && Math.abs(drag.acc) > 58) {
        const dir = drag.acc < 0 ? 1 : -1
        const next = (selectedRef.current + dir + 4) % 4
        onSelected(next)
        drag.acc = 0
      }
    }
    const up = () => {
      drag.down = false
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
  }, [gl, onSelected])

  const splashSpecs = useMemo<SplashSpec[]>(
    () => [
      { id: 'mist', at: 2.8, origin: [0, CENTER_Y - 0.05, 0.35], count: 56, power: 1.0, color: '#ffae9c', size: 0.8 },
      { id: 'water', at: 3.2, origin: [0, 0.03, 0.55], count: 90, power: 1.8, color: '#8ecde6', size: 1.0 },
      { id: 'stem', at: 3.88, origin: [stemHome[0], 0.03, stemHome[2]], count: 70, power: 1.5, color: '#8ecde6', size: 0.95 },
    ],
    [stemHome],
  )

  const clickWedge = (i: number) => {
    if (sceneBridge.dragDistance > 10) return
    if (phaseRef.current !== 'settled') return
    if (i === selectedRef.current) onSelect(QUADRANTS[i])
    else onSelected(i)
  }

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    animTime.current += Math.min(dt, 0.05)
    const e = animTime.current

    if (!skipIntro) {
      if (phaseRef.current === 'idle' && e > 2.0) {
        phaseRef.current = 'cutting'
        setPhase('cutting')
      } else if (phaseRef.current === 'cutting' && e > 2.46) {
        phaseRef.current = 'opening'
        setPhase('opening')
      }
      const rawOpen = clamp((e - 2.46) / 1.42, 0, 1)
      openRef.current = rawOpen
      camMixRef.current = smoothstep((e - 2.0) / 1.9)

      const cutA = clamp((e - 2.0) / 0.4, 0, 1)
      const cutB = clamp((e - 2.38) / 0.4, 0, 1)
      if (lineA.current) {
        lineA.current.visible = cutA > 0 && cutA < 1
        lineA.current.position.y = 3.02 - easeOutCubic(cutA) * 2.55
        ;(lineA.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(cutA * Math.PI) * 0.9
      }
      if (lineB.current) {
        lineB.current.visible = cutB > 0 && cutB < 1
        lineB.current.position.y = 3.02 - easeOutCubic(cutB) * 2.55
        ;(lineB.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(cutB * Math.PI) * 0.9
      }
      const flash = (sprite: THREE.Sprite | null, at: number) => {
        if (!sprite) return
        const p = clamp((e - at) / 0.34, 0, 1)
        const s = 0.5 + p * 2.2
        sprite.scale.set(s, s, s)
        ;(sprite.material as THREE.SpriteMaterial).opacity = p > 0 && p < 1 ? (1 - p) * 0.45 : 0
      }
      flash(flashA.current, 2.32)
      flash(flashB.current, 2.7)

      if (e > 2.72 && !fired.current.rippleCut) {
        fired.current.rippleCut = true
        waterFx.trigger(0, 0.55, t, 0.7)
      }
      if (e > 3.2 && !fired.current.rippleBurst) {
        fired.current.rippleBurst = true
        waterFx.trigger(0.1, 0.5, t, 1.15)
      }
      if (openRef.current > 0.995 && e > 3.9 && phaseRef.current !== 'settled') {
        phaseRef.current = 'settled'
        setPhase('settled')
      }
    } else {
      openRef.current = 1
      camMixRef.current = 1
    }

    const raw = clamp(openRef.current, 0, 1)
    const motion = 0.78 * raw + 0.22 * easeOutBack(raw)
    const idle = 1 - raw
    const damp = 1 - Math.exp(-Math.min(dt, 0.05) * 7)

    if (rootRef.current) {
      rootRef.current.position.y = CENTER_Y + Math.sin(t * 1.0) * 0.022 * idle
      rootRef.current.rotation.y = Math.sin(t * 0.42) * 0.06 * idle
      rootRef.current.rotation.x = Math.sin(t * 0.7) * 0.015 * idle
    }

    for (let i = 0; i < 4; i++) {
      const g = wedgeRefs.current[i]
      if (!g) continue
      const item = layout[i]
      const isHover = hoverRef.current === i
      const bob = Math.sin(t * 0.8 + i * 1.7) * 0.03 * raw
      const desired = new THREE.Vector3(item.p.x * motion, item.p.y * motion + bob, item.p.z * motion)
      if (raw >= 0.999) g.position.lerp(desired, damp)
      else g.position.copy(desired)

      const targetRot = new THREE.Euler(
        item.rot[0] * motion + Math.sin(t * 0.6 + i) * 0.01 * raw,
        item.rot[1] * motion + Math.sin(raw * Math.PI) * (i % 2 === 0 ? 0.45 : -0.45),
        item.rot[2] * motion + Math.sin(t * 0.7 + i * 0.9) * 0.018 * raw,
      )
      if (raw >= 0.999) {
        g.rotation.x += (targetRot.x - g.rotation.x) * damp
        g.rotation.y += (targetRot.y - g.rotation.y) * damp
        g.rotation.z += (targetRot.z - g.rotation.z) * damp
      } else {
        g.rotation.copy(targetRot)
      }

      const targetScale = (1 + (item.scale - 1) * clamp(raw, 0, 1)) * (isHover ? 1.045 : 1)
      const current = g.scale.x
      const s = raw >= 0.999 ? current + (targetScale - current) * damp : targetScale
      g.scale.setScalar(s)

      const shadow = shadowRefs.current[i]
      if (shadow) {
        shadow.position.set(item.p.x * motion, 0.016, item.p.z * motion)
        const ss = 0.6 + 0.4 * raw
        shadow.scale.set(ss, ss, ss)
        ;(shadow.material as THREE.MeshBasicMaterial).opacity = 0.11 * raw
      }

      const reflection = reflectionRefs.current[i]
      if (reflection) {
        const rs = item.scale / 0.7
        reflection.position.set(item.p.x * motion, 0.014, item.p.z * motion + 0.16)
        reflection.scale.set(1.25 * rs, 2.3 * rs, 1)
        ;(reflection.material as THREE.MeshBasicMaterial).opacity =
          (i === selected ? 0.3 : 0.14) * raw
      }
    }

    const fr = skipIntro ? 1 : clamp((e - 2.72) / 1.1, 0, 1)
    if (stemRef.current) {
      const ease = fr * fr
      stemRef.current.position.set(
        THREE.MathUtils.lerp(0, stemHome[0], ease),
        THREE.MathUtils.lerp(STEM_TOP, stemHome[1], ease),
        THREE.MathUtils.lerp(0, stemHome[2], ease),
      )
      stemRef.current.rotation.set(-1.6 * ease, 0.32 * ease, 0.26 * ease)
      stemRef.current.scale.setScalar(compact ? 0.52 : 0.58)
      if (fr >= 1) {
        const rest = e - 3.82
        stemRef.current.position.y = stemHome[1] + Math.sin(rest * 1.3) * 0.01
        stemRef.current.rotation.z = 0.3 + Math.sin(rest * 0.9) * 0.03
      }
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = skipIntro || fr >= 1 ? 0.3 + Math.sin(t * 1.2) * 0.1 : 0
      ringRef.current.rotation.z = t * 0.16
    }

    if (fr >= 1 && !fired.current.stemLand) {
      fired.current.stemLand = true
      waterFx.trigger(stemHome[0], stemHome[2], t, 1.2)
      sound.splash()
    }

    if (flashA.current) flashA.current.position.set(0, CENTER_Y + 0.1, 0.3)
    if (flashB.current) flashB.current.position.set(0, CENTER_Y + 0.1, 0.3)
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
      <CameraRig camMixRef={camMixRef} entering={entering} />

      <group ref={rootRef} position={[0, CENTER_Y, 0]}>
        {quarters.map((q, i) => (
          <group
            key={QUADRANTS[i]}
            ref={(el) => {
              wedgeRefs.current[i] = el
            }}
            onClick={(ev) => {
              ev.stopPropagation()
              clickWedge(i)
            }}
            onPointerOver={(ev) => {
              ev.stopPropagation()
              hoverRef.current = i
              setHovered(i)
            }}
            onPointerOut={() => {
              hoverRef.current = null
              setHovered(null)
            }}
          >
            <mesh geometry={q.skin} material={skinMaterial} />
            <mesh geometry={q.capA} material={fleshMaterial} />
            <mesh geometry={q.capB} material={fleshMaterial} />
            <object3D
              position={[0, 0.86, 0]}
              ref={(el) => {
                anchorRefs.current[i] = el
              }}
            />
          </group>
        ))}
      </group>

      {layout.map((item, i) => (
        <mesh
          key={`shadow-${i}`}
          ref={(el) => {
            shadowRefs.current[i] = el
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[item.p.x, 0.016, item.p.z]}
        >
          <circleGeometry args={[0.68, 36]} />
          <meshBasicMaterial map={glowTex} color="#7fa5b4" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.2]}>
        <circleGeometry args={[1.55, 48]} />
        <meshBasicMaterial map={glowTex} color="#7fa5b4" transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {layout.map((item, i) => (
        <mesh
          key={`reflection-${i}`}
          ref={(el) => {
            reflectionRefs.current[i] = el
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[item.p.x, 0.014, item.p.z + 0.16]}
          renderOrder={1}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={glowTex} color="#b04a38" transparent opacity={0} depthWrite={false} />
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
          document.body.style.cursor = ''
        }}
      >
        <StemModel />
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.44, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <object3D ref={stemAnchor} position={[0, 0.24, 0]} />
      </group>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[stemHome[0], 0.018, stemHome[2]]}>
        <ringGeometry args={[0.3, 0.32, 64]} />
        <meshBasicMaterial
          color={PALETTE.gold}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={lineA} rotation={[0, -Math.PI / 4, 0]} visible={false} renderOrder={20}>
        <boxGeometry args={[2.6, 0.014, 0.014]} />
        <meshBasicMaterial color="#ff6a4d" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={lineB} rotation={[0, Math.PI / 4, 0]} visible={false} renderOrder={20}>
        <boxGeometry args={[2.6, 0.014, 0.014]} />
        <meshBasicMaterial color="#ff6a4d" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>

      <sprite ref={flashA} position={[0, CENTER_Y + 0.1, 0.3]} scale={0}>
        <spriteMaterial map={glowTex} color="#ffb4a0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={flashB} position={[0, CENTER_Y + 0.1, 0.3]} scale={0}>
        <spriteMaterial map={glowTex} color="#ffb4a0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </sprite>

      {!skipIntro &&
        splashSpecs.map((spec) => (
          <Splash key={spec.id} spec={spec} pixelRatio={pixelRatio} timeRef={animTime} />
        ))}

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
