import type { CSSProperties, ReactNode } from 'react'

const R = 268
const CIRC = 2 * Math.PI * R

interface DialProps {
  progress: number
  accent: string
  children: ReactNode
  onClick: () => void
  label: string
}

/** 带刻度的表盘，而不是常见的进度环。 */
export function TimerDial({ progress, accent, children, onClick, label }: DialProps) {
  const p = Math.max(0, Math.min(1, progress))
  const angle = -Math.PI / 2 + p * Math.PI * 2
  const dotX = 300 + Math.cos(angle) * R
  const dotY = 300 + Math.sin(angle) * R

  return (
    <button
      className="dial"
      onClick={onClick}
      aria-label={label}
      style={{ '--accent': accent } as CSSProperties}
    >
      <svg className="dial__svg" viewBox="0 0 600 600" aria-hidden="true">
        <circle className="dial__track" cx="300" cy="300" r={R} />
        <circle
          className="dial__arc"
          cx="300"
          cy="300"
          r={R}
          strokeDasharray={`${CIRC * p} ${CIRC}`}
          transform="rotate(-90 300 300)"
        />
        {p > 0.004 && <circle className="dial__dot" cx={dotX} cy={dotY} r="4.6" />}
        {Array.from({ length: 60 }).map((_, i) => {
          const major = i % 5 === 0
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2
          const r1 = major ? 286 : 291
          const r2 = major ? 298 : 296
          return (
            <line
              key={i}
              className={`dial__tick${major ? ' is-major' : ''}`}
              x1={300 + Math.cos(a) * r1}
              y1={300 + Math.sin(a) * r1}
              x2={300 + Math.cos(a) * r2}
              y2={300 + Math.sin(a) * r2}
            />
          )
        })}
      </svg>
      <div className="dial__inner">{children}</div>
    </button>
  )
}
