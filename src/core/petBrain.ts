import type { PetEvent } from './petBus'
import type { PetMood, Quadrant, Settings } from './types'
import { QUADRANT_INFO } from './types'

export interface PetReply {
  line: string
  mood: PetMood
  source: 'local' | 'remote'
}

const LINES: Record<PetEvent['type'], string[]> = {
  start: [
    '切下去了。剩下的交给时间。',
    '这一瓣归你，我不出声。',
    '水纹会替你数着。',
    '不用急，先坐稳。',
    '刀落下了，就别回头看。',
    '今天的番茄，从这一刀开始。',
    '慢慢来，水会等你。',
    '先坐稳，剩下的交给水面。',
  ],
  resume: [
    '接着来。',
    '刚才的停顿，也算数。',
    '水又合上了。继续。',
    '嗯，还来得及。',
    '好，接着切。',
    '刚才那口气，带回来了。',
  ],
  pause: [
    '停在这儿也行。',
    '把肩膀放下来。',
    '水不会跑，你也不会。',
    '歇一口，再切。',
    '停一下，水面不会责怪你。',
    '这一小段空白，也算专注的一部分。',
    '靠一下椅背，我替你看着。',
  ],
  midway: [
    '过半了。呼吸还匀吗？',
    '还有一半，别赶。',
    '到这儿刚好，稳一稳。',
    '过半了，剩下的路不长。',
    '不用冲刺，匀速就好。',
  ],
  complete: [
    '一瓣落定。你做到了。',
    '时间被你切得很整齐。',
    '这一颗，收下了。',
    '水面平了。歇一会儿。',
    '好刀法。下一瓣不急。',
    '这一瓣很完整。收下吧。',
    '水面记得你刚才的专注。',
    '好了，这一颗归你。',
  ],
  abandon: [
    '收起来也不算输。',
    '这一刀留着，下次再切。',
    '没关系，番茄还有很多。',
    '先这样。我替你看着水。',
    '没切完也没关系，刀还在。',
    '收手也是判断。',
  ],
  breakStart: [
    '去喝口水，看看远处。',
    '这五分钟，什么都别想。',
    '让眼睛离开屏幕一会儿。',
    '去窗边站一会儿。',
  ],
  breakDone: ['回来吧，水面刚好。', '休息完了。要不要再来一瓣？', '回来啦，水面刚好。'],
  tap: [
    '别戳我，我会酸。',
    '我在。你继续。',
    '看什么，看你自己的番茄。',
    '这一瓣，够甜吗？',
    '轻点，汁要出来了。',
    '番茄也会害羞的。',
    '你戳一下，我甜一下。',
    '看前面，别看我。',
  ],
}

const lastPick = new Map<string, number>()

function pick(event: PetEvent): string {
  const list = LINES[event.type]
  const prev = lastPick.get(event.type)
  let i = Math.floor(Math.random() * list.length)
  if (list.length > 1 && i === prev) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
  lastPick.set(event.type, i)
  return list[i]
}

function quadrantLine(event: PetEvent): string | null {
  if (!('quadrant' in event)) return null
  const meta = QUADRANT_INFO[event.quadrant as Quadrant]
  if (event.type === 'start' && event.minutes) return `${meta.name}，${event.minutes} 分钟。我记下了。`
  return null
}

function moodFor(event: PetEvent): PetMood {
  switch (event.type) {
    case 'complete':
      return event.reached ? 'proud' : 'calm'
    case 'start':
    case 'resume':
      return 'glad'
    case 'pause':
    case 'breakDone':
      return 'calm'
    case 'abandon':
      return 'worried'
    default:
      return 'calm'
  }
}

function localReply(event: PetEvent): PetReply {
  const seed = quadrantLine(event)
  return { line: seed ?? pick(event), mood: moodFor(event), source: 'local' }
}

function describe(event: PetEvent): string {
  if (event.type === 'complete') {
    return `刚完成一次${QUADRANT_INFO[event.quadrant].name}专注，用时 ${Math.round(event.seconds / 60)} 分钟${event.reached ? '，坚持到了最后' : '，提前收工'}。`
  }
  if (event.type === 'start') {
    return `刚开始一次${QUADRANT_INFO[event.quadrant].name}专注${event.minutes ? `，计划 ${event.minutes} 分钟` : '，不限时'}。`
  }
  if (event.type === 'pause') return '暂停了专注。'
  if (event.type === 'resume') return '重新继续专注。'
  if (event.type === 'abandon') return `提前结束了一次${QUADRANT_INFO[event.quadrant].name}专注。`
  if (event.type === 'breakStart') return `开始休息 ${event.minutes} 分钟。`
  if (event.type === 'breakDone') return '休息结束。'
  return '用户戳了戳你。'
}

/** 极短的系统提示：灵宠是陪着专注的小东西，不是聊天助手。 */
const SYSTEM_PROMPT = `你是一只由半颗番茄变成的小精灵，名字叫「半刻」。你住在水边，说话克制、安静、有一点 dryness 的幽默。用户正在做番茄钟专注。请用一句不超过 24 个汉字的中文回应，不要用感叹号，不要用 emoji，不要说教，不要提 AI 或模型。`

async function remoteReply(event: PetEvent, settings: Settings): Promise<PetReply | null> {
  const { endpoint, apiKey, model } = settings.petApi
  if (!settings.petApi.enabled || !endpoint) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${describe(event)} 说点什么。` },
        ],
        temperature: 0.9,
        max_tokens: 60,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      output_text?: string
    }
    const line = (data.choices?.[0]?.message?.content ?? data.output_text ?? '').trim().replace(/^["「『]|["」』]$/g, '')
    if (!line) return null
    return { line, mood: moodFor(event), source: 'remote' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 先尝试远端，失败或无配置时用本地规则兜底。 */
export async function petReply(event: PetEvent, settings: Settings): Promise<PetReply> {
  const remote = await remoteReply(event, settings)
  return remote ?? localReply(event)
}
