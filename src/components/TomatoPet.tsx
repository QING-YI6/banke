import { useEffect, useRef, useState } from 'react'
import { petBus } from '../core/petBus'
import { petReply } from '../core/petBrain'
import { useBanke } from '../core/store'
import type { PetMood } from '../core/types'
import { sound } from '../core/sound'

function Eyes({ mood }: { mood: PetMood }) {
  if (mood === 'sleepy') {
    return (
      <g className="pet__eyes">
        <path d="M80 123 q7 6 14 0" stroke="#2a1410" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M126 123 q7 6 14 0" stroke="#2a1410" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    )
  }
  if (mood === 'proud') {
    return (
      <g className="pet__eyes">
        <path d="M80 124 q7 -7 14 0" stroke="#2a1410" strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <path d="M126 124 q7 -7 14 0" stroke="#2a1410" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g className="pet__eyes">
      <ellipse className="pet__eye" cx="87" cy="122" rx="5.6" ry="8.6" fill="#28120e" />
      <ellipse className="pet__eye" cx="133" cy="122" rx="5.6" ry="8.6" fill="#28120e" />
      <circle cx="89" cy="119" r="1.7" fill="#fff6e8" opacity="0.85" />
      <circle cx="135" cy="119" r="1.7" fill="#fff6e8" opacity="0.85" />
    </g>
  )
}

function Mouth({ mood }: { mood: PetMood }) {
  if (mood === 'worried') {
    return <path d="M101 146 q9 -5 18 0" stroke="#361812" strokeWidth="2.6" fill="none" strokeLinecap="round" />
  }
  if (mood === 'sleepy') {
    return <ellipse cx="110" cy="144" rx="4" ry="5" fill="#3a1712" opacity="0.8" />
  }
  if (mood === 'proud' || mood === 'glad') {
    return <path d="M99 141 q11 11 22 0 q-11 4 -22 0" fill="#3a1712" opacity="0.85" />
  }
  return <path d="M101 142 q9 6 18 0" stroke="#361812" strokeWidth="2.6" fill="none" strokeLinecap="round" />
}

export function TomatoPet({ large = false }: { large?: boolean }) {
  const settings = useBanke((s) => s.settings)
  const petEnabled = settings.pet
  const mood = useBanke((s) => s.petMood)
  const [said, setSaid] = useState<{ text: string; key: number } | null>(null)
  const seq = useRef(0)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    const off = petBus.on(async (event) => {
      const id = ++seq.current
      const reply = await petReply(event, useBanke.getState().settings)
      if (!alive || id !== seq.current) return
      setSaid({ text: reply.line, key: Date.now() })
    })
    return () => {
      alive = false
      off()
    }
  }, [])

  useEffect(() => {
    if (!said) return
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setSaid(null), 7200)
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [said])

  if (!petEnabled) return null

  const tap = () => {
    sound.pause()
    if (navigator.vibrate) navigator.vibrate(10)
    petBus.emit({ type: 'tap' })
  }

  return (
    <div className={`pet pet--${mood}${large ? ' pet--large' : ''}`}>
      {said && (
        <div key={said.key} className="pet__say" role="status" aria-live="polite">
          <span className="pet__say-mark">“</span>
          <span>{said.text}</span>
        </div>
      )}
      <button className="pet__hit" onClick={tap} aria-label="和番茄人说句话">
        <svg className="pet__svg" viewBox="0 0 220 232" role="img" aria-hidden="true">
          <defs>
            <radialGradient id="petBody" cx="34%" cy="26%" r="82%">
              <stop offset="0" stopColor="#ea6a4f" />
              <stop offset="0.52" stopColor="#cf402b" />
              <stop offset="1" stopColor="#9a2617" />
            </radialGradient>
            <linearGradient id="petLeaf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#9cae66" />
              <stop offset="1" stopColor="#657a3d" />
            </linearGradient>
            <radialGradient id="petGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#f6c07a" stopOpacity="0.55" />
              <stop offset="1" stopColor="#f6c07a" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse className="pet__glow" cx="110" cy="200" rx="82" ry="24" fill="url(#petGlow)" />
          <ellipse className="pet__shadow" cx="110" cy="212" rx="56" ry="9" fill="#02110e" opacity="0.4" />

          <g className="pet__body">
            <path
              d="M110 38
                 C 154 36, 191 76, 191 122
                 C 191 168, 154 199, 110 199
                 C 66 199, 29 168, 29 122
                 C 29 76, 66 36, 110 38 Z"
              fill="url(#petBody)"
            />
            <path
              d="M66 78 C 78 54, 104 46, 120 50 C 98 58, 82 72, 74 92 Z"
              fill="#ffd7c6"
              opacity="0.16"
            />
            <ellipse cx="70" cy="166" rx="26" ry="16" fill="#7e1c10" opacity="0.18" />
            <g opacity="0.22" fill="#ffe0c8">
              <ellipse cx="158" cy="92" rx="2.6" ry="1.8" transform="rotate(-18 158 92)" />
              <ellipse cx="172" cy="128" rx="2" ry="1.4" transform="rotate(24 172 128)" />
              <ellipse cx="50" cy="108" rx="2.2" ry="1.5" transform="rotate(12 50 108)" />
              <ellipse cx="62" cy="150" rx="1.8" ry="1.2" />
            </g>

            <g className="pet__calyx">
              <path d="M110 42 C 107 26, 109 14, 116 6 C 120 18, 118 30, 114 43 Z" fill="url(#petLeaf)" />
              <path d="M110 42 C 98 26, 82 20, 70 26 C 80 34, 92 40, 104 45 Z" fill="url(#petLeaf)" />
              <path d="M110 42 C 122 24, 140 18, 152 26 C 142 34, 128 40, 116 45 Z" fill="url(#petLeaf)" />
              <path d="M108 44 C 92 40, 78 42, 68 34 C 82 36, 96 38, 108 40 Z" fill="#617437" opacity="0.85" />
              <path d="M112 44 C 128 40, 142 42, 152 34 C 138 36, 124 38, 112 40 Z" fill="#617437" opacity="0.85" />
            </g>

            <g className="pet__arm pet__arm--left">
              <path d="M45 126 C 34 122, 26 116, 22 108" stroke="#b5341f" strokeWidth="7.5" strokeLinecap="round" fill="none" />
              <path d="M22 108 C 12 104, 8 96, 12 89 C 20 91, 27 98, 26 106 Z" fill="url(#petLeaf)" />
            </g>
            <g className="pet__arm pet__arm--right">
              <path d="M175 126 C 186 122, 194 116, 198 108" stroke="#b5341f" strokeWidth="7.5" strokeLinecap="round" fill="none" />
              <path d="M198 108 C 208 104, 212 96, 208 89 C 200 91, 193 98, 194 106 Z" fill="url(#petLeaf)" />
            </g>

            <g className="pet__legs">
              <path d="M94 194 L 90 210" stroke="#8c2114" strokeWidth="7" strokeLinecap="round" />
              <path d="M126 194 L 130 210" stroke="#8c2114" strokeWidth="7" strokeLinecap="round" />
              <ellipse cx="87" cy="212" rx="9" ry="4.5" fill="#4c150d" />
              <ellipse cx="133" cy="212" rx="9" ry="4.5" fill="#4c150d" />
            </g>

            <g className="pet__face">
              <Eyes mood={mood} />
              <ellipse cx="68" cy="139" rx="10" ry="6" fill="#ef8368" opacity="0.5" />
              <ellipse cx="152" cy="139" rx="10" ry="6" fill="#ef8368" opacity="0.5" />
              <Mouth mood={mood} />
            </g>

            {mood === 'worried' && (
              <path className="pet__sweat" d="M170 68 C 176 78, 179 83, 174 89 C 169 84, 167 76, 170 68 Z" fill="#bcd8d2" opacity="0.8" />
            )}
            {mood === 'proud' && (
              <g className="pet__sparkle" fill="#f4c987">
                <path d="M34 66 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 z" />
                <path d="M186 52 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 z" opacity="0.8" />
                <path d="M196 148 l1.5 3.8 3.8 1.5 -3.8 1.5 -1.5 3.8 -1.5 -3.8 -3.8 -1.5 3.8 -1.5 z" opacity="0.65" />
              </g>
            )}
          </g>
        </svg>
      </button>
    </div>
  )
}
