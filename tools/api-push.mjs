import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const token = process.env.GH_TOKEN
if (!token) throw new Error('GH_TOKEN missing')
const repo = 'QING-YI6/banke'
const root = process.cwd()
const api = `https://api.github.com/repos/${repo}`
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'banke-icon-push',
}

async function req(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${url}\n${text.slice(0, 1200)}`)
  return text ? JSON.parse(text) : null
}

const baseRef = await req(`${api}/git/ref/heads/main`)
const baseSha = baseRef.object.sha
const baseCommit = await req(`${api}/git/commits/${baseSha}`)
const baseTree = baseCommit.tree.sha

const raw = execFileSync('git', ['diff', '--name-only', '-z', `${baseSha}..HEAD`], { cwd: root })
const files = raw.toString('utf8').split('\0').filter(Boolean)
console.log(`base ${baseSha.slice(0, 7)}, files ${files.length}`)

const tree = []
for (const file of files) {
  const abs = path.join(root, file)
  let content
  try {
    content = readFileSync(abs)
  } catch {
    // deleted file
    tree.push({ path: file.split(path.sep).join('/'), mode: '100644', type: 'blob', sha: null })
    console.log(`delete ${file}`)
    continue
  }
  const blob = await req(`${api}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: content.toString('base64'), encoding: 'base64' }),
  })
  tree.push({ path: file.split(path.sep).join('/'), mode: '100644', type: 'blob', sha: blob.sha })
  console.log(`blob ${file} ${content.length}`)
}

const newTree = await req(`${api}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ base_tree: baseTree, tree }),
})
const commit = await req(`${api}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({
    message: '重绘图标，修复手机自定义出框与设置页留白',
    tree: newTree.sha,
    parents: [baseSha],
  }),
})
await req(`${api}/git/refs/heads/main`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
})
const tag = await req(`${api}/git/tags`, {
  method: 'POST',
  body: JSON.stringify({
    tag: 'v1.7-icon',
    message: '图标重绘与手机适配',
    object: commit.sha,
    type: 'commit',
  }),
})
await req(`${api}/git/refs`, {
  method: 'POST',
  body: JSON.stringify({ ref: 'refs/tags/v1.7-icon', sha: tag.sha }),
})
console.log(`PUSHED ${commit.sha}`)
console.log(`https://github.com/${repo}/commit/${commit.sha}`)
