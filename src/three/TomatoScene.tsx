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
import { Water } from './Water'
import { Splash } from './Splash'
import { StemModel } from './StemModel'

export type ScenePhase = 'idle' | 'cutting' | 'opening' | 'settled'

const CENTER_Y = 1.6

interface TomatoSceneProps {
  skipIntro: boolean
  entering: Quadrant | null
  waterIntensity: number
  onSelect: (q: Quadrant) => void
  onOpenStem: () => void
  onPhase: (phase: ScenePhase) => void
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

/** 稍微冲过头再落回，像真实的刀口弹开。 */
function easeOutBack(x: number): number {
  const c1 = 1.18
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

function SkyDome() {
  const uniforms = useMemo(() => ({}), [])
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[80, 32, 24]} />
      <shaderMaterial
        uniforms={uniforms}
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
            vec3 top = vec3(0.003, 0.01, 0.009);
            vec3 mid = vec3(0.012, 0.032, 0.029);
            vec3 horizon = vec3(0.055, 0.075, 0.062);
            vec3 col = mix(horizon, mid, smoothstep(-0.008, 0.075, h));
            col = mix(col, top, smoothstep(0.055, 0.42, h));
            float haze = exp(-abs(h - 0.004) * 60.0);
            col += vec3(0.18, 0.092, 0.032) * haze * 0.38;
            vec3 sunDir = normalize(vec3(-0.45, 0.06, -1.0));
            float glow = pow(max(dot(d, sunDir), 0.0), 9.0);
            col += vec3(0.32, 0.17, 0.075) * glow * 0.42;
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
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function Motes({ count = 90 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 11
      pos[i * 3 + 1] = 0.2 + Math.random() * 3.4
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [count])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.y = t * 0.012
    ref.current.position.y = Math.sin(t * 0.22) * 0.06
  })

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#f0c48d"
        size={0.024}
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

interface LayoutItem {
  p: THREE.Vector3
  rot: [number, number, number]
  scale: number
}

function CameraRig({ openRef, entering }: { openRef: React.MutableRefObject<number>; entering: Quadrant | null }) {
  const { camera, gl, size } = useThree()
  const orbit = useRef({ az: 0, el: 0.17, targetAz: 0, targetEl: 0.17, dragging: false, px: 0, py: 0 })

  useEffect(() => {
    const el = gl.domElement
    const down = (e: PointerEvent) => {
      orbit.current.dragging = true
      orbit.current.px = e.clientX
      orbit.current.py = e.clientY
      sceneBridge.dragDistance = 0
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    const move = (e: PointerEvent) => {
      const o = orbit.current
      if (!o.dragging) return
      const dx = e.clientX - o.px
      const dy = e.clientY - o.py
      o.px = e.clientX
      o.py = e.clientY
      sceneBridge.dragDistance += Math.abs(dx) + Math.abs(dy)
      o.targetAz = clamp(o.targetAz - dx * 0.0032, -0.9, 0.9)
      o.targetEl = clamp(o.targetEl + dy * 0.002, 0.05, 0.34)
    }
    const up = (e: PointerEvent) => {
      orbit.current.dragging = false
      try {
        el.releasePointerCapture(e.pointerId)
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

  useFrame(({ clock }, dt) => {
    const o = orbit.current
    const k = Math.min(1, dt * 5)
    o.az += (o.targetAz - o.az) * k
    o.el += (o.targetEl - o.el) * k

    const portrait = size.width / size.height < 1.0
    const base = portrait ? 9.8 : 7.5
    const start = portrait ? 8.8 : 6.8
    let r = start + (base - start) * clamp(openRef.current, 0, 1)
    if (entering) r = Math.max(3.4, r - dt * 9)

    const t = clock.elapsedTime
    const az = o.az + Math.sin(t * 0.1) * 0.022
    const cx = Math.sin(az) * Math.cos(o.el) * r
    const cz = Math.cos(az) * Math.cos(o.el) * r
    const cy = CENTER_Y + Math.sin(o.el) * r
    camera.position.set(cx, cy, cz)
    camera.lookAt(0, CENTER_Y - 0.05, 0)
  })

  return null
}

function SceneContent({ skipIntro, entering, waterIntensity, onSelect, onOpenStem, onPhase }: TomatoSceneProps) {
  const { size, gl } = useThree()
  const rootRef = useRef<THREE.Group>(null!)
  const wedgeRefs = useRef<(THREE.Group | null)[]>([])
  const anchorRefs = useRef<(THREE.Object3D | null)[]>([])
  const stemRef = useRef<THREE.Group>(null!)
  const stemAnchor = useRef<THREE.Object3D>(null)
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([])
  const ringRef = useRef<THREE.Mesh>(null)
  const lineA = useRef<THREE.Mesh>(null)
  const lineB = useRef<THREE.Mesh>(null)
  const flashA = useRef<THREE.Sprite>(null)
  const flashB = useRef<THREE.Sprite>(null)
  const openRef = useRef(skipIntro ? 1 : 0)
  const animTime = useRef(0)
  const [phase, setPhase] = useState<ScenePhase>(skipIntro ? 'settled' : 'idle')
  const phaseRef = useRef(phase)
  const [hovered, setHovered] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)
  const fired = useRef({ rippleCut: false, rippleBurst: false, stemLand: false, settled: false })

  const skinTex = useMemo(() => skinTexture(), [])
  const fleshTex = useMemo(() => fleshTexture(), [])
  const glowTex = useMemo(() => glowTexture(), [])

  const skinMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: skinTex,
        color: new THREE.Color('#ff9c81'),
        roughness: 0.54,
        metalness: 0,
        clearcoat: 0.14,
        clearcoatRoughness: 0.6,
        sheen: 0.16,
        sheenColor: new THREE.Color('#ff9d7f'),
        envMapIntensity: 0.25,
      }),
    [skinTex],
  )

  const fleshMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: fleshTex,
        color: new THREE.Color('#ffc3ad'),
        roughness: 0.68,
        metalness: 0,
        clearcoat: 0.02,
        clearcoatRoughness: 0.8,
        sheen: 0.2,
        sheenColor: new THREE.Color('#ffd8c0'),
        envMapIntensity: 0.18,
        side: THREE.DoubleSide,
      }),
    [fleshTex],
  )

  const quarters = useMemo(() => {
    const gap = 0.009
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
  const layout = useMemo<LayoutItem[]>(() => {
    const sx = compact ? 0.7 : 1
    const sy = compact ? 0.96 : 1
    const sz = compact ? 0.55 : 1
    const base: LayoutItem[] = [
      { p: new THREE.Vector3(-1.15 * sx, 0.72 * sy, 0.42 * sz), rot: [-0.2, -0.78, 0.16], scale: 0.58 },
      { p: new THREE.Vector3(1.12 * sx, 0.62 * sy, 0.36 * sz), rot: [-0.05, -0.79, -0.2], scale: 0.58 },
      { p: new THREE.Vector3(-1.2 * sx, -0.58 * sy, 0.55 * sz), rot: [-0.22, -2.36, 0.2], scale: 0.58 },
      { p: new THREE.Vector3(1.16 * sx, -0.66 * sy, 0.48 * sz), rot: [-0.1, 0.79, -0.18], scale: 0.58 },
    ]
    if (compact) base.forEach((b) => (b.scale = 0.5))
    return base
  }, [compact])

  const stemHome = useMemo<[number, number, number]>(
    () => (compact ? [-1.12, 0.05, 0.9] : [-1.85, 0.06, 1.16]),
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

  const splashSpecs = useMemo<SplashSpec[]>(
    () => [
      { id: 'mist', at: 2.8, origin: [0, CENTER_Y - 0.05, 0.35], count: 64, power: 1.05, color: '#ffb193', size: 0.85 },
      { id: 'water', at: 3.2, origin: [0, 0.03, 0.55], count: 120, power: 2.2, color: '#d9efe2', size: 1.15 },
      { id: 'stem', at: 3.88, origin: [stemHome[0], 0.03, stemHome[2]], count: 90, power: 1.7, color: '#d9efe2', size: 1.0 },
    ],
    [stemHome],
  )

  const select = (q: Quadrant) => {
    if (sceneBridge.dragDistance > 9) return
    onSelect(q)
  }

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    // 用被钳制过的帧间隔推进叙事时间，避免首帧着色器编译造成的长停顿把动画直接跳过。
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

      const cutA = clamp((e - 2.0) / 0.4, 0, 1)
      const cutB = clamp((e - 2.38) / 0.4, 0, 1)
      if (lineA.current) {
        lineA.current.visible = cutA > 0 && cutA < 1
        lineA.current.position.y = 3.02 - easeOutCubic(cutA) * 2.55
        ;(lineA.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(cutA * Math.PI) * 0.95
      }
      if (lineB.current) {
        lineB.current.visible = cutB > 0 && cutB < 1
        lineB.current.position.y = 3.02 - easeOutCubic(cutB) * 2.55
        ;(lineB.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(cutB * Math.PI) * 0.95
      }
      const flash = (sprite: THREE.Sprite | null, at: number) => {
        if (!sprite) return
        const p = clamp((e - at) / 0.34, 0, 1)
        const s = 0.6 + p * 2.6
        sprite.scale.set(s, s, s)
        ;(sprite.material as THREE.SpriteMaterial).opacity = p > 0 && p < 1 ? (1 - p) * 0.8 : 0
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
    }

    const raw = clamp(openRef.current, 0, 1)
    const motion = 0.78 * raw + 0.22 * easeOutBack(raw)
    const idle = 1 - raw

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
      const bob = Math.sin(t * 0.82 + i * 1.7) * 0.035 * raw
      g.position.set(item.p.x * motion, item.p.y * motion + bob, item.p.z * motion)
      g.rotation.set(
        item.rot[0] * motion + Math.sin(t * 0.6 + i) * 0.012 * raw,
        item.rot[1] * motion + Math.sin(raw * Math.PI) * (i % 2 === 0 ? 0.55 : -0.55),
        item.rot[2] * motion + Math.sin(t * 0.72 + i * 0.9) * 0.02 * raw,
      )
      const s = (1 + (item.scale - 1) * clamp(raw, 0, 1)) * (isHover ? 1.05 : 1)
      g.scale.setScalar(s)

      const shadow = shadowRefs.current[i]
      if (shadow) {
        shadow.position.set(item.p.x * motion, 0.016, item.p.z * motion)
        const ss = 0.75 + 0.55 * raw
        shadow.scale.set(ss, ss, ss)
        ;(shadow.material as THREE.MeshBasicMaterial).opacity = 0.34 * raw
      }
    }

    const fr = skipIntro ? 1 : clamp((e - 2.72) / 1.1, 0, 1)
    if (stemRef.current) {
      const ease = fr * fr
      stemRef.current.position.set(
        THREE.MathUtils.lerp(0, stemHome[0], ease),
        THREE.MathUtils.lerp(2.48, stemHome[1], ease),
        THREE.MathUtils.lerp(0, stemHome[2], ease),
      )
      stemRef.current.rotation.set(-1.22 * ease, 0.9 * ease, 0.42 * ease)
      stemRef.current.scale.setScalar(compact ? 0.82 : 1)
      if (fr >= 1) {
        const rest = e - 3.82
        stemRef.current.position.y = stemHome[1] + Math.sin(rest * 1.3) * 0.012
        stemRef.current.rotation.z = 0.42 + Math.sin(rest * 0.9) * 0.04
      }
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = skipIntro || fr >= 1 ? 0.28 + Math.sin(t * 1.2) * 0.12 : 0
      ringRef.current.rotation.z = t * 0.18
    }

    if (fr >= 1 && !fired.current.stemLand) {
      fired.current.stemLand = true
      waterFx.trigger(stemHome[0], stemHome[2], t, 1.4)
      sound.splash()
    }

    if (flashA.current) flashA.current.position.set(0, CENTER_Y + 0.1, 0.3)
    if (flashB.current) flashB.current.position.set(0, CENTER_Y + 0.1, 0.3)

    // 轻微的悬浮感
    if (rootRef.current && raw > 0.98) {
      rootRef.current.rotation.y += dt * 0.01
    }
  })

  const pixelRatio = Math.min(gl.getPixelRatio(), 2)

  return (
    <>
      <ambientLight intensity={0.32} color="#7fa294" />
      <directionalLight position={[3.6, 6.2, 4]} intensity={1.05} color="#ffead2" />
      <directionalLight position={[-4, 3.2, -2]} intensity={0.55} color="#4f8f81" />
      <pointLight position={[0, 2.7, 2.6]} intensity={2.2} distance={8} decay={2} color="#ffd0aa" />
      <pointLight position={[-2.2, 1.2, 2]} intensity={1.1} distance={6} decay={2} color="#ffcf9e" />

      <SkyDome />
      <Water intensity={waterIntensity} />
      <Motes />
      <CameraRig openRef={openRef} entering={entering} />

      <group ref={rootRef} position={[0, CENTER_Y, 0]}>
        {quarters.map((q, i) => (
          <group
            key={QUADRANTS[i]}
            ref={(el) => {
              wedgeRefs.current[i] = el
            }}
            onClick={(ev) => {
              ev.stopPropagation()
              select(QUADRANTS[i])
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
          <circleGeometry args={[0.72, 36]} />
          <meshBasicMaterial map={glowTex} color="#020a08" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.35]}>
        <circleGeometry args={[1.65, 48]} />
        <meshBasicMaterial map={glowTex} color="#2b0d07" transparent opacity={0.42} depthWrite={false} />
      </mesh>

      <group
        ref={stemRef}
        position={[0, 2.48, 0]}
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
        <mesh position={[0, 0.14, 0]}>
          <sphereGeometry args={[0.42, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <object3D ref={stemAnchor} position={[0, 0.2, 0]} />
      </group>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[stemHome[0], 0.018, stemHome[2]]}>
        <ringGeometry args={[0.34, 0.36, 64]} />
        <meshBasicMaterial
          color={PALETTE.gold}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={lineA} rotation={[0, -Math.PI / 4, 0]} visible={false} renderOrder={20}>
        <boxGeometry args={[2.6, 0.012, 0.012]} />
        <meshBasicMaterial color="#fff2d8" transparent opacity={0} blending={THREE.AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={lineB} rotation={[0, Math.PI / 4, 0]} visible={false} renderOrder={20}>
        <boxGeometry args={[2.6, 0.012, 0.012]} />
        <meshBasicMaterial color="#fff2d8" transparent opacity={0} blending={THREE.AdditiveBlending} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>

      <sprite ref={flashA} position={[0, CENTER_Y + 0.1, 0.3]} scale={0}>
        <spriteMaterial map={glowTex} color="#ffe3b8" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={flashB} position={[0, CENTER_Y + 0.1, 0.3]} scale={0}>
        <spriteMaterial map={glowTex} color="#ffe3b8" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
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
