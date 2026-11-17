import { useEffect } from 'react'
import { useBanke } from '../../core/store'
import { sound } from '../../core/sound'
import type { Quadrant, SessionMode } from '../../core/types'
import { WaterBackdrop } from './WaterBackdrop'
import { SetupView } from './SetupView'
import { TimerView } from './TimerView'
import { DoneView } from './DoneView'
import { TomatoPet } from '../TomatoPet'

interface Props {
  quadrant: Quadrant
  onExit: () => void
  onOpenPanel: () => void
}

export function FocusScreen({ quadrant, onExit, onOpenPanel }: Props) {
  const active = useBanke((s) => s.active)
  const settings = useBanke((s) => s.settings)
  const startSession = useBanke((s) => s.startSession)
  const closeSession = useBanke((s) => s.closeSession)
  const startBreak = useBanke((s) => s.startBreak)

  const q = active?.quadrant ?? quadrant

  useEffect(() => {
    if (active) return
    if (!settings.skipSetup) return
    const minutes = settings.minutes[quadrant] ?? 25
    startSession({ quadrant, label: '', mode: 'countdown', targetSec: minutes * 60 })
  }, [active, settings.skipSetup, settings.minutes, quadrant, startSession])

  useEffect(() => {
    sound.syncFocus(!!active && active.phase === 'running' && !active.isBreak)
  }, [active?.id, active?.phase, active?.isBreak])

  useEffect(() => {
    return () => sound.stopAmbience()
  }, [])

  useEffect(() => {
    if (!active || active.phase !== 'running') return
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> }
    }
    let sentinel: { release: () => Promise<void> } | null = null
    let cancelled = false
    nav.wakeLock
      ?.request('screen')
      .then((s) => {
        if (cancelled) void s.release()
        else sentinel = s
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (sentinel) void sentinel.release().catch(() => undefined)
    }
  }, [active?.id, active?.phase])

  const handleStart = (input: { label: string; mode: SessionMode; minutes: number }) => {
    startSession({
      quadrant,
      label: input.label,
      mode: input.mode,
      targetSec: input.mode === 'countdown' ? input.minutes * 60 : null,
    })
  }

  const handleExit = () => {
    const a = useBanke.getState().active
    if (a && a.phase === 'done') closeSession()
    onExit()
  }

  const handleAgain = () => {
    const a = useBanke.getState().active
    if (!a) return
    if (a.isBreak) {
      closeSession()
      return
    }
    const minutes = a.targetSec ? a.targetSec / 60 : useBanke.getState().settings.minutes[a.quadrant]
    startSession({
      quadrant: a.quadrant,
      label: a.label,
      mode: a.mode,
      targetSec: a.mode === 'countdown' ? Math.round(minutes) * 60 : null,
    })
    sound.start()
  }

  const handleBreak = () => {
    startBreak(settings.shortBreak)
    sound.start()
  }

  return (
    <div className="focus-shell">
      <WaterBackdrop intensity={settings.motion === 'reduced' ? 0.25 : settings.water} />
      <div className="focus-shell__shade" />

      {!active && (
        <SetupView quadrant={q} onBack={onExit} onStart={handleStart} onOpenPanel={onOpenPanel} />
      )}
      {active && active.phase !== 'done' && (
        <TimerView active={active} onExit={onExit} onOpenPanel={onOpenPanel} />
      )}
      {active && active.phase === 'done' && (
        <DoneView active={active} onExit={handleExit} onAgain={handleAgain} onBreak={handleBreak} />
      )}

      <TomatoPet />
    </div>
  )
}
