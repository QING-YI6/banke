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
await page.waitForSelector('.slice-labels.is-live', { timeout: 30000 })
await sleep(1200)
await page.screenshot({ path: path.join(shots, 'stage-latest.png') })

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.slice-labels.is-live', { timeout: 30000 })
await sleep(1200)
await page.screenshot({ path: path.join(shots, 'stage-mobile-latest.png') })

console.log(errors.length ? errors.join('\n') : 'no page errors')
await browser.close()
