import { useRef, useState } from 'react'
import { useBanke } from '../../core/store'
import { DEFAULT_SETTINGS, QUADRANTS, QUADRANT_INFO } from '../../core/types'

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      className={`toggle${checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  )
}

function Stepper({
  value,
  onChange,
  unit = '分',
  min = 1,
  max = 180,
  step = 5,
}: {
  value: number
  onChange: (v: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="减少">
        −
      </button>
      <span>
        {value}
        <em>{unit}</em>
      </span>
      <button onClick={() => onChange(Math.min(max, value + step))} aria-label="增加">
        +
      </button>
    </div>
  )
}

export function SettingsView({ onReplayIntro }: { onReplayIntro: () => void }) {
  const settings = useBanke((s) => s.settings)
  const update = useBanke((s) => s.updateSettings)
  const setMinutes = useBanke((s) => s.setMinutes)
  const sessions = useBanke((s) => s.sessions)
  const importData = useBanke((s) => s.importData)
  const clearData = useBanke((s) => s.clearData)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [danger, setDanger] = useState<'records' | 'settings' | null>(null)

  const exportData = () => {
    const payload = {
      app: 'banke',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      sessions,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date()
    a.href = url
    a.download = `banke-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage('已导出到下载文件夹')
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const ok = importData(JSON.parse(text))
      setMessage(ok ? '记录已经接回来' : '这个文件不太对')
    } catch {
      setMessage('读取失败，检查一下文件')
    }
  }

  return (
    <div className="settings">
      <section className="settings__group">
        <h3>节奏</h3>
        <p className="settings__note">每一瓣的默认长度。进入后仍然可以改。</p>
        {QUADRANTS.map((q) => (
          <div className="setting-row" key={q}>
            <div className="setting-row__label">
              <span className="setting-dot" style={{ background: QUADRANT_INFO[q].accent }} />
              {QUADRANT_INFO[q].name}
            </div>
            <Stepper value={settings.minutes[q]} onChange={(v) => setMinutes(q, v)} />
          </div>
        ))}
        <div className="setting-row">
          <div className="setting-row__label">
            短休息
            <small>完成一瓣之后的默认休息</small>
          </div>
          <Stepper value={settings.shortBreak} onChange={(v) => update({ shortBreak: v })} min={1} max={60} step={1} />
        </div>
        <div className="setting-row">
          <div className="setting-row__label">
            长休息
            <small>留给更长的停顿</small>
          </div>
          <Stepper value={settings.longBreak} onChange={(v) => update({ longBreak: v })} min={5} max={90} step={5} />
        </div>
      </section>

      <section className="settings__group">
        <h3>开场与水面</h3>
        <div className="setting-row">
          <div className="setting-row__label">
            跳过内容输入
            <small>点开一瓣就直接开始计时</small>
          </div>
          <Toggle checked={settings.skipSetup} onChange={(v) => update({ skipSetup: v })} label="跳过内容输入" />
        </div>
        <div className="setting-row setting-row--stack">
          <div className="setting-row__label">
            水面动态
            <small>波动幅度与光斑强弱</small>
          </div>
          <div className="slider">
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={settings.water}
              onChange={(e) => update({ water: Number(e.target.value) })}
              aria-label="水面动态强度"
            />
            <span>{Math.round(settings.water * 100)}</span>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-row__label">
            动态
            <small>系统设置了减少动态时自动收敛</small>
          </div>
          <div className="mini-seg">
            {(
              [
                ['auto', '跟随系统'],
                ['full', '完整'],
                ['reduced', '精简'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                className={settings.motion === k ? 'is-active' : ''}
                onClick={() => update({ motion: k })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-row__label">
            重看开场
            <small>再看一次番茄被切成四瓣</small>
          </div>
          <button className="text-btn" onClick={onReplayIntro}>
            重播
          </button>
        </div>
      </section>

      <section className="settings__group">
        <h3>声音与陪伴</h3>
        <div className="setting-row">
          <div className="setting-row__label">
            提示音
            <small>切菜、水花、完成时的钵音</small>
          </div>
          <Toggle checked={settings.sound} onChange={(v) => update({ sound: v })} label="提示音" />
        </div>
        <div className="setting-row">
          <div className="setting-row__label">
            水面环境音
            <small>专注时很轻的水声</small>
          </div>
          <Toggle checked={settings.ambience} onChange={(v) => update({ ambience: v })} label="水面环境音" />
        </div>
        <div className="setting-row">
          <div className="setting-row__label">
            番茄人
            <small>让它陪着你，也让它闭嘴</small>
          </div>
          <Toggle checked={settings.pet} onChange={(v) => update({ pet: v })} label="番茄人" />
        </div>
      </section>

      <section className="settings__group">
        <h3>灵宠接入</h3>
        <p className="settings__note">
          默认使用本地的语气规则，离线可用。开启后会把当前事件发给你的 OpenAI 兼容接口，失败时自动退回本地。
        </p>
        <div className="setting-row">
          <div className="setting-row__label">
            使用远端语气
            <small>需要允许跨域访问</small>
          </div>
          <Toggle
            checked={settings.petApi.enabled}
            onChange={(v) => update({ petApi: { ...settings.petApi, enabled: v } })}
            label="使用远端语气"
          />
        </div>
        <label className="field">
          <span>接口地址</span>
          <input
            type="url"
            value={settings.petApi.endpoint}
            placeholder="https://api.openai.com/v1/chat/completions"
            onChange={(e) => update({ petApi: { ...settings.petApi, endpoint: e.target.value } })}
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>模型</span>
          <input
            type="text"
            value={settings.petApi.model}
            placeholder="gpt-4o-mini"
            onChange={(e) => update({ petApi: { ...settings.petApi, model: e.target.value } })}
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>密钥</span>
          <input
            type="password"
            value={settings.petApi.apiKey}
            placeholder="只存在这台设备上"
            onChange={(e) => update({ petApi: { ...settings.petApi, apiKey: e.target.value } })}
            spellCheck={false}
          />
        </label>
      </section>

      <section className="settings__group">
        <h3>数据</h3>
        <p className="settings__note">所有记录只存在本机，没有账号，也不上传。</p>
        <div className="settings__buttons">
          <button className="btn btn--ghost btn--small" onClick={exportData}>
            导出 JSON
          </button>
          <button className="btn btn--ghost btn--small" onClick={() => fileRef.current?.click()}>
            导入
          </button>
          <button className="btn btn--ghost btn--small btn--danger" onClick={() => setDanger('records')}>
            清除记录
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImport(f)
            e.target.value = ''
          }}
        />
        {danger === 'records' && (
          <div className="danger-confirm">
            <p>确定清除全部 {sessions.length} 条记录？无法撤销。</p>
            <div>
              <button
                className="text-btn text-btn--danger"
                onClick={() => {
                  clearData()
                  setDanger(null)
                  setMessage('记录已清空')
                }}
              >
                确定清除
              </button>
              <button className="text-btn" onClick={() => setDanger(null)}>
                取消
              </button>
            </div>
          </div>
        )}
        <div className="settings__buttons settings__buttons--bottom">
          <button className="text-btn" onClick={() => setDanger('settings')}>
            恢复默认设置
          </button>
        </div>
        {danger === 'settings' && (
          <div className="danger-confirm">
            <p>把时长、声音、水面等都恢复默认？记录不会动。</p>
            <div>
              <button
                className="text-btn text-btn--danger"
                onClick={() => {
                  update({
                    ...DEFAULT_SETTINGS,
                    minutes: { ...DEFAULT_SETTINGS.minutes },
                    petApi: { ...DEFAULT_SETTINGS.petApi },
                  })
                  setDanger(null)
                  setMessage('设置已恢复默认')
                }}
              >
                恢复
              </button>
              <button className="text-btn" onClick={() => setDanger(null)}>
                取消
              </button>
            </div>
          </div>
        )}
        {message && <p className="settings__message">{message}</p>}
      </section>

      <p className="settings__footer">半刻 · v1.0.0 · 数据在本机</p>
    </div>
  )
}
