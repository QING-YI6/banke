import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { QUADRANT_INFO, QUADRANTS, type ActiveSession, type Quadrant } from '../core/types'
import { useBanke } from '../core/store'
import { elapsedMs, remainingSec, formatClock } from '../core/time'
import { sceneBridge } from '../three/bridge'
import { TomatoScene, type ScenePhase } from '../three/TomatoScene'

interface StageProps {
  initialSettled: boolean
  active: ActiveSession | null
  onEnter: (q: Quadrant) => void
  onOpenStem: () => void
  onSettled: () => void
  onResume: () => void
}

function ResumeChip({ active, onClick }: { active: ActiveSession; onClick: () => void }) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const sec =
    active.display === 'countdown' && active.targetSec !== null
      ? (remainingSec(active) ?? 0)
      : elapsedMs(active) / 1000
  return (
    <button className="resume-chip" onClick={onClick}>
      <span className="resume-chip__dot" />
      <span>{active.isBreak ? '休息' : QUADRANT_INFO[active.quadrant].name}</span>
      <strong>{formatClock(sec)}</strong>
      <span className="resume-chip__go">继续</span>
    </button>
  )
}

export function WaterStage({ initialSettled, active, onEnter, onOpenStem, onSettled, onResume }: StageProps) {
  const settings = useBanke((s) => s.settings)
  const updateSettings = useBanke((s) => s.updateSettings)
  const [webgl] = useState(() => {
    try {
      const probe = document.createElement('canvas')
      return !!probe.getContext('webgl2')
    } catch {
      return false
    }
  })
  const forceSkip =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('skipIntro')
  const [phase, setPhase] = useState<ScenePhase>(
    initialSettled || !webgl || forceSkip ? 'settled' : 'idle',
  )
  const [skip, setSkip] = useState(initialSettled || !webgl || forceSkip)
  const [leaving, setLeaving] = useState<Quadrant | null>(null)
  const [selected, setSelected] = useState(0)
  const labelsRef = useRef<HTMLDivElement>(null)
  const settledOnce = useRef(initialSettled || !webgl || forceSkip)

  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const activeQ = QUADRANTS[selected]
  const activeInfo = QUADRANT_INFO[activeQ]

  useEffect(() => {
    if (phase === 'settled' && !settledOnce.current) {
      settledOnce.current = true
      onSettled()
    }
  }, [phase, onSettled])

  useEffect(() => {
    let raf = 0
    const vec = new THREE.Vector3()
    const loop = () => {
      const cam = sceneBridge.camera
      const box = labelsRef.current
      if (cam && box) {
        const w = window.innerWidth
        const h = window.innerHeight
        const items = box.querySelectorAll<HTMLElement>('[data-anchor]')
        items.forEach((el) => {
          const obj = sceneBridge.anchors.get(el.dataset.anchor ?? '')
          if (!obj) return
          obj.getWorldPosition(vec).project(cam)
          const x = (vec.x * 0.5 + 0.5) * w
          const y = (-vec.y * 0.5 + 0.5) * h
          const offset = Number(el.dataset.offset ?? 0)
          const dx = Number(el.dataset.x ?? 0)
          const visible = vec.z < 1 && vec.z > -1
          el.style.transform = `translate3d(${(x + dx).toFixed(1)}px, ${(y + offset).toFixed(1)}px, 0) translate(-50%, -50%)`
          el.style.visibility = visible ? 'visible' : 'hidden'
        })
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const enter = (q: Quadrant) => {
    if (phase !== 'settled' || leaving) return
    setLeaving(q)
    window.setTimeout(() => onEnter(q), 560)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'settled' || leaving) return
      if (e.key === 'Enter') {
        e.preventDefault()
        enter(activeQ)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const skipIntro = () => {
    setSkip(true)
    setPhase('settled')
    onSettled()
  }

  return (
    <div className={`stage${leaving ? ' is-leaving' : ''}`} data-phase={phase}>
      {webgl ? (
        <Canvas
          className="stage__canvas"
          dpr={[1, coarse ? 1.4 : 1.8]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 38, near: 0.1, far: 600, position: [0, 7, 4] }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 0.92
            gl.outputColorSpace = THREE.SRGBColorSpace
          }}
        >
          <TomatoScene
            skipIntro={skip}
            entering={leaving}
            waterIntensity={settings.water}
            selected={selected}
            onSelected={setSelected}
            onSelect={enter}
            onOpenStem={onOpenStem}
            onPhase={setPhase}
          />
        </Canvas>
      ) : (
        <div className="fallback">
          <p className="fallback__note">这台设备的浏览器没有开启 WebGL，先用下面的清单进入。</p>
          <div className="fallback__grid">
            {QUADRANTS.map((q) => {
              const info = QUADRANT_INFO[q]
              return (
                <button
                  key={q}
                  className="fallback__item"
                  onClick={() => enter(q)}
                  style={{ '--accent': info.accent } as CSSProperties}
                >
                  <span>{info.numeral}</span>
                  <strong>{info.name}</strong>
                  <small>{info.en}</small>
                </button>
              )
            })}
          </div>
          <button className="fallback__stem" onClick={onOpenStem}>
            柄 · 记录与设置
          </button>
        </div>
      )}

      <div className="stage__sky" />
      <div className="stage__vignette" />

      <header className="brand">
        <div className="brand__name">半刻</div>
        <div className="brand__rule" />
        <div className="brand__sub">BANKE · 四瓣番茄钟</div>
      </header>

      <div className="stage__sound">
        <button
          className="sound-btn"
          aria-label={settings.sound ? '关闭声音' : '打开声音'}
          onClick={() => updateSettings({ sound: !settings.sound })}
        >
          <span className={`sound-btn__wave${settings.sound ? ' is-on' : ''}`}>
            <i />
            <i />
            <i />
          </span>
          <span>{settings.sound ? '有声' : '静音'}</span>
        </button>
      </div>

      {webgl && (
        <div ref={labelsRef} className={`slice-labels${phase === 'settled' ? ' is-live' : ''}`}>
          <button
            key={activeQ}
            className="slice-label is-active"
            data-anchor={activeQ}
            data-offset={coarse ? -16 : -22}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => enter(activeQ)}
            style={{ '--accent': activeInfo.accent } as CSSProperties}
          >
            <span className="slice-label__num">{activeInfo.numeral}</span>
            <span className="slice-label__name">{activeInfo.name}</span>
            <span className="slice-label__en">{activeInfo.en}</span>
            <span className="slice-label__go">进入</span>
          </button>

          <button
            className="stem-label"
            data-anchor="stem"
            data-offset={coarse ? -24 : -34}
            data-x={coarse ? -84 : -150}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onOpenStem}
          >
            <span className="stem-label__mark">柄</span>
            <span className="stem-label__text">记录 · 设置</span>
          </button>
        </div>
      )}

      <div className="stage__bottom">
        {phase === 'settled' ? (
          <p className="stage__hint">
            {webgl ? (
              <>
                <span>拖动 · 360° 环视</span>
                <span className="stage__hint-dot" />
                <span>点一瓣 · 进去</span>
              </>
            ) : (
              <span>选一瓣，落下这一刻</span>
            )}
          </p>
        ) : (
          <p className="stage__hint stage__hint--quiet">一刀，四瓣</p>
        )}
      </div>

      {!skip && phase !== 'settled' && (
        <button className="skip-intro" onClick={skipIntro}>
          跳过开场
        </button>
      )}

      {active && active.phase !== 'done' && phase === 'settled' && !leaving && (
        <div className="stage__resume">
          <ResumeChip active={active} onClick={onResume} />
        </div>
      )}

      {leaving && <div className="stage__flash" />}
    </div>
  )
}
