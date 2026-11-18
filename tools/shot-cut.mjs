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
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
await page.goto(fileUrl, { waitUntil: 'load' })
await sleep(800)
await page.screenshot({ path: path.join(shots, 'cut-1-whole.png') })

await page.waitForSelector('.stage[data-phase="cutting"]', { timeout: 30000 })
await page.screenshot({ path: path.join(shots, 'cut-2-cut.png') })
await sleep(900)
await page.screenshot({ path: path.join(shots, 'cut-3-cut2.png') })

await page.waitForSelector('.stage[data-phase="opening"]', { timeout: 30000 })
await sleep(600)
await page.screenshot({ path: path.join(shots, 'cut-4-fall.png') })
await sleep(1600)
await page.screenshot({ path: path.join(shots, 'cut-5-land.png') })
await sleep(1600)
await page.screenshot({ path: path.join(shots, 'cut-6-camera.png') })

await page.waitForSelector('.stage[data-phase="settled"]', { timeout: 40000 })
await sleep(700)
await page.screenshot({ path: path.join(shots, 'cut-7-front.png') })
console.log(errors.length ? errors.join('\n') : 'no page errors')
await browser.close()
