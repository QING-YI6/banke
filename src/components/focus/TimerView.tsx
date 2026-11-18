import { useEffect, useReducer, useState } from 'react'
import { useBanke } from '../../core/store'
import { QUADRANT_INFO, type ActiveSession } from '../../core/types'
import { elapsedMs, formatClock, remainingSec } from '../../core/time'
import { sound } from '../../core/sound'
import { TimerDial } from './TimerDial'

interface Props {
  active: ActiveSession
  onExit: () => void
  onOpenPanel: () => void
}

export function TimerView({ active, onExit, onOpenPanel }: Props) {
  const pause = useBanke((s) => s.pause)
  const resume = useBanke((s) => s.resume)
  const finish = useBanke((s) => s.finish)
  const setDisplay = useBanke((s) => s.setDisplay)
  const settings = useBanke((s) => s.settings)
  const [, force] = useReducer((n: number) => n + 1, 0)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const info = QUADRANT_INFO[active.quadrant]
  const accent = active.isBreak ? '#8fb3a2' : info.accent

  useEffect(() => {
    if (active.phase !== 'running') return
    const id = window.setInterval(force, 200)
    return () => window.clearInterval(id)
  }, [active.phase, force])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        if (active.phase === 'running') pause()
        else if (active.phase === 'paused') resume()
      }
      if (e.key === 'Escape') {
        if (confirmEnd) setConfirmEnd(false)
        else onExit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active.phase, pause, resume, onExit, confirmEnd])

  const now = Date.now()
  const totalElapsed = elapsedMs(active, now) / 1000
  const target = active.targetSec
  const remaining = remainingSec(active, now)
  const displaySec = active.display === 'countdown' && target !== null ? (remaining ?? 0) : totalElapsed
  const progress =
    target !== null ? Math.min(1, totalElapsed / target) : (totalElapsed % 3600) / 3600
  const canToggle = target !== null
  const paused = active.phase === 'paused'
  // 和 store 的入账规则保持一致：限时看计划与实际，不限时看实际。
  const willRecord =
    Math.round(totalElapsed) > 180 && (active.mode === 'countup' || (target ?? 0) > 180)

  const toggleDisplay = () => {
    if (!canToggle) return
    setDisplay(active.display === 'countdown' ? 'countup' : 'countdown')
    sound.pause()
  }

  const toggleTimer = () => {
    if (paused) {
      resume()
      sound.start()
    } else {
      pause()
      sound.pause()
    }
  }

  const doEnd = () => {
    setConfirmEnd(false)
    finish(false)
  }

  return (
    <div className={`focus focus--timer${active.isBreak ? ' focus--break' : ''}`}>
      <header className="focus__bar">
        <button className="bar-btn" onClick={onExit}>
          <span className="bar-btn__arrow">←</span>
          <span>水面</span>
        </button>
        <div className="focus__id">
          <span className="focus__dot" style={{ background: accent }} />
          <span className="focus__name">{active.isBreak ? '休息' : info.name}</span>
          <span className="focus__en">{active.isBreak ? 'BREAK' : info.en}</span>
        </div>
        <div className="focus__bar-right">
          <button
            className="icon-btn"
            aria-label={settings.sound ? '静音' : '打开声音'}
            onClick={() => useBanke.getState().updateSettings({ sound: !settings.sound })}
          >
            {settings.sound ? '声' : '静'}
          </button>
          <button className="icon-btn" aria-label="打开记录与设置" onClick={onOpenPanel}>
            柄
          </button>
        </div>
      </header>

      <div className="focus__task" title={active.label}>
        {active.isBreak ? '把眼睛从屏幕上移开' : active.label || '只做这一件事'}
      </div>

      <main className={`timer${paused ? ' is-paused' : ''}`}>
        <div className="timer__meta">
          <span>{active.isBreak ? '让水面替你数' : active.mode === 'countdown' ? `限时 · ${Math.round((target ?? 0) / 60)} 分钟` : '不限时 · 只往上数'}</span>
        </div>

        <TimerDial
          progress={progress}
          accent={accent}
          onClick={toggleDisplay}
          label={canToggle ? '切换倒计时与正计时' : '不限时计时'}
        >
          <div className={`timer__digits${paused ? ' is-paused' : ''}`}>{formatClock(displaySec)}</div>
          <div className="timer__caption">
            {paused ? (
              <span>停在这一刻</span>
            ) : canToggle ? (
              active.display === 'countdown' ? (
                <span>轻点数字 · 看正计时</span>
              ) : (
                <span>轻点数字 · 回到倒计时</span>
              )
            ) : (
              <span>不用赶，我会一直在</span>
            )}
          </div>
        </TimerDial>

        <div className="timer__actions">
          <button className="btn btn--primary" onClick={toggleTimer}>
            {paused ? '继续' : '暂停'}
          </button>
          <button className="btn btn--ghost" onClick={() => setConfirmEnd(true)}>
            结束
          </button>
        </div>

        <p className="timer__hint">空格键可以暂停 · 这一瓣不会催你</p>
      </main>

      {confirmEnd && (
        <div className="confirm" role="dialog" aria-modal="true">
          <div className="confirm__panel">
            <div className="confirm__eyebrow">未满</div>
            <h3>{active.isBreak ? '要提前结束休息吗？' : '就这样收下这一瓣？'}</h3>
            <p>
              {active.isBreak
                ? '休息少一点也没关系。'
                : willRecord
                  ? `已经专注 ${formatClock(totalElapsed)}，现在结束也会记进本子里。`
                  : `已经专注 ${formatClock(totalElapsed)}。不到三分钟的一瓣不进记录，只算这一次专注。`}
            </p>
            <div className="confirm__actions">
              <button className="btn btn--primary" onClick={doEnd}>
                收下
              </button>
              <button className="btn btn--ghost" onClick={() => setConfirmEnd(false)}>
                再坐一会儿
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
