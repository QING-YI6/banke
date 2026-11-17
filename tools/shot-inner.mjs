import puppeteer from 'puppeteer-core'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir } from 'node:fs/promises'

const root = process.cwd()
const shots = path.join(root, 'tools/shots')
await mkdir(shots, { recursive: true })
const fileUrl = pathToFileURL(path.join(root, 'dist/index.html')).href
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
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
  ],
})
const errors = []
const page = await browser.newPage()
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto(`${fileUrl}?skipIntro=1`, { waitUntil: 'load' })
await page.waitForSelector('.slice-label', { timeout: 20000 })
await page.click('.slice-label')
await page.waitForSelector('.setup__input', { timeout: 10000 })
await sleep(500)
await page.screenshot({ path: path.join(shots, 'inner-setup.png') })

await page.type('.setup__input', '把《阴翳礼赞》读完')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.chip')].find((n) => n.textContent.includes('45'))
  el?.click()
})
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.setup__actions .btn')].find((n) => n.textContent.includes('落下'))
  el?.click()
})
await sleep(1400)
await page.screenshot({ path: path.join(shots, 'inner-timer.png') })

await page.evaluate(() => {
  const el = document.querySelector('.focus__bar-right .icon-btn[aria-label="打开记录与设置"]')
  el?.click()
})
await sleep(700)
await page.screenshot({ path: path.join(shots, 'inner-records.png') })
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.panel__tab')].find((n) => n.textContent.includes('设置'))
  el?.click()
})
await sleep(500)
await page.screenshot({ path: path.join(shots, 'inner-settings.png') })

await page.evaluate(() => {
  const el = [...document.querySelectorAll('.panel__tab')].find((n) => n.textContent.includes('关于'))
  el?.click()
})
await sleep(500)
await page.screenshot({ path: path.join(shots, 'inner-about.png') })

await page.click('.panel__close')
await sleep(500)
await page.evaluate(() => {
  const store = window.__banke.store
  store.getState().startSession({
    quadrant: 'work',
    label: '把周报收尾',
    mode: 'countdown',
    targetSec: 3,
  })
})
await sleep(3800)
await page.screenshot({ path: path.join(shots, 'inner-done.png') })

const mobile = await browser.newPage()
mobile.on('pageerror', (e) => errors.push(e.message))
await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await mobile.goto(fileUrl, { waitUntil: 'load' })
await mobile.evaluate(() => localStorage.clear())
await mobile.goto(`${fileUrl}?skipIntro=1`, { waitUntil: 'load' })
await mobile.waitForSelector('.slice-label', { timeout: 20000 })
await mobile.click('.slice-label')
await mobile.waitForSelector('.setup__input', { timeout: 10000 })
await sleep(600)
await mobile.screenshot({ path: path.join(shots, 'inner-mobile-setup.png') })
await mobile.type('.setup__input', 'Finish the second draft')
await mobile.evaluate(() => {
  const el = [...document.querySelectorAll('.setup__actions .btn')].find((n) => n.textContent.includes('落下'))
  el?.click()
})
await sleep(1200)
await mobile.screenshot({ path: path.join(shots, 'inner-mobile-timer.png') })
await mobile.evaluate(() => {
  document.querySelector('.focus__bar-right .icon-btn[aria-label="打开记录与设置"]')?.click()
})
await sleep(700)
await mobile.screenshot({ path: path.join(shots, 'inner-mobile-records.png') })

console.log(errors.length ? errors.join('\n') : 'no page errors')
await browser.close()
