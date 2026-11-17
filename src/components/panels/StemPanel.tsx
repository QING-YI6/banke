import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBanke } from '../../core/store'
import type { Panel } from '../../core/types'
import { RecordsView } from './RecordsView'
import { SettingsView } from './SettingsView'
import { AboutView } from './AboutView'

interface Props {
  tab: Exclude<Panel, null>
  onChange: (tab: Exclude<Panel, null>) => void
  onClose: () => void
  onReplayIntro: () => void
}

const TABS: { key: Exclude<Panel, null>; label: string }[] = [
  { key: 'records', label: '记录' },
  { key: 'settings', label: '设置' },
  { key: 'about', label: '关于' },
]

export function StemPanel({ tab, onChange, onClose, onReplayIntro }: Props) {
  const sessions = useBanke((s) => s.sessions)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <motion.div
      className="panel-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      onClick={onClose}
    >
      <motion.aside
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label="柄"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 22 }}
        transition={{ duration: 0.36, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel__head">
          <div className="panel__brand">
            <span className="panel__seal">柄</span>
            <div>
              <h2>柄</h2>
              <p>番茄的柄，挂着记录、设置和一点别的事。</p>
            </div>
          </div>
          <button className="panel__close" onClick={onClose} aria-label="合上">
            <span />
            <span />
          </button>
        </header>

        <nav className="panel__tabs" aria-label="柄的分区">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`panel__tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => onChange(t.key)}
            >
              {t.label}
              {t.key === 'records' && sessions.length > 0 && <em>{sessions.length}</em>}
            </button>
          ))}
        </nav>

        <div className="panel__body">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {tab === 'records' && <RecordsView />}
              {tab === 'settings' && <SettingsView onReplayIntro={onReplayIntro} />}
              {tab === 'about' && <AboutView onReplayIntro={onReplayIntro} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.aside>
    </motion.div>
  )
}
