import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ActiveSession, PetMood, Quadrant, SessionMode, SessionRecord, Settings } from './types'
import { DEFAULT_SETTINGS, QUADRANT_INFO } from './types'
import { elapsedMs } from './time'
import { petBus } from './petBus'

const MAX_RECORDS = 600

export interface StartInput {
  quadrant: Quadrant
  label: string
  mode: SessionMode
  targetSec: number | null
  isBreak?: boolean
}

interface BankeState {
  settings: Settings
  sessions: SessionRecord[]
  active: ActiveSession | null
  lastQuadrant: Quadrant | null
  petMood: PetMood
  updateSettings: (patch: Partial<Settings>) => void
  setMinutes: (quadrant: Quadrant, minutes: number) => void
  startSession: (input: StartInput) => void
  startBreak: (minutes: number) => void
  pause: () => void
  resume: () => void
  togglePause: () => void
  setDisplay: (mode: SessionMode) => void
  finish: (reached: boolean) => void
  closeSession: () => void
  setPetMood: (mood: PetMood) => void
  clearData: () => void
  importData: (payload: unknown) => boolean
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export const useBanke = create<BankeState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      sessions: [],
      active: null,
      lastQuadrant: null,
      petMood: 'calm',

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setMinutes: (quadrant, minutes) =>
        set((s) => ({
          settings: {
            ...s.settings,
            minutes: { ...s.settings.minutes, [quadrant]: Math.max(1, Math.min(180, Math.round(minutes))) },
          },
        })),

      startSession: ({ quadrant, label, mode, targetSec, isBreak = false }) => {
        const now = Date.now()
        const active: ActiveSession = {
          id: uid(),
          quadrant,
          label: label.trim() || QUADRANT_INFO[quadrant].fallback,
          mode,
          display: mode,
          targetSec,
          accumulatedMs: 0,
          startedAt: now,
          phase: 'running',
          isBreak,
          createdAt: now,
        }
        set({ active, lastQuadrant: quadrant, petMood: isBreak ? 'calm' : 'glad' })
        petBus.emit(
          isBreak
            ? { type: 'breakStart', minutes: Math.round((targetSec ?? 0) / 60) }
            : { type: 'start', quadrant, minutes: targetSec ? Math.round(targetSec / 60) : null },
        )
      },

      startBreak: (minutes) => {
        const q = get().lastQuadrant ?? 'quiet'
        get().startSession({
          quadrant: q,
          label: '休息',
          mode: 'countdown',
          targetSec: Math.max(1, minutes) * 60,
          isBreak: true,
        })
      },

      pause: () => {
        const a = get().active
        if (!a || a.phase !== 'running') return
        const now = Date.now()
        set({
          active: { ...a, accumulatedMs: elapsedMs(a, now), startedAt: null, phase: 'paused' },
          petMood: 'calm',
        })
        petBus.emit({ type: 'pause', quadrant: a.quadrant })
      },

      resume: () => {
        const a = get().active
        if (!a || a.phase !== 'paused') return
        set({ active: { ...a, startedAt: Date.now(), phase: 'running' }, petMood: 'glad' })
        petBus.emit({ type: 'resume', quadrant: a.quadrant })
      },

      togglePause: () => {
        const a = get().active
        if (!a) return
        if (a.phase === 'running') get().pause()
        else if (a.phase === 'paused') get().resume()
      },

      setDisplay: (mode) => {
        const a = get().active
        if (!a) return
        set({ active: { ...a, display: mode } })
      },

      finish: (reached) => {
        const a = get().active
        if (!a || a.phase === 'done') return
        const now = Date.now()
        const ms = elapsedMs(a, now)
        if (a.isBreak) {
          set({ active: null, petMood: 'calm' })
          petBus.emit({ type: 'breakDone' })
          return
        }
        const seconds = Math.max(0, Math.round(ms / 1000))
        const record: SessionRecord = {
          id: a.id,
          quadrant: a.quadrant,
          label: a.label,
          mode: a.mode,
          plannedSec: a.targetSec,
          seconds,
          startedAt: a.createdAt,
          endedAt: now,
          reached,
        }
        set((s) => ({
          active: { ...a, accumulatedMs: ms, startedAt: null, phase: 'done' },
          sessions: [record, ...s.sessions].slice(0, MAX_RECORDS),
          petMood: reached ? 'proud' : a.mode === 'countdown' ? 'worried' : 'calm',
        }))
        if (a.mode === 'countdown' && !reached) {
          petBus.emit({ type: 'abandon', quadrant: a.quadrant, seconds })
        } else {
          petBus.emit({ type: 'complete', quadrant: a.quadrant, seconds, reached: true })
        }
      },

      closeSession: () => {
        set({ active: null, petMood: 'calm' })
      },

      setPetMood: (petMood) => set({ petMood }),

      clearData: () => set({ sessions: [], active: null, petMood: 'calm' }),

      importData: (payload) => {
        if (!payload || typeof payload !== 'object') return false
        const data = payload as { sessions?: unknown; settings?: unknown }
        const sessions = Array.isArray(data.sessions)
          ? (data.sessions as SessionRecord[]).filter(
              (r) =>
                r &&
                typeof r.id === 'string' &&
                typeof r.seconds === 'number' &&
                typeof r.endedAt === 'number' &&
                typeof r.quadrant === 'string' &&
                r.quadrant in QUADRANT_INFO,
            )
          : []
        if (!sessions.length && !data.sessions) return false
        const settings =
          data.settings && typeof data.settings === 'object'
            ? { ...DEFAULT_SETTINGS, ...(data.settings as Partial<Settings>) }
            : get().settings
        set({ sessions: sessions.slice(0, MAX_RECORDS), settings, active: null, petMood: 'calm' })
        return true
      },
    }),
    {
      name: 'banke.state.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        sessions: s.sessions,
        active: s.active,
        lastQuadrant: s.lastQuadrant,
        petMood: s.petMood,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BankeState>
        return {
          ...current,
          ...p,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(p.settings ?? {}),
            minutes: { ...DEFAULT_SETTINGS.minutes, ...(p.settings?.minutes ?? {}) },
            petApi: { ...DEFAULT_SETTINGS.petApi, ...(p.settings?.petApi ?? {}) },
          },
        }
      },
    },
  ),
)

export const selectShortBreak = (s: BankeState) => s.settings.shortBreak
export const selectLongBreak = (s: BankeState) => s.settings.longBreak

/** 当前是否有正在走的计时（不限时也算）。 */
export function activeIsLive(a: ActiveSession | null): boolean {
  return !!a && a.phase !== 'done'
}
