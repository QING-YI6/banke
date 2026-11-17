import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { waterFx } from './bridge'

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIntensity;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec4 uImpact[3];

varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + vec2(11.7, 7.3);
    amp *= 0.5;
  }
  return v;
}

float heightAt(vec2 p, float t) {
  float h = fbm(p * 0.42 + vec2(t * 0.03, -t * 0.02)) * 0.12;
  h += fbm(p * 1.6 - vec2(t * 0.06, t * 0.04)) * 0.03;
  h += sin(p.x * 1.7 + t * 0.5) * 0.005 + sin(p.y * 2.2 - t * 0.4) * 0.004;
  for (int i = 0; i < 3; i++) {
    vec4 im = uImpact[i];
    float age = t - im.z;
    if (age > 0.0 && age < 9.0) {
      vec2 d = p - im.xy;
      float dist = length(d);
      float wave = sin(dist * 5.5 - age * 4.6) * exp(-dist * 0.72) * exp(-age * 0.8);
      h += wave * 0.05 * im.w;
    }
  }
  return h;
}

void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  float e = 0.085;
  float h = heightAt(p, t);
  float hx = heightAt(p + vec2(e, 0.0), t);
  float hz = heightAt(p + vec2(0.0, e), t);
  vec3 n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
  n = normalize(mix(vec3(0.0, 1.0, 0.0), n, 0.3 + 0.7 * uIntensity));

  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.6);
  vec3 R = reflect(-V, n);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 sky = mix(uHorizon, vec3(0.48, 0.67, 0.8), smoothstep(0.02, 0.5, up));

  vec3 sunDir = normalize(vec3(-0.4, 0.72, -0.9));
  float sundot = max(dot(R, sunDir), 0.0);
  float glow = pow(sundot, 10.0);
  float glint = pow(sundot, 300.0);

  vec3 col = mix(uDeep, uShallow, 0.38 + 0.18 * h);
  col = mix(col, sky, 0.32 + 0.58 * fres);

  // 银中透亮：把蓝往银灰拉一点，但保留水色
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * vec3(0.96, 1.0, 1.06), 0.08);
  col += vec3(0.76, 0.86, 0.93) * pow(fres, 2.2) * 0.24;
  col += vec3(0.05, 0.09, 0.12) * (0.4 + 0.6 * fres);

  col += uSun * (glow * 0.14 + glint * 1.5);

  // 碎银：两层高频亮点，像阳光落在水面的碎片
  vec2 g1 = fract(p * 26.0 + vec2(t * 0.05, -t * 0.04)) - 0.5;
  float h1 = hash(floor(p * 26.0) + floor(t * 0.9));
  float sp1 = smoothstep(0.1, 0.0, length(g1)) * step(0.9, h1);
  vec2 g2 = fract(p * 61.0 - vec2(t * 0.07, t * 0.05)) - 0.5;
  float h2 = hash(floor(p * 61.0) - floor(t * 1.4));
  float sp2 = smoothstep(0.08, 0.0, length(g2)) * step(0.93, h2);
  float sparkle = (sp1 + sp2) * (0.35 + 0.65 * max(dot(R, sunDir), 0.0));
  col += vec3(1.0) * sparkle * 1.1 * uIntensity;

  // 细纹：银灰的暗部，让水面有流动感
  float ripple = smoothstep(0.52, 0.92, fbm(p * 4.6 + vec2(t * 0.16, -t * 0.12)));
  col -= vec3(0.05, 0.055, 0.055) * ripple * uIntensity;
  float fine = smoothstep(0.78, 0.98, fbm(p * 8.0 - vec2(t * 0.2, t * 0.15)));
  col += uSun * fine * 0.18 * uIntensity;

  float dist = length(vWorld.xz - cameraPosition.xz);
  float fog = smoothstep(7.0, 34.0, dist);
  col = mix(col, uHorizon, fog * 0.92);

  float alpha = 0.72 + 0.24 * fres;
  gl_FragColor = vec4(col, alpha);
}
`

export function Water({ intensity }: { intensity: number }) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uDeep: { value: new THREE.Color('#183b53') },
      uShallow: { value: new THREE.Color('#6c96ab') },
      uHorizon: { value: new THREE.Color('#d9e9f0') },
      uSun: { value: new THREE.Color('#ffffff') },
      uImpact: {
        value: [
          new THREE.Vector4(0, 0, -100, 0),
          new THREE.Vector4(0, 0, -100, 0),
          new THREE.Vector4(0, 0, -100, 0),
        ],
      },
    }),
    [],
  )

  useEffect(() => {
    uniforms.uIntensity.value = intensity
  }, [intensity, uniforms])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    const imp = uniforms.uImpact.value
    for (let i = 0; i < 3; i++) {
      const s = waterFx.impacts[i]
      imp[i].set(s.x, s.z, s.at, s.strength)
    }
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} frustumCulled={false} renderOrder={2}>
      <planeGeometry args={[4000, 4000, 1, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

const FLOOR_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const FLOOR_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
varying vec3 vWorld;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),
             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(7.1, 3.7);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vWorld.xz * 0.9;
  float t = uTime * 0.04;
  float n = fbm(p * 1.7 + vec2(t, -t));
  vec3 base = mix(vec3(0.07, 0.16, 0.22), vec3(0.21, 0.36, 0.45), smoothstep(-0.2, 0.7, n));
  float caustic = smoothstep(0.7, 0.99, fbm(p * 7.0 + n * 0.9 + vec2(t * 1.4, -t)));
  base += vec3(0.72, 0.84, 0.92) * caustic * 0.07;
  float d = length(p);
  base = mix(base, vec3(0.1, 0.21, 0.28), smoothstep(4.0, 13.0, d) * 0.3);
  gl_FragColor = vec4(base, 1.0);
}
`

/** 水下的浅色池底，让水面有透明和深度。 */
export function PoolFloor() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.1, 0]} frustumCulled={false} renderOrder={0}>
      <planeGeometry args={[4000, 4000, 1, 1]} />
      <shaderMaterial
        vertexShader={FLOOR_VERT}
        fragmentShader={FLOOR_FRAG}
        uniforms={uniforms}
        toneMapped={false}
      />
    </mesh>
  )
}
