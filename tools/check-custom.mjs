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
await page.click('.chip--custom')
await sleep(250)
await page.evaluate(() => {
  const el = document.querySelector('.custom-duration input')
  if (!el) return
  el.focus()
  el.select()
})
await page.keyboard.type('37')
await sleep(200)
await page.screenshot({ path: path.join(root, 'tools/shots/setup-custom.png') })
const chipsBefore = await page.evaluate(() =>
  [...document.querySelectorAll('.chip')].map((el) => ({
    text: el.textContent.trim(),
    cls: el.className,
    bg: getComputedStyle(el).backgroundColor,
    border: getComputedStyle(el).borderColor,
  })),
)
console.log(JSON.stringify(chipsBefore, null, 2))
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.setup__actions .btn')].find((n) => n.textContent.includes('落下'))
  el?.click()
})
await sleep(900)
await page.screenshot({ path: path.join(root, 'tools/shots/timer-custom.png') })
const result = await page.evaluate(() => {
  const a = window.__banke.store.getState().active
  return { mode: a?.mode, targetSec: a?.targetSec, meta: document.querySelector('.timer__meta')?.textContent?.trim() }
})
console.log(JSON.stringify({ result }, null, 2))
await browser.close()
