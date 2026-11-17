export const QUADRANTS = ['study', 'work', 'read', 'quiet'] as const
export type Quadrant = (typeof QUADRANTS)[number]

export type SessionMode = 'countdown' | 'countup'
export type PetMood = 'calm' | 'glad' | 'proud' | 'worried' | 'sleepy'
export type Screen = 'water' | 'focus'
export type Panel = 'records' | 'settings' | 'about' | null

export interface QuadrantInfo {
  key: Quadrant
  name: string
  en: string
  numeral: string
  accent: string
  /** 进入这一瓣时，输入框上方的那句话 */
  question: string
  placeholder: string
  /** 跳过输入时，计时器标题的默认文案 */
  fallback: string
  mark: string
}

export const QUADRANT_INFO: Record<Quadrant, QuadrantInfo> = {
  study: {
    key: 'study',
    name: '学习',
    en: 'STUDY',
    numeral: '01',
    accent: '#d9a35f',
    question: '这一瓣，想弄懂什么？',
    placeholder: '一章书、一道题，或一个卡住的概念',
    fallback: '学习',
    mark: '知',
  },
  work: {
    key: 'work',
    name: '工作',
    en: 'WORK',
    numeral: '02',
    accent: '#d2503a',
    question: '这一瓣，推进哪件事？',
    placeholder: '写一段、改一版，或把一件事收尾',
    fallback: '工作',
    mark: '事',
  },
  read: {
    key: 'read',
    name: '阅读',
    en: 'READ',
    numeral: '03',
    accent: '#9bab75',
    question: '这一瓣，翻到哪一页？',
    placeholder: '书名，或读到哪里',
    fallback: '阅读',
    mark: '阅',
  },
  quiet: {
    key: 'quiet',
    name: '静心',
    en: 'QUIET',
    numeral: '04',
    accent: '#8aa8a1',
    question: '这一瓣，放下什么？',
    placeholder: '可以写，也可以留白',
    fallback: '静心',
    mark: '静',
  },
}

export interface Settings {
  /** 默认跳过「这一瓣留给什么」的输入 */
  skipSetup: boolean
  /** 每个版块上一次使用的分钟数 */
  minutes: Record<Quadrant, number>
  shortBreak: number
  longBreak: number
  sound: boolean
  ambience: boolean
  pet: boolean
  /** 水面动态强度 0–1 */
  water: number
  motion: 'auto' | 'full' | 'reduced'
  /** 预留：灵宠接入大模型。现在留空即走本地规则。 */
  petApi: { enabled: boolean; endpoint: string; apiKey: string; model: string }
}

export interface SessionRecord {
  id: string
  quadrant: Quadrant
  label: string
  mode: SessionMode
  plannedSec: number | null
  seconds: number
  startedAt: number
  endedAt: number
  /** 倒计时是否走到了底 */
  reached: boolean
}

export interface ActiveSession {
  id: string
  quadrant: Quadrant
  label: string
  /** 这次会话是限时还是不限时 */
  mode: SessionMode
  /** 计时器上此刻展示的是倒计时还是正计时（限时时可切换） */
  display: SessionMode
  /** 限时目标秒数；不限时为 null */
  targetSec: number | null
  accumulatedMs: number
  startedAt: number | null
  phase: 'running' | 'paused' | 'done'
  isBreak: boolean
  createdAt: number
}

export const DEFAULT_SETTINGS: Settings = {
  skipSetup: false,
  minutes: { study: 25, work: 25, read: 25, quiet: 15 },
  shortBreak: 5,
  longBreak: 15,
  sound: true,
  ambience: true,
  pet: true,
  water: 0.7,
  motion: 'auto',
  petApi: { enabled: false, endpoint: '', apiKey: '', model: '' },
}

export const MINUTE_PRESETS = [15, 25, 45, 60, 90]
