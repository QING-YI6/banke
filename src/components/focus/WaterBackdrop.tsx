import { useEffect, useRef } from 'react'

/** 专注页的背景：一层很轻的水光，不抢计时器。用 WebGL，失败就退回 CSS 渐变。 */
export function WaterBackdrop({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const intensityRef = useRef(intensity)

  useEffect(() => {
    intensityRef.current = intensity
  }, [intensity])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return

    const vert = `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `
    const frag = `
      precision mediump float;
      uniform vec2 uRes;
      uniform float uTime;
      uniform float uIntensity;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.07 + vec2(9.3, 4.1);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uRes;
        float aspect = uRes.x / uRes.y;
        vec2 p = vec2(uv.x * aspect, uv.y);
        float t = uTime * 0.05;
        float n = fbm(p * 2.6 + vec2(t * 0.7, -t * 0.5));
        float n2 = fbm(p * 5.2 - vec2(t * 1.1, t * 0.6) + n * 0.8);

        vec3 deep = vec3(0.63, 0.74, 0.8);
        vec3 shallow = vec3(0.87, 0.93, 0.96);
        float depth = smoothstep(0.0, 1.0, uv.y * 0.85 + n * 0.4);
        vec3 col = mix(deep, shallow, depth);

        float caustic = smoothstep(0.62, 0.94, n2 + sin(p.x * 6.0 + t * 3.0) * 0.06);
        col += vec3(0.94, 0.99, 1.0) * caustic * (0.1 * uIntensity);

        float caustic2 = smoothstep(0.72, 1.0, n2 * 0.7 + n * 0.55);
        col += vec3(0.86, 0.95, 1.0) * caustic2 * (0.05 * uIntensity);

        float ripple = smoothstep(0.6, 0.95, fbm(p * 9.0 + vec2(t * 1.2, -t * 0.8)));
        col -= vec3(0.04, 0.05, 0.055) * ripple * 0.3 * uIntensity;

        vec2 gg = fract(p * 70.0 + vec2(t * 0.08, -t * 0.06)) - 0.5;
        float hs = hash(floor(p * 70.0) + floor(t * 1.1));
        float spark = smoothstep(0.07, 0.0, length(gg)) * step(0.955, hs);
        col += vec3(1.0) * spark * 0.32 * uIntensity;

        float shaft = smoothstep(0.16, 0.0, abs(uv.x - (0.34 + uv.y * 0.12 + sin(t * 0.4) * 0.015)));
        col += vec3(0.95, 0.98, 1.0) * shaft * smoothstep(0.05, 0.9, uv.y) * 0.06 * uIntensity;

        col += vec3(0.9, 0.95, 0.98) * smoothstep(0.55, 1.1, uv.y) * 0.12;

        float d = distance(uv, vec2(0.5, 0.44));
        col *= 0.8 + 0.2 * smoothstep(0.95, 0.2, d);
        col += (hash(gl_FragCoord.xy) - 0.5) * 0.006;

        gl_FragColor = vec4(col, 1.0);
      }
    `

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh)
        return null
      }
      return sh
    }

    const vs = compile(gl.VERTEX_SHADER, vert)
    const fs = compile(gl.FRAGMENT_SHADER, frag)
    if (!vs || !fs) return
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(program, 'uRes')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uIntensity = gl.getUniformLocation(program, 'uIntensity')

    let raf = 0
    const start = performance.now()
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const cw = Math.floor(window.innerWidth * dpr)
      const ch = Math.floor(window.innerHeight * dpr)
      if (cw !== w || ch !== h) {
        w = cw
        h = ch
        canvas.width = cw
        canvas.height = ch
        gl.viewport(0, 0, w, h)
      }
    }

    const render = (now: number) => {
      if (!document.hidden) {
        resize()
        gl.uniform2f(uRes, w, h)
        gl.uniform1f(uTime, (now - start) / 1000)
        gl.uniform1f(uIntensity, intensityRef.current)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return <canvas ref={ref} className="water-backdrop" aria-hidden="true" />
}
