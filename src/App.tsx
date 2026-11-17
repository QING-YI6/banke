import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { WaterStage } from './components/WaterStage'
import { FocusScreen } from './components/focus/FocusScreen'
import { StemPanel } from './components/panels/StemPanel'
import { useBanke } from './core/store'
import { sound } from './core/sound'
import { petBus } from './core/petBus'
import {
  QUADRANT_INFO,
  type Panel,
  type Quadrant,
  type Screen,
} from './core/types'
import { elapsedMs, formatClock, remainingSec } from './core/time'

export default function App() {
  const [screen, setScreen] = useState<Screen>('water')
  const [focusQuadrant, setFocusQuadrant] = useState<Quadrant | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [introSeen, setIntroSeen] = useState(false)
  const [waterKey, setWaterKey] = useState(0)

  const settings = useBanke((s) => s.settings)
  const active = useBanke((s) => s.active)

  /* ---- 声音设置跟随 ---- */
  useEffect(() => {
    sound.setEnabled(settings.sound)
    sound.setAmbience(settings.ambience)
  }, [settings.sound, settings.ambience])

  useEffect(() => {
    const unlock = () => sound.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  /* ---- 全局计时看门狗：无论在哪一页，到点都会结算 ---- */
  useEffect(() => {
    const midway = new Set<string>()
    const id = window.setInterval(() => {
      const st = useBanke.getState()
      const a = st.active
      if (!a || a.phase !== 'running') return
      const now = Date.now()
      if (a.mode === 'countdown' && a.targetSec !== null) {
        const left = a.targetSec - elapsedMs(a, now) / 1000
        if (left <= 0) {
          st.finish(true)
          sound.complete()
          if (navigator.vibrate) navigator.vibrate([20, 60, 20])
          return
        }
        if (left <= a.targetSec * 0.5 && !midway.has(a.id)) {
          midway.add(a.id)
          petBus.emit({ type: 'midway', quadrant: a.quadrant })
        }
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  /* ---- 离开专注页时到点，也把你请回完成页 ---- */
  useEffect(() => {
    if (active?.phase === 'done' && screen === 'water') {
      setFocusQuadrant(active.quadrant)
      setScreen('focus')
    }
  }, [active?.phase, active?.quadrant, screen])

  /* ---- 标题栏上的时间 ---- */
  useEffect(() => {
    const id = window.setInterval(() => {
      const a = useBanke.getState().active
      if (a && a.phase === 'running') {
        const sec =
          a.display === 'countdown' && a.targetSec !== null
            ? (remainingSec(a) ?? 0)
            : elapsedMs(a) / 1000
        const name = a.isBreak ? '休息' : QUADRANT_INFO[a.quadrant].name
        document.title = `${formatClock(sec)} · ${name} — 半刻`
      } else {
        document.title = '半刻'
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  /* ---- 移动端视口高度 ---- */
  useEffect(() => {
    const set = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
    set()
    window.addEventListener('resize', set)
    window.addEventListener('orientationchange', set)
    return () => {
      window.removeEventListener('resize', set)
      window.removeEventListener('orientationchange', set)
    }
  }, [])

  /* ---- Android 实体返回键：先合上柄，再回水面 ---- */
  useEffect(() => {
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!cap?.isNativePlatform?.()) return
    let remove: (() => void) | undefined
    let cancelled = false
    import('@capacitor/app')
      .then(({ App: NativeApp }) =>
        NativeApp.addListener('backButton', () => {
          if (panel) {
            setPanel(null)
            return
          }
          if (screen === 'focus') {
            const active = useBanke.getState().active
            if (active?.phase === 'done') useBanke.getState().closeSession()
            setScreen('water')
          }
        }),
      )
      .then((handle) => {
        if (cancelled) void handle.remove()
        else remove = () => void handle.remove()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      remove?.()
    }
  }, [panel, screen])

  const enterFocus = useCallback((q: Quadrant) => {
    setFocusQuadrant(q)
    setIntroSeen(true)
    setScreen('focus')
    setPanel(null)
  }, [])

  const exitFocus = useCallback(() => {
    setScreen('water')
  }, [])

  const resume = useCallback(() => {
    const a = useBanke.getState().active
    if (!a) return
    setFocusQuadrant(a.quadrant)
    setScreen('focus')
  }, [])

  const replayIntro = useCallback(() => {
    setPanel(null)
    setIntroSeen(false)
    setWaterKey((k) => k + 1)
    setScreen('water')
  }, [])

  return (
    <div className={`app app--${screen}`}>
      {screen === 'water' && (
        <WaterStage
          key={waterKey}
          initialSettled={introSeen}
          active={active}
          onEnter={enterFocus}
          onOpenStem={() => setPanel('records')}
          onSettled={() => setIntroSeen(true)}
          onResume={resume}
        />
      )}

      {screen === 'focus' && focusQuadrant && (
        <FocusScreen
          quadrant={focusQuadrant}
          onExit={exitFocus}
          onOpenPanel={() => setPanel('records')}
        />
      )}

      <AnimatePresence>
        {panel && (
          <StemPanel
            tab={panel}
            onChange={setPanel}
            onClose={() => setPanel(null)}
            onReplayIntro={replayIntro}
          />
        )}
      </AnimatePresence>

      <div className="grain" aria-hidden="true" />
    </div>
  )
}
