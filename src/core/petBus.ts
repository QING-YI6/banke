import type { Quadrant } from './types'

export type PetEvent =
  | { type: 'start'; quadrant: Quadrant; minutes: number | null }
  | { type: 'resume'; quadrant: Quadrant }
  | { type: 'pause'; quadrant: Quadrant }
  | { type: 'midway'; quadrant: Quadrant }
  | { type: 'complete'; quadrant: Quadrant; seconds: number; reached: boolean }
  | { type: 'abandon'; quadrant: Quadrant; seconds: number }
  | { type: 'breakStart'; minutes: number }
  | { type: 'breakDone' }
  | { type: 'tap' }

type Listener = (event: PetEvent) => void
const listeners = new Set<Listener>()

/** 极简事件总线：计时器只负责发事件，灵宠自己决定怎么回应。 */
export const petBus = {
  on(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  emit(event: PetEvent): void {
    listeners.forEach((fn) => fn(event))
  },
}
