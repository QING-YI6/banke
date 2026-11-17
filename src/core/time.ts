/** 纯函数计时工具：所有展示与统计都从时间戳推导，切后台、锁屏不会漂移。 */

export function elapsedMs(
  a: { accumulatedMs: number; startedAt: number | null; phase: string },
  now = Date.now(),
): number {
  const base = a.accumulatedMs
  if (a.phase === 'running' && a.startedAt) return base + Math.max(0, now - a.startedAt)
  return base
}

export function remainingSec(
  a: { accumulatedMs: number; startedAt: number | null; phase: string; targetSec: number | null },
  now = Date.now(),
): number | null {
  if (!a.targetSec) return null
  return Math.max(0, a.targetSec - elapsedMs(a, now) / 1000)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 计时器主显示：少于 1 小时用 MM:SS，超过则 H:MM:SS */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec + 1e-6))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${pad2(m)}:${pad2(sec)}`
  return `${pad2(m)}:${pad2(sec)}`
}

/** 记录里的时长：25 分钟 / 1 小时 5 分 */
export function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${Math.max(1, Math.round(totalSec))} 秒`
  const mins = Math.max(0, Math.round(totalSec / 60))
  if (mins < 60) return `${mins} 分钟`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function formatTimeOfDay(ts: number): string {
  const d = new Date(ts)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function formatDateLabel(ts: number, now = Date.now()): string {
  const key = dayKey(ts)
  if (key === dayKey(now)) return '今天'
  if (key === dayKey(startOfDay(now) - 86400000)) return '昨天'
  const d = new Date(ts)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 连续专注天数：今天有记录从今天起算，否则从昨天起算。 */
export function streakDays(sessions: { endedAt: number }[], now = Date.now()): number {
  if (!sessions.length) return 0
  const days = new Set(sessions.map((s) => dayKey(s.endedAt)))
  let cursor = startOfDay(now)
  if (!days.has(dayKey(cursor))) {
    cursor -= 86400000
    if (!days.has(dayKey(cursor))) return 0
  }
  let n = 0
  while (days.has(dayKey(cursor))) {
    n += 1
    cursor -= 86400000
  }
  return n
}

export function sumSeconds(sessions: { seconds: number; endedAt: number }[], from: number, to: number): number {
  return sessions.reduce((acc, s) => (s.endedAt >= from && s.endedAt < to ? acc + s.seconds : acc), 0)
}

export interface DayBar {
  key: string
  label: string
  minutes: number
  isToday: boolean
}

/** 最近 7 天专注分钟数，用于首页/记录里的细柱图。 */
export function lastSevenDays(sessions: { seconds: number; endedAt: number }[], now = Date.now()): DayBar[] {
  const labels = ['日', '一', '二', '三', '四', '五', '六']
  const out: DayBar[] = []
  const today = startOfDay(now)
  for (let i = 6; i >= 0; i--) {
    const from = today - i * 86400000
    const to = from + 86400000
    const d = new Date(from)
    out.push({
      key: dayKey(from),
      label: labels[d.getDay()],
      minutes: Math.round(sumSeconds(sessions, from, to) / 60),
      isToday: i === 0,
    })
  }
  return out
}
