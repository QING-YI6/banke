import puppeteer from 'puppeteer-core'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const fileUrl = pathToFileURL(path.join(root, 'dist/index.html')).href
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(`${fileUrl}?skipIntro=1`, { waitUntil: 'load' })
await page.waitForSelector('.slice-label', { timeout: 20000 })
await page.click('.slice-label')
await page.waitForSelector('.setup__input', { timeout: 10000 })
await page.screenshot({ path: path.join(root, 'tools/shots/setup-mobile.png') })
await page.click('.chip--custom')
await sleep(300)
await page.screenshot({ path: path.join(root, 'tools/shots/setup-mobile-custom.png') })
const info = await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
  }
  const custom = document.querySelector('.chip--custom')
  return {
    viewport: [innerWidth, innerHeight],
    scrollWidth: document.documentElement.scrollWidth,
    chips: r('.chips'),
    custom: r('.chip--custom'),
    customScrollH: custom ? custom.scrollHeight : null,
    customClientH: custom ? custom.clientHeight : null,
    eyebrow: r('.setup__eyebrow'),
    actions: r('.setup__actions'),
  }
})
console.log(JSON.stringify(info))
await browser.close()
