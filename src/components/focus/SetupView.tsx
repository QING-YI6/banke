import { useEffect, useRef, useState } from 'react'
import { useBanke } from '../../core/store'
import { MINUTE_PRESETS, QUADRANT_INFO, type Quadrant, type SessionMode } from '../../core/types'
import { sound } from '../../core/sound'

interface Props {
  quadrant: Quadrant
  onBack: () => void
  onStart: (input: { label: string; mode: SessionMode; minutes: number }) => void
  onOpenPanel: () => void
}

export function SetupView({ quadrant, onBack, onStart, onOpenPanel }: Props) {
  const info = QUADRANT_INFO[quadrant]
  const settings = useBanke((s) => s.settings)
  const updateSettings = useBanke((s) => s.updateSettings)
  const setMinutes = useBanke((s) => s.setMinutes)
  const [label, setLabel] = useState('')
  const [mode, setMode] = useState<SessionMode>('countdown')
  const [minutes, setLocalMinutes] = useState(settings.minutes[quadrant] || 25)
  const inputRef = useRef<HTMLInputElement>(null)
  const coarse = window.matchMedia('(pointer: coarse)').matches

  useEffect(() => {
    if (!coarse) inputRef.current?.focus()
  }, [coarse])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  const begin = (text = label) => {
    if (mode === 'countdown') setMinutes(quadrant, minutes)
    sound.start()
    onStart({ label: text.trim(), mode, minutes })
  }

  return (
    <div className="focus focus--setup">
      <header className="focus__bar">
        <button className="bar-btn" onClick={onBack}>
          <span className="bar-btn__arrow">←</span>
          <span>水面</span>
        </button>
        <div className="focus__id">
          <span className="focus__dot" style={{ background: info.accent }} />
          <span className="focus__name">{info.name}</span>
          <span className="focus__en">{info.en}</span>
        </div>
        <div className="focus__bar-right">
          <button className="icon-btn" aria-label="打开记录与设置" onClick={onOpenPanel}>
            柄
          </button>
        </div>
      </header>

      <main className="setup">
        <div className="setup__eyebrow">
          <span className="setup__num">{info.numeral}</span>
          <span className="setup__slash">/</span>
          <span>{info.en}</span>
        </div>
        <h1 className="setup__question">{info.question}</h1>

        <input
          ref={inputRef}
          className="setup__input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') begin()
          }}
          placeholder={info.placeholder}
          maxLength={48}
          spellCheck={false}
          aria-label={info.question}
        />

        <div className="setup__row">
          <span className="setup__row-label">怎么数</span>
          <div className="seg" role="group" aria-label="计时方式">
            <button
              className={`seg__item${mode === 'countdown' ? ' is-active' : ''}`}
              onClick={() => setMode('countdown')}
            >
              限时
              <small>到点提醒我</small>
            </button>
            <button
              className={`seg__item${mode === 'countup' ? ' is-active' : ''}`}
              onClick={() => setMode('countup')}
            >
              不限时
              <small>只往上数</small>
            </button>
          </div>
        </div>

        {mode === 'countdown' && (
          <div className="setup__row">
            <span className="setup__row-label">多久</span>
            <div className="chips">
              {MINUTE_PRESETS.map((m) => (
                <button
                  key={m}
                  className={`chip${minutes === m ? ' is-active' : ''}`}
                  onClick={() => setLocalMinutes(m)}
                >
                  {m}
                  <span>分</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="setup__actions">
          <button className="btn btn--primary btn--wide" onClick={() => begin()}>
            落下这一刀
            <span className="btn__hint">↵</span>
          </button>
        </div>
        <div className="setup__secondary">
          <button className="text-btn" onClick={() => begin('')}>
            不写，直接开始
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.skipSetup}
              onChange={(e) => updateSettings({ skipSetup: e.target.checked })}
            />
            <span className="check__box" />
            <span>以后不再问</span>
          </label>
        </div>

        {mode === 'countdown' && (
          <p className="setup__tip">开始后轻点数字，可以随时切成正计时看已经坐了多久。</p>
        )}
      </main>
    </div>
  )
}
