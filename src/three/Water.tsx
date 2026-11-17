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
  float h = fbm(p * 0.38 + vec2(t * 0.02, -t * 0.016)) * 0.6;
  h += fbm(p * 1.15 - vec2(t * 0.045, t * 0.03)) * 0.16;
  h += sin(p.x * 1.4 + t * 0.35) * 0.015 + sin(p.y * 1.9 - t * 0.29) * 0.012;
  for (int i = 0; i < 3; i++) {
    vec4 im = uImpact[i];
    float age = t - im.z;
    if (age > 0.0 && age < 9.0) {
      vec2 d = p - im.xy;
      float dist = length(d);
      float wave = sin(dist * 5.5 - age * 4.6) * exp(-dist * 0.72) * exp(-age * 0.8);
      h += wave * 0.075 * im.w;
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
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 R = reflect(-V, n);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 sky = mix(uHorizon, vec3(0.02, 0.055, 0.052), smoothstep(0.02, 0.5, up));

  vec3 sunDir = normalize(vec3(-0.45, 0.18, -1.0));
  float sundot = max(dot(R, sunDir), 0.0);
  float glow = pow(sundot, 5.0);
  float glint = pow(sundot, 180.0);

  vec3 col = mix(uDeep, uShallow, 0.22) * 0.9;
  col += sky * (0.18 + 0.6 * fres);
  col += uSun * (glow * 0.22 + glint * 1.15);

  float sparkle = pow(vnoise(p * 4.2 + vec2(t * 0.22, -t * 0.17)), 26.0);
  col += uSun * sparkle * 0.35;

  float dist = length(vWorld.xz - cameraPosition.xz);
  float fog = smoothstep(7.0, 26.0, dist);
  col = mix(col, uHorizon * 0.88 + uDeep * 0.1, fog * 0.92);

  gl_FragColor = vec4(col, 0.91);
}
`

export function Water({ intensity }: { intensity: number }) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uDeep: { value: new THREE.Color('#071714') },
      uShallow: { value: new THREE.Color('#1b4339') },
      uHorizon: { value: new THREE.Color('#1f2a21') },
      uSun: { value: new THREE.Color('#ffc998') },
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} frustumCulled={false}>
      <planeGeometry args={[110, 110, 1, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite
        toneMapped={false}
      />
    </mesh>
  )
}
