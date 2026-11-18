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
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 800 })
await page.goto(fileUrl, { waitUntil: 'load' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'load' })
await sleep(500)
const result = await page.evaluate(async () => {
  const store = window.__banke.store
  store.getState().startSession({ quadrant: 'work', label: 'short', mode: 'countdown', targetSec: 3 })
  await new Promise((r) => setTimeout(r, 3800))
  store.getState().closeSession()
  store.getState().startSession({ quadrant: 'read', label: 'countup', mode: 'countup' })
  await new Promise((r) => setTimeout(r, 3200))
  store.getState().finish(true)
  const countupSessions = store.getState().sessions.length
  store.getState().closeSession()
  return {
    sessions: store.getState().sessions.length,
    countupSessions,
    last: store.getState().sessions[0]?.seconds ?? null,
  }
})
console.log(JSON.stringify(result))
await browser.close()
