/**
 * 全部音效由 WebAudio 合成，不依赖任何外部音频文件：
 * 细小的切菜声、水花、木鱼般的提示音，以及很轻的水面环境音。
 */

type Ctx = AudioContext & { _bankeNoise?: AudioBuffer }

class SoundEngine {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private ambienceGain: GainNode | null = null
  private ambienceNodes: AudioScheduledSourceNode[] = []
  private enabled = true
  private ambienceEnabled = true
  private running = false

  get supported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  }

  setEnabled(v: boolean): void {
    this.enabled = v
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? 0.55 : 0, this.ctx.currentTime, 0.05)
    }
    if (!v) this.stopAmbience()
  }

  setAmbience(v: boolean): void {
    this.ambienceEnabled = v
    if (!v) this.stopAmbience()
    else if (this.running) this.startAmbience()
  }

  /** 必须在一次真实手势里调用，否则移动端不会出声。 */
  unlock(): void {
    if (!this.supported) return
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC() as Ctx
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? 0.55 : 0
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private ready(): Ctx | null {
    if (!this.ctx) this.unlock()
    if (!this.ctx || !this.master) return null
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private noise(ctx: Ctx): AudioBuffer {
    if (ctx._bankeNoise) return ctx._bankeNoise
    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    ctx._bankeNoise = buf
    return buf
  }

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private tone(freq: number, t: number, dur: number, level: number, type: OscillatorType = 'sine', detune = 0): void {
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune
    osc.connect(g)
    g.connect(this.master)
    this.env(g, t, level, 0.008, dur)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  /** 刀锋划过：短促的高频气流 + 木质落点 */
  cut(): void {
    if (!this.enabled) return
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(2600, t)
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.18)
    bp.Q.value = 1.1
    const g = ctx.createGain()
    this.env(g, t, 0.12, 0.01, 0.22)
    src.connect(bp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 0.4)
    this.tone(120, t + 0.02, 0.18, 0.06, 'triangle')
  }

  /** 水花：低通噪声 + 两颗水滴 */
  splash(): void {
    if (!this.enabled) return
    const ctx = this.ready()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(1400, t)
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.5)
    const g = ctx.createGain()
    this.env(g, t, 0.16, 0.015, 0.5)
    src.connect(lp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 0.7)
    const drop = (delay: number, f: number) => {
      const o = ctx.createOscillator()
      const og = ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(f, t + delay)
      o.frequency.exponentialRampToValueAtTime(f * 1.9, t + delay + 0.08)
      o.connect(og).connect(this.master!)
      this.env(og, t + delay, 0.03, 0.005, 0.1)
      o.start(t + delay)
      o.stop(t + delay + 0.2)
    }
    drop(0.04, 620)
    drop(0.12, 880)
  }

  start(): void {
    if (!this.enabled) return
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(196, t, 0.5, 0.05, 'sine')
    this.tone(392, t + 0.01, 0.35, 0.018, 'sine', 4)
  }

  pause(): void {
    if (!this.enabled) return
    const ctx = this.ready()
    if (!ctx) return
    this.tone(147, ctx.currentTime, 0.22, 0.035, 'sine')
  }

  /** 完成：一声清亮但不吵的钵音 */
  complete(): void {
    if (!this.enabled) return
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(523.25, t, 2.6, 0.075, 'sine')
    this.tone(784.88, t + 0.02, 2.2, 0.035, 'sine', 6)
    this.tone(1046.5, t + 0.04, 1.6, 0.02, 'sine', -5)
    this.tone(261.63, t, 3.2, 0.03, 'sine')
  }

  breakDone(): void {
    if (!this.enabled) return
    const ctx = this.ready()
    if (!ctx) return
    this.tone(392, ctx.currentTime, 1.8, 0.05, 'sine')
    this.tone(587.33, ctx.currentTime + 0.05, 1.3, 0.022, 'sine')
  }

  /** 专注时的水面环境音；暂停/离开时淡出。 */
  startAmbience(): void {
    this.running = true
    if (!this.ambienceEnabled || !this.enabled) return
    const ctx = this.ready()
    if (!ctx || !this.master || this.ambienceGain) return
    const t = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    gain.connect(this.master)

    const mk = (freq: number, q: number, level: number, lfoRate: number) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise(ctx)
      src.loop = true
      const filt = ctx.createBiquadFilter()
      filt.type = 'bandpass'
      filt.frequency.value = freq
      filt.Q.value = q
      const g = ctx.createGain()
      g.gain.value = level
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = lfoRate
      lfoGain.gain.value = level * 0.55
      lfo.connect(lfoGain).connect(g.gain)
      src.connect(filt).connect(g).connect(gain)
      src.start(t)
      lfo.start(t)
      this.ambienceNodes.push(src, lfo)
    }
    mk(420, 0.6, 0.05, 0.06)
    mk(1100, 0.9, 0.018, 0.11)
    mk(240, 0.5, 0.03, 0.04)
    gain.gain.setTargetAtTime(0.13, t, 1.2)
    this.ambienceGain = gain
  }

  stopAmbience(): void {
    this.running = false
    const ctx = this.ctx
    if (!ctx) return
    const g = this.ambienceGain
    const nodes = this.ambienceNodes
    this.ambienceGain = null
    this.ambienceNodes = []
    if (g) {
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4)
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop()
          } catch {
            /* 已经停了 */
          }
        })
        g.disconnect()
      }, 1200)
    }
  }

  /** 让环境音跟随专注状态 */
  syncFocus(active: boolean): void {
    this.running = active
    if (active) this.startAmbience()
    else this.stopAmbience()
  }
}

export const sound = new SoundEngine()
