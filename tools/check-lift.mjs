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
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
await page.goto(`${fileUrl}?skipIntro=1`, { waitUntil: 'load' })
await page.waitForSelector('.slice-labels.is-live', { timeout: 25000 })
await sleep(500)
const before = await page.$eval('.stem-label', (el) => ({ cls: el.className, textOpacity: getComputedStyle(el.querySelector('.stem-label__text')).opacity }))
await page.mouse.move(300, 600)
await page.mouse.down()
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(300, 600 - i * 10, { steps: 2 })
  await sleep(35)
}
await page.mouse.up()
await sleep(900)
const after = await page.$eval('.stem-label', (el) => ({ cls: el.className, textOpacity: getComputedStyle(el.querySelector('.stem-label__text')).opacity }))
await page.screenshot({ path: path.join(root, 'tools/shots/stem-lifted.png') })
console.log(JSON.stringify({ before, after }))
await browser.close()
