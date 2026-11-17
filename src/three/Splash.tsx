import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SplashSpec } from './bridge'

const VERT = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
attribute vec3 aVel;
attribute float aSeed;
varying float vFade;

void main() {
  float t = max(uTime, 0.0);
  vec3 p = position + aVel * t + vec3(0.0, -3.1 * t * t, 0.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = (0.5 + aSeed * 1.4) * uSize;
  gl_PointSize = size * uPixelRatio * (26.0 / max(0.6, -mv.z));
  vFade = smoothstep(1.9, 0.15, t) * smoothstep(-0.35, 0.12, p.y);
}
`

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.06, length(d));
  gl_FragColor = vec4(uColor, a * vFade * uOpacity);
}
`

function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function Splash({
  spec,
  pixelRatio,
  timeRef,
}: {
  spec: SplashSpec
  pixelRatio: number
  timeRef: MutableRefObject<number>
}) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const points = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    const count = spec.count
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const r = rand(i + spec.at * 13.7)
      const a = rand(i * 3.1 + 2.7) * Math.PI * 2
      const spread = 0.35 + rand(i * 7.3 + 1.4) * 1.15
      const power = spec.power
      velocities[i * 3] = Math.cos(a) * spread * power
      velocities[i * 3 + 1] = (0.9 + r * 1.9) * power
      velocities[i * 3 + 2] = Math.sin(a) * spread * power
      seeds[i] = rand(i * 11.3 + 5.1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aVel', new THREE.BufferAttribute(velocities, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return g
  }, [spec])

  const uniforms = useMemo(
    () => ({
      uTime: { value: -1 },
      uSize: { value: spec.size },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: new THREE.Color(spec.color) },
      uOpacity: { value: 0.85 },
    }),
    [spec, pixelRatio],
  )

  useFrame(() => {
    const t = timeRef.current - spec.at
    uniforms.uTime.value = t
    if (points.current) points.current.visible = t > 0 && t < 2.1
  })

  return (
    <points ref={points} position={spec.origin} geometry={geometry} frustumCulled={false} visible={false}>
      <shaderMaterial
        ref={material}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  )
}
