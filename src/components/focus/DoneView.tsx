import { useBanke } from '../../core/store'
import { QUADRANT_INFO, type ActiveSession } from '../../core/types'
import { formatDateLabel, formatDuration, formatTimeOfDay, dayKey } from '../../core/time'

interface Props {
  active: ActiveSession
  onExit: () => void
  onAgain: () => void
  onBreak: () => void
}

export function DoneView({ active, onExit, onAgain, onBreak }: Props) {
  const sessions = useBanke((s) => s.sessions)
  const settings = useBanke((s) => s.settings)
  const info = QUADRANT_INFO[active.quadrant]
  const reached =
    active.mode === 'countup'
      ? true
      : active.targetSec !== null
        ? active.accumulatedMs / 1000 >= active.targetSec - 1
        : false
  const todayCount = sessions.filter((s) => dayKey(s.endedAt) === dayKey(Date.now())).length
  const minutes = active.accumulatedMs / 1000

  return (
    <div className={`focus focus--done${active.isBreak ? ' is-break' : ''}`}>
      <div className="done">
        <div className="done__eyebrow">
          {active.isBreak ? '休息结束' : `今天第 ${todayCount || 1} 瓣`}
        </div>
        <h1 className="done__title">
          {active.isBreak ? '水面静了。' : reached ? '一瓣落定。' : '先收在这里。'}
        </h1>
        <div className="done__rule" />
        <p className="done__sub">
          {active.isBreak ? '让眼睛离开屏幕，就是这五分钟的全部任务。' : active.label}
        </p>
        <p className="done__meta">
          {active.isBreak ? '休息' : info.name} · {formatDateLabel(active.createdAt)} {formatTimeOfDay(active.createdAt)} —{' '}
          {formatTimeOfDay(Date.now())}
        </p>

        <div className="done__stats">
          <div className="done__stat">
            <strong>{formatDuration(minutes)}</strong>
            <span>{active.isBreak ? '休息了' : '专注了'}</span>
          </div>
          <div className="done__stat">
            <strong>{active.mode === 'countdown' ? (reached ? '满' : '未满') : '自定'}</strong>
            <span>{active.mode === 'countdown' ? '这一瓣' : '不设限'}</span>
          </div>
        </div>

        <div className="done__actions">
          {!active.isBreak && (
            <button className="btn btn--primary" onClick={onBreak}>
              休息 {settings.shortBreak} 分钟
            </button>
          )}
          <button className={`btn ${active.isBreak ? 'btn--primary' : 'btn--ghost'}`} onClick={onAgain}>
            再切一瓣
          </button>
          <button className="text-btn" onClick={onExit}>
            回到水面
          </button>
        </div>

        <p className="done__quote">
          {active.isBreak ? '「不急，水会等你。」' : reached ? '「不必庆祝，坐着就是答案。」' : '「收刀也是一种完成。」'}
        </p>
      </div>
    </div>
  )
}
