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
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto(`${fileUrl}?skipIntro=1`, { waitUntil: 'load' })
await page.waitForSelector('.slice-label', { timeout: 20000 })
await page.click('.slice-label')
await page.waitForSelector('.setup__input', { timeout: 10000 })
await page.type('.setup__input', '把《阴翳礼赞》读完')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.setup__actions .btn')].find((n) => n.textContent.includes('落下'))
  el?.click()
})
await sleep(1500)
await page.evaluate(() => {
  const el = document.querySelector('.timer__actions .btn--primary')
  el?.click()
})
await sleep(700)
await page.screenshot({ path: path.join(root, 'tools/shots/inner-paused.png') })
const info = await page.evaluate(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height, text: (el.textContent || '').trim().slice(0, 80) }
  }
  return {
    task: rect('.focus__task'),
    actions: rect('.timer__actions'),
    hint: rect('.timer__hint'),
    label: rect('.timer__label'),
    paused: rect('.timer__paused'),
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
