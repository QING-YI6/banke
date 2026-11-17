import type * as THREE from 'three'

/** 3D 场景与 HTML 标签之间的桥：每帧把锚点投影成屏幕坐标，避免 React 每帧重渲染。 */
export const sceneBridge = {
  camera: null as THREE.PerspectiveCamera | null,
  anchors: new Map<string, THREE.Object3D>(),
  /** 拖动视角时产生的位移，用来区分「拖动」和「点击」。 */
  dragDistance: 0,
  register(id: string, obj: THREE.Object3D): void {
    this.anchors.set(id, obj)
  },
  unregister(id: string, obj?: THREE.Object3D): void {
    if (!obj || this.anchors.get(id) === obj) this.anchors.delete(id)
  },
}

/** 水面涟漪：切割、柄落水时把冲击点写进 shader。 */
export const waterFx = {
  impacts: [
    { x: 0, z: 0, at: -100, strength: 0 },
    { x: 0, z: 0, at: -100, strength: 0 },
    { x: 0, z: 0, at: -100, strength: 0 },
  ],
  cursor: 0,
  trigger(x: number, z: number, now: number, strength = 1): void {
    const slot = this.impacts[this.cursor]
    slot.x = x
    slot.z = z
    slot.at = now
    slot.strength = strength
    this.cursor = (this.cursor + 1) % this.impacts.length
  },
}

export interface SplashSpec {
  id: string
  at: number
  origin: [number, number, number]
  count: number
  power: number
  color: string
  size: number
}
