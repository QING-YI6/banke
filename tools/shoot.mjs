/* 截图验收脚本：用本机 Chrome 无头模式打开构建产物，走一遍主要界面。 */
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const shots = path.join(root, 'tools/shots')
await mkdir(shots, { recursive: true })

const chrome =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--autoplay-policy=no-user-gesture-required',
  ],
})

const errors = []
process.on('unhandledRejection', (e) => {
  console.error('SCRIPT FAILED:', e)
  console.error(errors.join('\n'))
  process.exit(1)
})
const page = await browser.newPage()
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

const fileUrl = pathToFileURL(path.join(root, 'dist/index.html')).href
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto(fileUrl, { waitUntil: 'load' })
await page.waitForSelector('.stage[data-phase="idle"]', { timeout: 15000 })
await sleep(700)
await page.screenshot({ path: path.join(shots, '00-prelude.png') })
await page.waitForSelector('.stage[data-phase="opening"]', { timeout: 25000 })
await sleep(450)
await page.screenshot({ path: path.join(shots, '00b-cut.png') })
await page.waitForSelector('.stage[data-phase="settled"]', { timeout: 30000 })
await page.waitForSelector('.slice-labels.is-live', { timeout: 10000 })
await sleep(1400)
await page.screenshot({ path: path.join(shots, '01-stage.png') })

await page.keyboard.press('ArrowRight')
await sleep(1200)
await page.screenshot({ path: path.join(shots, '01b-stage-work.png') })
await page.keyboard.press('ArrowLeft')
await sleep(900)

async function clickByText(selector, text) {
  const ok = await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((n) => n.textContent.includes(t))
      if (!el) return false
      el.click()
      return true
    },
    selector,
    text,
  )
  if (!ok) throw new Error(`can't find ${selector} with ${text}`)
}

await clickByText('.slice-label', '学习')
await page.waitForSelector('.setup__input', { timeout: 8000 })
await sleep(500)
await page.screenshot({ path: path.join(shots, '02-setup.png') })

await page.type('.setup__input', '把《阴翳礼赞》读完', { delay: 12 })
await clickByText('.chip', '45')
await sleep(300)
await page.screenshot({ path: path.join(shots, '03-setup-filled.png') })

await clickByText('.setup__actions .btn', '落下这一刀')
await sleep(1400)
await page.screenshot({ path: path.join(shots, '04-timer.png') })

await page.click('.dial')
await sleep(500)
await page.screenshot({ path: path.join(shots, '05-countup.png') })

// 暂停态
await clickByText('.timer__actions .btn', '暂停')
await sleep(500)
await page.screenshot({ path: path.join(shots, '06-paused.png') })

// 用 3 秒的会话走到完成页
await page.evaluate(() => {
  const store = window.__banke.store
  store.getState().startSession({
    quadrant: 'work',
    label: '把周报收尾',
    mode: 'countdown',
    targetSec: 3,
  })
})
await page.waitForFunction(
  () => document.body.innerText.includes('一瓣落定') || document.body.innerText.includes('先收在这里'),
  { timeout: 8000 },
)
await sleep(700)
await page.screenshot({ path: path.join(shots, '07-done.png') })

await clickByText('.done__actions .text-btn', '回到水面')
await sleep(1400)

// 造一些历史记录，然后从「柄」打开记录
await page.evaluate(() => {
  const now = Date.now()
  const day = 86400000
  const qs = ['study', 'work', 'read', 'quiet']
  const labels = {
    study: '复变函数第 4 章',
    work: '把周报收尾',
    read: '《阴翳礼赞》',
    quiet: '什么都不做，坐十分钟',
  }
  const sessions = []
  for (let d = 0; d < 6; d++) {
    const count = d === 0 ? 2 : 1 + (d % 2)
    for (let i = 0; i < count; i++) {
      const q = qs[(d + i) % 4]
      const seconds = (18 + ((d * 7 + i * 13) % 42)) * 60
      const endedAt = now - d * day - (i + 1) * 3600000
      sessions.push({
        id: `demo-${d}-${i}`,
        quadrant: q,
        label: labels[q],
        mode: 'countdown',
        plannedSec: seconds,
        seconds,
        startedAt: endedAt - seconds * 1000,
        endedAt,
        reached: true,
      })
    }
  }
  window.__banke.store.getState().importData({ sessions })
})

await sleep(500)
await page.screenshot({ path: path.join(shots, '08-stage-back.png') })

await clickByText('.stem-label', '记录')
await sleep(800)
await page.screenshot({ path: path.join(shots, '09-records.png') })

await clickByText('.panel__tab', '设置')
await sleep(500)
await page.screenshot({ path: path.join(shots, '10-settings.png') })

await clickByText('.panel__tab', '关于')
await sleep(500)
await page.screenshot({ path: path.join(shots, '11-about.png') })

await page.close()

// 移动端
const mobile = await browser.newPage()
mobile.on('pageerror', (err) => errors.push(`mobile pageerror: ${err.message}`))
await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await mobile.goto(`${fileUrl}?skipIntro=1`, { waitUntil: 'load' })
await mobile.waitForSelector('.slice-labels.is-live', { timeout: 20000 })
await sleep(1500)
await mobile.screenshot({ path: path.join(shots, '12-mobile-stage.png') })

const clickMobile = async (selector, text) => {
  const ok = await mobile.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((n) => n.textContent.includes(t))
      if (!el) return false
      el.click()
      return true
    },
    selector,
    text,
  )
  if (!ok) throw new Error(`mobile: can't find ${selector} with ${text}`)
}

await mobile.click('.slice-label')
await mobile.waitForSelector('.setup__input', { timeout: 8000 })
await sleep(500)
await mobile.screenshot({ path: path.join(shots, '13-mobile-setup.png') })

await mobile.type('.setup__input', '把方案的第二版改完')
await clickMobile('.setup__actions .btn', '落下这一刀')
await sleep(1200)
await mobile.screenshot({ path: path.join(shots, '14-mobile-timer.png') })

await clickMobile('.timer__actions .btn', '暂停')
await sleep(400)
await mobile.screenshot({ path: path.join(shots, '15-mobile-paused.png') })

await mobile.evaluate(() => {
  document.querySelector('.focus__bar-right .icon-btn[aria-label="打开记录与设置"]')?.click()
})
await sleep(900)
await mobile.screenshot({ path: path.join(shots, '16-mobile-records.png') })

await mobile.evaluate(() => {
  const tab = [...document.querySelectorAll('.panel__tab')].find((n) => n.textContent.includes('设置'))
  tab?.click()
})
await sleep(600)
await mobile.screenshot({ path: path.join(shots, '17-mobile-settings.png') })

await browser.close()

if (errors.length) {
  console.log('--- page errors ---')
  for (const e of errors) console.log(e)
} else {
  console.log('no page errors')
}
console.log('shots ->', shots)
