import { useMemo } from 'react'
import { useBanke } from '../../core/store'
import { QUADRANT_INFO, type SessionRecord } from '../../core/types'
import {
  dayKey,
  formatDateLabel,
  formatDuration,
  formatTimeOfDay,
  lastSevenDays,
  startOfDay,
  streakDays,
  sumSeconds,
} from '../../core/time'

function groupByDay(sessions: SessionRecord[]): { key: string; label: string; items: SessionRecord[] }[] {
  const map = new Map<string, SessionRecord[]>()
  for (const s of sessions) {
    const k = dayKey(s.endedAt)
    const list = map.get(k)
    if (list) list.push(s)
    else map.set(k, [s])
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label: formatDateLabel(items[0].endedAt),
      items: items.sort((a, b) => b.endedAt - a.endedAt),
    }))
}

export function RecordsView() {
  const sessions = useBanke((s) => s.sessions)
  const now = Date.now()
  const today = startOfDay(now)
  const todaySec = sumSeconds(sessions, today, today + 86400000)
  const streak = streakDays(sessions)
  const bars = useMemo(() => lastSevenDays(sessions, now), [sessions, now])
  const max = Math.max(25, ...bars.map((b) => b.minutes))
  const groups = useMemo(() => groupByDay(sessions), [sessions])

  return (
    <div className="records">
      <div className="records__stats">
        <div className="stat">
          <strong>{Math.round(todaySec / 60)}</strong>
          <span>今日分钟</span>
        </div>
        <div className="stat">
          <strong>{streak}</strong>
          <span>连续天数</span>
        </div>
        <div className="stat">
          <strong>{sessions.length}</strong>
          <span>累计瓣数</span>
        </div>
      </div>

      <div className="chart" aria-label="最近七天专注分钟">
        <div className="chart__head">
          <span>近七日</span>
          <span>单位 · 分钟</span>
        </div>
        <div className="chart__bars">
          {bars.map((b) => (
            <div key={b.key} className={`chart__col${b.isToday ? ' is-today' : ''}`}>
              <span className="chart__value">{b.minutes > 0 ? b.minutes : ''}</span>
              <div className="chart__track">
                <div className="chart__fill" style={{ height: `${Math.max(b.minutes > 0 ? 6 : 2, (b.minutes / max) * 100)}%` }} />
              </div>
              <span className="chart__label">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="records__list">
        {groups.length === 0 && (
          <div className="empty">
            <div className="empty__mark">空</div>
            <p>还没有切下第一瓣。</p>
            <span>回去选一瓣番茄，坐二十五分钟试试。</span>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.key} className="daygroup">
            <header className="daygroup__head">
              <h3>{g.label}</h3>
              <span>
                {g.items.length} 瓣 · {Math.round(g.items.reduce((n, s) => n + s.seconds, 0) / 60)} 分
              </span>
            </header>
            <ul>
              {g.items.map((s) => (
                <li key={s.id} className="record">
                  <span className="record__dot" style={{ background: QUADRANT_INFO[s.quadrant].accent }} />
                  <div className="record__main">
                    <div className="record__top">
                      <span className="record__label">{s.label}</span>
                      {s.mode === 'countdown' && !s.reached && <span className="record__tag">未满</span>}
                    </div>
                    <div className="record__meta">
                      {QUADRANT_INFO[s.quadrant].name} · {formatTimeOfDay(s.startedAt)}—{formatTimeOfDay(s.endedAt)}
                      {s.mode === 'countup' ? ' · 不限时' : ''}
                    </div>
                  </div>
                  <span className="record__time">{formatDuration(s.seconds)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
