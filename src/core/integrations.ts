/**
 * 后续接入点：音乐、系统状态、动态背景、更强的灵宠。
 *
 * 这一版不启用任何真实接入，但把「插槽」和生命周期先定好：
 *   - 每个能力是一个 Integration；
 *   - 在启动时 register，UI 只依赖这些接口；
 *   - 关闭 / 不可用时优雅退回 null 或空实现。
 *
 * 这样下一版接网易云、Apple Music、Android 专注模式、自定义动态背景时，
 * 不需要改计时器与界面，只要新增一个 adapter。
 */

export interface NowPlaying {
  title: string
  artist: string
  album?: string
  playing: boolean
  artwork?: string
  /** 进度（秒）与总时长（秒），拿不到就留空 */
  position?: number
  duration?: number
}

export interface MediaIntegration {
  id: string
  name: string
  /** 浏览器 / 原生端是否可用 */
  isAvailable: () => boolean | Promise<boolean>
  getNowPlaying: () => Promise<NowPlaying | null>
  play: () => Promise<void>
  pause: () => Promise<void>
  next?: () => Promise<void>
  previous?: () => Promise<void>
  /** 返回取消订阅的函数 */
  subscribe?: (listener: (state: NowPlaying | null) => void) => () => void
}

export interface DeviceState {
  batteryLevel?: number
  charging?: boolean
  /** 系统勿扰 / 专注模式 */
  focusMode?: boolean
  steps?: number
  /** 屏幕是否点亮 */
  screenOn?: boolean
}

export interface DeviceIntegration {
  id: string
  name: string
  isAvailable: () => boolean | Promise<boolean>
  getState: () => Promise<DeviceState>
  subscribe?: (listener: (state: DeviceState) => void) => () => void
}

export interface BackgroundMountOptions {
  width: number
  height: number
  dpr: number
  /** 0–1，来自设置里的「水面动态」 */
  intensity: number
  reducedMotion: boolean
}

export interface BackgroundIntegration {
  id: string
  name: string
  description: string
  kind: 'canvas' | 'webgl' | 'css' | 'video'
  /** 挂载到一个容器，返回清理函数；必须自己处理 resize */
  mount: (container: HTMLElement, options: BackgroundMountOptions) => () => void
}

export interface PetBrainContext {
  event: string
  quadrant?: string
  seconds?: number
}

export interface PetBrainIntegration {
  id: string
  name: string
  reply: (context: PetBrainContext) => Promise<string | null>
}

function registry<T extends { id: string }>() {
  const items = new Map<string, T>()
  return {
    register(item: T): void {
      items.set(item.id, item)
    },
    get(id: string): T | undefined {
      return items.get(id)
    },
    all(): T[] {
      return [...items.values()]
    },
    clear(): void {
      items.clear()
    },
  }
}

export const integrations = {
  media: registry<MediaIntegration>(),
  device: registry<DeviceIntegration>(),
  backgrounds: registry<BackgroundIntegration>(),
  petBrains: registry<PetBrainIntegration>(),
}

/** 取第一个真正可用的实现，避免界面层关心具体平台。 */
export async function firstAvailableMedia(): Promise<MediaIntegration | null> {
  for (const item of integrations.media.all()) {
    try {
      if (await item.isAvailable()) return item
    } catch {
      /* 下一个 */
    }
  }
  return null
}

export async function firstAvailableDevice(): Promise<DeviceIntegration | null> {
  for (const item of integrations.device.all()) {
    try {
      if (await item.isAvailable()) return item
    } catch {
      /* 下一个 */
    }
  }
  return null
}
