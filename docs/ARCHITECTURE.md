# 架构与扩展

这份文档写给下次改代码的人（也可能是三个月后的你）。目标是：**加音乐、加设备状态、换背景、换灵宠，不需要动计时器。**

## 1. 分层

```text
src/
  core/
    types.ts        版块、会话、设置、记录的类型
    store.ts        Zustand + localStorage，所有状态变更在这里
    time.ts         纯函数：剩余时间、格式化、连续天数、七日统计
    sound.ts        WebAudio 合成音效与环境音
    petBus.ts       灵宠事件总线
    petBrain.ts     本地语气规则 + OpenAI 兼容适配器
    integrations.ts 音乐 / 设备 / 背景 / 灵宠的接口与注册表
  three/
    TomatoScene.tsx 3D 场景、切割时间线、镜头、灯光
    Water.tsx       水面 shader（噪声、菲涅尔、冲击涟漪）
    Splash.tsx      水花粒子
    StemModel.tsx   蒂与萼片
    geometry.ts     四瓣番茄的程序化几何
    textures.ts     Canvas 生成的表皮 / 切面 / 光晕贴图
  components/
    WaterStage.tsx  开场 + HTML 标签投影 + 跳过 / 继续
    focus/          选择、计时、完成、背景
    panels/         柄：记录 / 设置 / 关于
    TomatoPet.tsx   番茄人 SVG 与情绪
```

原则：

- **core 不 import three / React**，只做数据和纯逻辑。
- **three 不碰 localStorage**，只接收 props、发事件。
- **components 不直接算时间**，一律走 `time.ts`。
- 新能力先进 `integrations.ts`，再接 UI。

## 2. 计时模型

状态在 `core/store.ts` 的 `active` 里：

```ts
interface ActiveSession {
  id: string
  quadrant: 'study' | 'work' | 'read' | 'quiet'
  label: string
  mode: 'countdown' | 'countup'      // 这次会话是限时还是不限时
  display: 'countdown' | 'countup'   // 屏幕上此刻展示哪一种
  targetSec: number | null           // 不限时为 null
  accumulatedMs: number              // 已暂停时累计的毫秒
  startedAt: number | null           // 本次继续的时刻
  phase: 'running' | 'paused' | 'done'
  isBreak: boolean
  createdAt: number
}
```

关键点：

- **不用 setInterval 累加秒数**，而是 `accumulatedMs + (now - startedAt)`。切后台、锁屏、掉帧都不会漂移。
- 全局看门狗在 `App.tsx`，每 500ms 检查一次，所以就算你退回水面，到点也会结算并把你请回完成页。
- 完成 → `finish(true)` 写入 `sessions`，保留最近 600 条。
- 休息不写记录，只走完成页。
- `display` 与 `mode` 分离：限时会话点数字只改变「看的角度」，不会改变是否到点。

新增统计时，优先在 `time.ts` 写纯函数并补测试式验算，不要在组件里堆 `reduce`。

## 3. 3D 开场

`TomatoScene.tsx` 里是一条手写时间线：

| 时间 | 事件 |
| --- | --- |
| 0 s | 整颗番茄、带蒂，轻微呼吸 |
| 2.0 s | 第一刀的白光扫过 |
| 2.38 s | 第二刀 |
| 2.46 s | 四瓣开始分离，蒂开始下落 |
| 2.8 s | 切口汁水粒子 |
| 3.2 s | 水面冲击 |
| 3.9 s | 落定，标签与点击生效 |

几个容易踩的坑，已经处理：

- **首帧着色器编译会卡住 1–2 秒**，如果用 `clock.elapsedTime` 直接当叙事时间，动画会被整段跳过。现在用被钳制到 50ms 的 `dt` 累积成 `animTime`。
- 番茄切面的 UV 是「半圆盘 → 贴图右半圆」，直边是番茄中轴；改贴图时注意这个映射。
- 四瓣的切面法线是常量（平面），不用 `computeVertexNormals`，避免接缝退化三角形产生 NaN。
- 蒂的起点在 `y=2.48`（番茄顶部），否则萼片会埋进果肉。
- 水面涟漪通过 `waterFx.trigger(x, z, t)` 写入 3 个槽位，shader 里按年龄衰减。
- HTML 标签不参与 React 每帧渲染：`sceneBridge` 存锚点与相机，`WaterStage` 用 rAF 直接改 `transform`。

换背景天空：改 `SkyDome` 的渐变与 `Water` 的 `uDeep / uShallow / uHorizon / uSun`。  
换镜头：`CameraRig` 的 `base / start / el / radius`。  
换四瓣布局：`layout` 数组（位置、旋转、缩放）。

## 4. 灵宠

`petBrain.ts` 目前是本地规则 + 可选远端：

- 事件：`start / resume / pause / midway / complete / abandon / breakStart / breakDone / tap`
- 本地：每个事件 4–5 句，避免连续重复。
- 远端：设置里的 OpenAI 兼容 `endpoint / model / apiKey`，6 秒超时，失败自动回本地。
- UI 不关心来源，只显示 `reply.line`，情绪仍由 store 的 `petMood` 决定。

想换成更聪明的角色，只需实现：

```ts
integrations.petBrains.register({
  id: 'my-brain',
  name: '我的灵宠',
  async reply({ event, quadrant, seconds }) {
    return '一句话，不超过 30 字。'
  },
})
```

然后在 `TomatoPet` 的 `petBus` 订阅里优先调用它，失败再回 `petReply`。

## 5. 音乐 / 设备状态 / 动态背景（预留）

`src/core/integrations.ts` 定义了四类接口与注册表：

```ts
integrations.media.register(mediaAdapter)
integrations.device.register(deviceAdapter)
integrations.backgrounds.register(backgroundAdapter)
integrations.petBrains.register(brainAdapter)
```

### 音乐

```ts
const spotify: MediaIntegration = {
  id: 'spotify',
  name: 'Spotify',
  isAvailable: () => !!window.Spotify,
  getNowPlaying: async () => ({ title, artist, playing, position, duration }),
  play: async () => {},
  pause: async () => {},
  subscribe: (listener) => {
    const off = window.Spotify.player.on('state', listener)
    return off
  },
}
integrations.media.register(spotify)
```

UI 只需在专注页订阅 `firstAvailableMedia()`，显示歌名 / 播放键；没有实现时自然不出现入口。  
Web 端的音乐平台大多有跨域与授权限制，未来更现实的路径是 Android 原生 `MediaSessionManager` + Capacitor 插件；接口已经按这个形状设计。

### 设备状态

`DeviceIntegration.getState()` 返回电量、是否充电、系统专注模式、步数等。Android 需要原生权限，iOS 类似；Web 端可以用 Battery Status API 作为降级实现。  
计时器可以在「电量低于 15% 且未充电」时让灵宠提醒，或把「系统专注模式开启」写进记录。这些只依赖状态，不需要改 `ActiveSession`。

### 动态背景

```ts
integrations.backgrounds.register({
  id: 'rain',
  name: '雨夜',
  description: '窗上的雨',
  kind: 'canvas',
  mount(container, { width, height, dpr, intensity }) {
    const canvas = document.createElement('canvas')
    // 自己画，自己 resize
    container.appendChild(canvas)
    return () => canvas.remove()
  },
})
```

接入时把 `FocusScreen` 里的 `<WaterBackdrop />` 换成一个 `BackgroundHost`：按设置里的 id 找到实现，`mount` 到容器；找不到就回退到 `WaterBackdrop`。  
现在的 `WaterBackdrop` 就是一个 WebGL 背景实现，可以直接照抄它的生命周期（resize、visibility、卸载）。

## 6. 数据

- key：`banke.state.v1`
- 持久化：`settings / sessions / active / lastQuadrant / petMood`
- 导入会校验记录的基本字段，未知版本暂时按 v1 读取。
- 升级 schema 时改 `version` 并在 `merge` 里做迁移，不要直接改字段含义。

## 7. 构建

`tools/bundle.mjs`：

1. Rollup 从 `src/main.tsx` 开始；
2. `tools/swcPlugin.mjs` 用 SWC 转 TS/TSX（替换 Vite 的 esbuild 转换）；
3. `@rollup/plugin-replace` 把 `process.env.NODE_ENV` 定为 production；
4. `terser` 压缩；
5. CSS 由自定义插件收集，和 JS 一起内联进 `index.html`；
6. 同时写出 `dist/index.html` 与根目录 `半刻.html`。

**为什么不用 Vite build**：Vite 5 的 config 加载、TS 转换、define 替换、CSS 压缩都依赖 esbuild 的常驻子进程；在不允许起子进程的构建环境里会直接失败。Rollup + SWC 全在进程内，CI 与沙箱都稳定。`npm run dev` 仍然用 Vite，正常电脑上没问题。

## 8. 加一个版块 / 页面

版块：

1. `types.ts` 的 `QUADRANTS` 与 `QUADRANT_INFO` 加一项（名称、英文、提问、占位、颜色）。
2. `store.ts` 的 `minutes` 默认值加一项。
3. 3D 布局 `layout` 需要多一瓣——目前是四刀四瓣，超出四个版块就不适合这个开场，建议改为「柄里再开一页」。

页面：在 `App.tsx` 的 `screen` 里加状态，从柄或完成页进入；背景复用 `WaterBackdrop`，面板复用 `panel__*` 样式。

## 9. 验收

```bash
npm run build
npm run shot
```

`tools/shoot.mjs` 会走：开场 → 选择 → 计时 → 正计时 → 暂停 → 完成 → 记录 → 设置 → 关于 → 手机端，并把截图写到 `tools/shots`。  
它依赖本机 Chrome；在 CI 里不跑。
